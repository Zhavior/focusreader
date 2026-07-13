import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBillingMetadata, deductCredits } from "@/lib/credits";
import { createTrack, createJob, deleteTrack } from "@/lib/db";
import { ensureWorker } from "@/lib/worker";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 200000;

/**
 * Enqueues an async generation job for long documents. Credits are spent
 * atomically at enqueue time (refunded by the worker on failure); the client
 * polls GET /api/jobs/[id] and plays the finished track from the library.
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

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json(
      { error: "invalid_input", message: "Text is required." },
      { status: 400 }
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error: "invalid_input",
        message: `Text exceeds the ${MAX_TEXT_LENGTH.toLocaleString()} character limit.`,
      },
      { status: 400 }
    );
  }

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

  const speed = typeof body.speed === "number" ? body.speed : 1.0;
  const background =
    typeof body.background === "string" ? body.background : "silence";

  const track = createTrack({
    userId,
    title: body.title?.trim().slice(0, 120) || text.split("\n")[0].trim().slice(0, 80),
    chars: cost,
    speed,
    background,
    text,
  });

  const remaining = await deductCredits(userId, cost, track.id);
  if (remaining === null) {
    deleteTrack(track.id, userId);
    return NextResponse.json(
      {
        error: "insufficient_credits",
        message: "Your balance changed while this request was in flight.",
      },
      { status: 402 }
    );
  }

  const job = createJob({
    userId,
    trackId: track.id,
    text,
    speed,
    background,
    checkpoints: body.checkpoints === true,
  });
  ensureWorker();

  return NextResponse.json(
    {
      jobId: job.id,
      trackId: track.id,
      status: job.status,
      creditsRemaining: remaining,
    },
    { status: 202 }
  );
}
