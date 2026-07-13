import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createBillingPortalSession } from "@/lib/stripe";
import { getBillingMetadata } from "@/lib/credits";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const billing = await getBillingMetadata(userId);

    if (!billing.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Subscribe first." },
        { status: 400 }
      );
    }

    const url = await createBillingPortalSession(billing.stripeCustomerId);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Failed to create billing portal session:", err);
    return NextResponse.json(
      { error: "Could not open the billing portal. Please try again." },
      { status: 500 }
    );
  }
}
