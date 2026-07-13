import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import fs from "fs";
import { getBillingMetadata, deductCredits } from "@/lib/credits";
import {
  createTrack,
  deleteTrack,
  markTrackReady,
  markTrackFailed,
  audioPathFor,
} from "@/lib/db";

export const runtime = "nodejs";

/**
 * Credit-gated TTS interceptor.
 *
 * Wraps the existing ElevenLabs streaming pipeline (the Express backend at
 * TTS_BACKEND_URL) without modifying it:
 *
 *   1. Authenticate the Clerk user.
 *   2. Read their private-metadata credit balance.
 *   3. Block with 402 if text.length > credits.
 *   4. Proxy the request to the untouched pipeline and stream audio back.
 *   5. Decrement the balance once the pipeline has accepted the job.
 *
 * The frontend just switches its fetch target from the backend URL to
 * `/api/tts` — same request body, same streamed MP3 response.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in to generate audio." },
      { status: 401 }
    );
  }

  let body: {
    text?: string;
    voiceId?: string;
    modelId?: string;
    filename?: string;
    speed?: number;
    background?: string;
    title?: string;
    checkpoints?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_input", message: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) {
    return NextResponse.json(
      { error: "invalid_input", message: "Text is required." },
      { status: 400 }
    );
  }

  // ---- Credit gate -------------------------------------------------------
  const billing = await getBillingMetadata(userId);
  const cost = text.length;

  if (cost > billing.credits) {
    return NextResponse.json(
      {
        error: "insufficient_credits",
        message:
          billing.plan === "free"
            ? "You're on the free plan. Upgrade to Premium for 100,000 monthly characters."
            : `This request needs ${cost.toLocaleString()} characters but you have ${billing.credits.toLocaleString()} remaining.`,
        credits: billing.credits,
        required: cost,
      },
      { status: 402 }
    );
  }

  // ---- Proxy to the untouched ElevenLabs pipeline ------------------------
  const backendUrl = process.env.TTS_BACKEND_URL;
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (!backendUrl || !internalSecret) {
    return NextResponse.json(
      {
        error: "server_misconfigured",
        message:
          "TTS_BACKEND_URL or INTERNAL_API_SECRET is not set on the server.",
      },
      { status: 500 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}/api/tts/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify(body),
      signal: req.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      // Client cancelled before the pipeline accepted the job — no charge.
      return new Response(null, { status: 499 });
    }
    console.error("TTS backend unreachable:", err);
    return NextResponse.json(
      {
        error: "backend_unreachable",
        message: "The voice engine is unavailable. Please try again shortly.",
      },
      { status: 502 }
    );
  }

  // Pipeline rejected the job (rate limit, bad key, invalid input): relay its
  // JSON error verbatim and charge nothing.
  if (!upstream.ok || !upstream.body) {
    const errorBody = await upstream.text();
    return new Response(errorBody, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      },
    });
  }

  // ---- Persist to the track library while streaming to the client --------
  // tee() splits the audio stream: one branch goes to the browser live, the
  // other is written to <DATA_DIR>/audio/<id>.mp3 so the track survives
  // refresh and shows up in the user's library.
  const track = createTrack({
    userId,
    title: deriveTitle(body.title, text),
    chars: cost,
    speed: typeof body.speed === "number" ? body.speed : 1.0,
    background: typeof body.background === "string" ? body.background : "silence",
    text,
  });

  // ---- Atomic spend: only after the pipeline accepted the job -------------
  // spendCredits is check-and-insert inside one SQLite transaction, so two
  // simultaneous requests can no longer both pass a stale balance check.
  const remaining = await deductCredits(userId, cost, track.id);
  if (remaining === null) {
    deleteTrack(track.id, userId);
    upstream.body.cancel().catch(() => {});
    return NextResponse.json(
      {
        error: "insufficient_credits",
        message: "Your balance changed while this request was in flight.",
      },
      { status: 402 }
    );
  }

  const [clientBranch, fileBranch] = upstream.body.tee();
  persistAudio(fileBranch, track.id).catch((err) => {
    console.error(`Failed persisting track ${track.id}:`, err);
    markTrackFailed(track.id);
  });

  return new Response(clientBranch, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition":
        upstream.headers.get("Content-Disposition") ??
        'inline; filename="voice-output.mp3"',
      "X-Credits-Remaining": String(remaining),
      "X-Track-Id": track.id,
    },
  });
}

function deriveTitle(explicit: string | undefined, text: string): string {
  if (explicit && explicit.trim()) return explicit.trim().slice(0, 120);
  const firstLine = text.trim().split("\n")[0].trim();
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

async function persistAudio(
  stream: ReadableStream<Uint8Array>,
  trackId: string
): Promise<void> {
  const file = fs.createWriteStream(audioPathFor(trackId));
  const reader = stream.getReader();
  let bytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        bytes += value.byteLength;
        if (!file.write(value)) {
          await new Promise<void>((resolve) => file.once("drain", resolve));
        }
      }
    }
    await new Promise<void>((resolve, reject) => {
      file.end(() => resolve());
      file.on("error", reject);
    });
    if (bytes === 0) {
      markTrackFailed(trackId);
      fs.rmSync(audioPathFor(trackId), { force: true });
      return;
    }
    markTrackReady(trackId, bytes);
  } catch (err) {
    file.destroy();
    fs.rmSync(audioPathFor(trackId), { force: true });
    throw err;
  }
}
