import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createCheckoutSession } from "@/lib/stripe";
import { getBillingMetadata } from "@/lib/credits";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const billing = await getBillingMetadata(userId);

    const url = await createCheckoutSession({
      clerkUserId: userId,
      customerEmail: user.primaryEmailAddress?.emailAddress,
      existingStripeCustomerId: billing.stripeCustomerId,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Failed to create checkout session:", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}
