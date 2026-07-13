import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listTracks } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ tracks: listTracks(userId) });
  } catch (err) {
    console.error("[/api/tracks] listTracks failed:", err);
    return NextResponse.json({ tracks: [] }, { status: 200 });
  }
}
