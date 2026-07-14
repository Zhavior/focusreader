import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { issueExtensionToken, revokeExtensionTokens } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Issues the signed-in user a fresh extension token (revoking old ones).
 * The plaintext is returned exactly once; only its hash is stored.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ token: issueExtensionToken(userId) });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revokeExtensionTokens(userId);
  return NextResponse.json({ revoked: true });
}
