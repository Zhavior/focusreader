import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import fs from "fs";
import { Readable } from "stream";
import { getTrack, audioPathFor } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Streams a saved track's MP3. Ownership is enforced: getTrack() is scoped to
 * the authenticated user, so one user can never fetch another's audio even
 * with a guessed track id.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const track = getTrack(id, userId);
  if (!track || track.status !== "ready") {
    return NextResponse.json(
      { error: "not_found", message: "Track not found or not ready." },
      { status: 404 }
    );
  }

  const filePath = audioPathFor(track.id);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: "not_found", message: "Audio file is missing from storage." },
      { status: 404 }
    );
  }

  const nodeStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(track.size_bytes),
      "Content-Disposition": `inline; filename="${track.title.replace(/[^a-zA-Z0-9-_ ]/g, "_")}.mp3"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
