import { NextResponse } from "next/server";
import { createImport } from "@/lib/db";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.text || typeof body.text !== 'string') {
      return NextResponse.json(
        { error: "Missing text content" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const imported = createImport(body.text);

    return NextResponse.json(
      { success: true, id: imported.id },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    console.error("Extension Import Error:", err);
    return NextResponse.json(
      { error: "Failed to save import" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
