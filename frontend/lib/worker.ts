import fs from "fs";
import {
  claimNextJob,
  finishJob,
  markTrackReady,
  markTrackFailed,
  audioPathFor,
  grantCredits,
  type Job,
} from "@/lib/db";

/**
 * In-process background worker for long-document generation.
 *
 * Long texts (a whole textbook chapter) can't ride a single browser request:
 * the tab would sit on a pending fetch for minutes and any network blip
 * loses everything. Instead /api/jobs enqueues, this worker generates in the
 * background writing straight to the track library, and the client polls.
 *
 * Claiming is atomic (claimNextJob runs a SQLite transaction) so overlapping
 * ticks can't double-process. Credits were spent at enqueue time; failures
 * refund them, idempotently keyed to the job id.
 */

declare global {
  // eslint-disable-next-line no-var
  var __focusreaderWorker: { running: boolean } | undefined;
}

const TICK_MS = 2000;

export function ensureWorker(): void {
  if (globalThis.__focusreaderWorker) return;
  globalThis.__focusreaderWorker = { running: false };
  setInterval(tick, TICK_MS).unref();
}

async function tick(): Promise<void> {
  const state = globalThis.__focusreaderWorker;
  if (!state || state.running) return;

  state.running = true;
  try {
    // Drain the queue one job at a time; generation dominates runtime, so a
    // single in-flight job per instance keeps memory + ElevenLabs usage sane.
    let job = claimNextJob();
    while (job) {
      await runJob(job);
      job = claimNextJob();
    }
  } catch (err) {
    console.error("Worker tick failed:", err);
  } finally {
    state.running = false;
  }
}

async function runJob(job: Job): Promise<void> {
  try {
    const backendUrl = process.env.TTS_BACKEND_URL;
    const internalSecret = process.env.INTERNAL_API_SECRET;
    if (!backendUrl || !internalSecret) {
      throw new Error("TTS backend is not configured.");
    }

    const upstream = await fetch(`${backendUrl}/api/tts/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({
        text: job.text,
        speed: job.speed,
        background: job.background,
        checkpoints: job.checkpoints === 1,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      throw new Error(
        `TTS backend responded ${upstream.status}: ${detail.slice(0, 200)}`
      );
    }

    const bytes = await writeStreamToFile(upstream.body, audioPathFor(job.track_id));
    if (bytes === 0) throw new Error("TTS backend returned empty audio.");

    markTrackReady(job.track_id, bytes);
    finishJob(job.id);
    console.log(`Job ${job.id} done: track ${job.track_id} (${bytes} bytes).`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Job ${job.id} failed:`, message);
    markTrackFailed(job.track_id);
    fs.rmSync(audioPathFor(job.track_id), { force: true });
    // Refund the characters spent at enqueue — idempotent on the job id.
    grantCredits(job.user_id, job.text.length, "refund_tts", `job:${job.id}`);
    finishJob(job.id, message);
  }
}

async function writeStreamToFile(
  stream: ReadableStream<Uint8Array>,
  filePath: string
): Promise<number> {
  const file = fs.createWriteStream(filePath);
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
    return bytes;
  } catch (err) {
    file.destroy();
    fs.rmSync(filePath, { force: true });
    throw err;
  }
}
