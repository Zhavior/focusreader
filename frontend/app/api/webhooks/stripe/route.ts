import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, PREMIUM_MONTHLY_CREDITS } from "@/lib/stripe";
import { getBillingMetadata, setBillingMetadata } from "@/lib/credits";
import { grantCredits, revokeAllCredits } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Stripe webhook endpoint.
 *
 * Security model: the ONLY trusted input is the raw request body verified
 * against STRIPE_WEBHOOK_SECRET via constructEvent. Never provision credits
 * from client-side "success" redirects — this route is the single source of
 * truth for entitlements.
 *
 * Events handled:
 *  - checkout.session.completed  → first purchase: capture stripeCustomerId,
 *    flip plan to premium, grant 100,000 credits.
 *  - invoice.payment_succeeded   → monthly renewal: re-grant 100,000 credits.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured.");
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 }
    );
  }

  // constructEvent needs the exact raw bytes Stripe signed — req.text(),
  // never req.json().
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("Stripe signature verification failed:", message);
    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        await handleCheckoutCompleted(session);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        await handleInvoicePaid(invoice);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      default:
        // Acknowledge everything else so Stripe stops retrying.
        break;
    }
  } catch (err) {
    // Returning 500 makes Stripe retry with exponential backoff — the right
    // behavior for transient Clerk API failures.
    console.error(`Failed handling ${event.type}:`, err);
    return NextResponse.json(
      { error: "Handler failed; Stripe will retry." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const clerkUserId =
    session.metadata?.clerk_user_id ?? session.client_reference_id;

  if (!clerkUserId) {
    // Not one of our sessions (or metadata was stripped) — log and ack.
    console.error(
      `checkout.session.completed ${session.id} has no clerk_user_id; skipping.`
    );
    return;
  }

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  const existing = await getBillingMetadata(clerkUserId);

  // Ledger grant — idempotent on the checkout session id, so a redelivered
  // webhook can't double-provision.
  grantCredits(
    clerkUserId,
    PREMIUM_MONTHLY_CREDITS,
    "grant_checkout",
    session.id
  );

  await setBillingMetadata(clerkUserId, {
    ...existing,
    plan: "premium",
    stripeCustomerId: stripeCustomerId ?? existing.stripeCustomerId,
    stripeSubscriptionId:
      stripeSubscriptionId ?? existing.stripeSubscriptionId,
    creditsGrantedAt: new Date().toISOString(),
    // Clear any prior cancellation (this covers the re-subscribe case).
    canceledAt: undefined,
  });

  console.log(
    `Provisioned ${PREMIUM_MONTHLY_CREDITS} credits for Clerk user ${clerkUserId} (customer ${stripeCustomerId}).`
  );
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  // The first invoice of a subscription fires alongside
  // checkout.session.completed; skip it so the initial grant isn't doubled.
  if (invoice.billing_reason === "subscription_create") {
    return;
  }

  const clerkUserId = await resolveClerkUserIdFromInvoice(invoice);
  if (!clerkUserId) {
    console.error(
      `invoice.payment_succeeded ${invoice.id} could not be mapped to a Clerk user; skipping.`
    );
    return;
  }

  const existing = await getBillingMetadata(clerkUserId);

  // Monthly renewal: reset (not stack) the allowance. Both ledger writes are
  // keyed to the invoice id via the unique (reason, ref) index, so a
  // redelivered webhook is a physical no-op — no application-level guard
  // needed.
  if (invoice.id) {
    revokeAllCredits(clerkUserId, `renewal-reset:${invoice.id}`);
    grantCredits(
      clerkUserId,
      PREMIUM_MONTHLY_CREDITS,
      "grant_renewal",
      invoice.id
    );
  }

  await setBillingMetadata(clerkUserId, {
    ...existing,
    plan: "premium",
    creditsGrantedAt: new Date().toISOString(),
    lastInvoiceId: invoice.id ?? existing.lastInvoiceId,
    canceledAt: undefined,
  });

  console.log(
    `Renewed ${PREMIUM_MONTHLY_CREDITS} credits for Clerk user ${clerkUserId}.`
  );
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const clerkUserId = subscription.metadata?.clerk_user_id;
  if (!clerkUserId) {
    console.error(
      `customer.subscription.deleted ${subscription.id} has no clerk_user_id; skipping.`
    );
    return;
  }

  const existing = await getBillingMetadata(clerkUserId);

  // Downgrade to free and revoke the premium allowance. We keep the
  // stripeCustomerId so the user can still open the billing portal / resubscribe.
  revokeAllCredits(clerkUserId, `cancel:${subscription.id}`);
  await setBillingMetadata(clerkUserId, {
    ...existing,
    plan: "free",
    stripeSubscriptionId: undefined,
    canceledAt: new Date().toISOString(),
  });

  console.log(
    `Subscription ${subscription.id} canceled; downgraded Clerk user ${clerkUserId} to free.`
  );
}

/**
 * Renewal invoices don't carry checkout metadata directly; the clerk_user_id
 * lives on the Subscription (we set subscription_data.metadata at checkout).
 */
async function resolveClerkUserIdFromInvoice(
  invoice: Stripe.Invoice
): Promise<string | null> {
  const fromInvoice = invoice.metadata?.clerk_user_id;
  if (fromInvoice) return fromInvoice;

  const subscriptionId =
    typeof invoice.parent?.subscription_details?.subscription === "string"
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id;

  const fromSubDetails =
    invoice.parent?.subscription_details?.metadata?.clerk_user_id;
  if (fromSubDetails) return fromSubDetails;

  if (!subscriptionId) return null;

  const subscription = await getStripe().subscriptions.retrieve(
    subscriptionId
  );
  return subscription.metadata?.clerk_user_id ?? null;
}
