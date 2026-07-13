import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteTrack, getTrack } from "@/lib/db";

export const runtime = "nodejs";

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
  if (!track) {
    return NextResponse.json(
      { error: "not_found", message: "Track not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ track });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = deleteTrack(id, userId);
  if (!deleted) {
    return NextResponse.json(
      { error: "not_found", message: "Track not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ deleted: true });
}
