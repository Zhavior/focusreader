import { NextResponse } from "next/server";
import { createNote, resolveExtensionToken } from "@/lib/db";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
    // Opaque `frk_...` token issued from Dashboard → Tools; resolved to a
    // user id server-side. Raw Clerk user ids are not accepted.
    const userId = resolveExtensionToken(authHeader.split(" ")[1]);
    if (!userId) {
      return NextResponse.json(
        { error: "unauthorized", message: "Invalid or revoked extension token." },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const body = await req.json();
    if (!body.note) {
      return NextResponse.json(
        { error: "Missing note content" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const note = createNote({
      userId: userId,
      note: body.note,
      source: body.source || "Extension"
    });

    return NextResponse.json(
      { success: true, note },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    console.error("Extension Notes Error:", err);
    return NextResponse.json(
      { error: "Failed to save note" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
