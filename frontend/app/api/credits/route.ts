import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBillingMetadata } from "@/lib/credits";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const billing = await getBillingMetadata(userId);
  return NextResponse.json({ credits: billing.credits, plan: billing.plan });
}
