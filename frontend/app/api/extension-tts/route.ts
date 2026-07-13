import { NextResponse } from "next/server";

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
    const backendUrl = process.env.TTS_BACKEND_URL;
    const internalSecret = process.env.INTERNAL_API_SECRET;

    if (!backendUrl || !internalSecret) {
      return NextResponse.json(
        { error: "Server misconfigured" },
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
        text: body.text,
        voiceId: body.voiceId,
        modelId: body.modelId,
      }),
    });

    if (!upstream.ok) {
      const errorBody = await upstream.text();
      return new Response(errorBody, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
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
      { error: "Backend unreachable" },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
