import { NextResponse } from "next/server";
import { getBillingMetadata } from "@/lib/credits";
import { resolveExtensionToken, createTrack } from "@/lib/db";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

/**
 * POST /api/extension-vault
 * Allows the Zhavior Chrome Extension to save a webpage article (URL, Title, Clean Text)
 * directly into the user's permanent Dashboard Study Library (TrackLibrary).
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "unauthorized", message: "Missing Bearer extension token" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const userId = resolveExtensionToken(authHeader.split(" ")[1]);
    if (!userId) {
      return NextResponse.json(
        {
          error: "unauthorized",
          message: "Invalid or revoked extension token. Generate a new one in Dashboard → Tools.",
        },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const body = await req.json();
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Saved Web Article";
    const url = typeof body.url === "string" ? body.url.trim() : null;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const speed = typeof body.speed === "number" ? body.speed : 1.5;
    const background = typeof body.background === "string" ? body.background : "brown_noise";

    if (!text) {
      return NextResponse.json(
        { error: "invalid_input", message: "Article text cannot be empty" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Verify billing status
    const billing = await getBillingMetadata(userId);
    if (billing.plan !== "premium" && billing.credits <= 0) {
      return NextResponse.json(
        { error: "insufficient_credits", message: "Upgrade to Premium or add credits to save articles." },
        { status: 402, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Create the permanent track in the user's library with exact source_url
    const track = createTrack({
      userId,
      title,
      chars: text.length,
      speed,
      background,
      text,
      sourceUrl: url,
    });

    return NextResponse.json(
      { success: true, trackId: track.id, title: track.title },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    console.error("[/api/extension-vault] Error:", err);
    return NextResponse.json(
      { error: "server_error", message: "Failed to save article to Study Vault" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
