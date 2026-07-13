import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getJob } from "@/lib/db";
import { ensureWorker } from "@/lib/worker";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Poll requests also nudge the worker — covers the dev-server-restarted-
  // after-enqueue case where the interval singleton was lost.
  ensureWorker();

  const { id } = await params;
  const job = getJob(id, userId);
  if (!job) {
    return NextResponse.json(
      { error: "not_found", message: "Job not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    jobId: job.id,
    trackId: job.track_id,
    status: job.status,
    error: job.error,
  });
}
