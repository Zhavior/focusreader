import { NextResponse } from "next/server";
import { getBillingMetadata, deductCredits } from "@/lib/credits";
import { resolveExtensionToken } from "@/lib/db";

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
        { error: "unauthorized" },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
    // The bearer token is an opaque `frk_...` credential issued from the
    // dashboard — NEVER a raw Clerk user id (user ids are identifiers, not
    // secrets; accepting them would let anyone spend anyone's credits).
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
    const text = typeof body.text === "string" ? body.text : "";
    
    if (!text.trim()) {
      return NextResponse.json(
        { error: "invalid_input" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Check credits
    const billing = await getBillingMetadata(userId);
    const cost = text.length;

    if (cost > billing.credits) {
      return NextResponse.json(
        { error: "insufficient_credits" },
        { status: 402, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const backendUrl = process.env.TTS_BACKEND_URL;
    const internalSecret = process.env.INTERNAL_API_SECRET;

    if (!backendUrl || !internalSecret) {
      return NextResponse.json(
        { error: "server_misconfigured" },
        { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
    
    const upstream = await fetch(`${backendUrl}/api/tts/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({
        text: text,
        voiceId: body.voiceId,
        modelId: body.modelId,
      }),
    });

    if (!upstream.ok) {
      // Engine rejected the job — the user is NOT charged.
      const errorBody = await upstream.text();
      return new Response(errorBody, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Charge only after the engine accepted (transient extension read; no
    // track is saved). Unique ref keeps the ledger entry idempotent.
    const refId = `ext_chunk_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const remaining = await deductCredits(userId, cost, refId);
    if (remaining === null) {
      return NextResponse.json(
        { error: "insufficient_credits" },
        { status: 402, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Extension TTS Error:", err);
    return NextResponse.json(
      { error: "backend_unreachable" },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
