import Stripe from "stripe";

/**
 * Lazily-initialized Stripe client. Deferring construction to first use keeps
 * `next build` green in environments where STRIPE_SECRET_KEY isn't injected
 * (CI, preview builds) — the key is only required when a request actually
 * touches Stripe.
 *
 * The apiVersion is intentionally omitted so the client always uses the
 * version pinned by the installed stripe-node SDK. Pinning a string literal
 * here would drift from (and conflict with) the SDK's own types on upgrade.
 */
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to frontend/.env.local."
    );
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return stripeClient;
}

export const PREMIUM_MONTHLY_CREDITS = 100000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to frontend/.env.local.`);
  }
  return value;
}

/**
 * Creates a Stripe Checkout Session for the $19/month Premium plan and
 * returns its hosted URL. The Clerk user id rides along in two places:
 *
 *  - `client_reference_id` + session `metadata`: read by the webhook on
 *    `checkout.session.completed` to know which Clerk user to provision.
 *  - `subscription_data.metadata`: copied by Stripe onto the Subscription
 *    object, so every future `invoice.payment_succeeded` (monthly renewals)
 *    also carries the Clerk user id — no database lookup required.
 */
export async function createCheckoutSession(params: {
  clerkUserId: string;
  customerEmail?: string;
  existingStripeCustomerId?: string;
}): Promise<string> {
  const stripe = getStripe();
  const appUrl = requireEnv("NEXT_PUBLIC_APP_URL");

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: requireEnv("STRIPE_PREMIUM_PRICE_ID"),
        quantity: 1,
      },
    ],
    client_reference_id: params.clerkUserId,
    metadata: {
      clerk_user_id: params.clerkUserId,
    },
    subscription_data: {
      metadata: {
        clerk_user_id: params.clerkUserId,
      },
    },
    // Reuse the Stripe customer if this user has paid before; otherwise let
    // Checkout create one (we capture it in the webhook).
    ...(params.existingStripeCustomerId
      ? { customer: params.existingStripeCustomerId }
      : { customer_email: params.customerEmail }),
    allow_promotion_codes: true,
    success_url: `${appUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${appUrl}/dashboard/billing?checkout=cancelled`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout Session URL.");
  }
  return session.url;
}

/**
 * Creates a Stripe Billing Portal session and returns its hosted URL.
 * The portal lets the customer upgrade, downgrade, update payment methods,
 * view invoices, and cancel — all on Stripe-hosted pages.
 */
export async function createBillingPortalSession(
  stripeCustomerId: string
): Promise<string> {
  const stripe = getStripe();
  const appUrl = requireEnv("NEXT_PUBLIC_APP_URL");

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appUrl}/dashboard/billing`,
  });

  return session.url;
}
