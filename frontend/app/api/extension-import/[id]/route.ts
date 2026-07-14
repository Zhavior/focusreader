import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { claimImport } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Claims a captured import into the signed-in user's editor. One-time: the
 * row is deleted on read, so a leaked claim URL is useless after use.
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
  const imported = claimImport(id);

  if (!imported) {
    return NextResponse.json(
      { error: "not_found", message: "Import not found or already claimed." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, text: imported.text });
}
