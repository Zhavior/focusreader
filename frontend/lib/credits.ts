import { clerkClient } from "@clerk/nextjs/server";

/** Characters granted to every new account as a free trial. */
export const SIGNUP_BONUS_CREDITS = 5000;
import {
  getCreditBalance,
  grantCredits,
  spendCredits,
  hasLedgerHistory,
} from "@/lib/db";

/**
 * Billing identity kept in Clerk's PRIVATE user metadata: plan tier and
 * Stripe ids. Credit BALANCES no longer live here — they moved to the SQLite
 * ledger (lib/db.ts), which supports atomic spends and idempotent grants.
 * A `credits` field may still exist on older users' metadata; it is migrated
 * into the ledger on first read and never written again.
 */
export interface BillingMetadata {
  plan: "free" | "premium";
  credits: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  creditsGrantedAt?: string;
  lastInvoiceId?: string;
  canceledAt?: string;
}

export async function getBillingMetadata(
  clerkUserId: string
): Promise<BillingMetadata> {
  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);
  const raw = user.privateMetadata?.billing as
    | Partial<BillingMetadata>
    | undefined;

  // One-time migration: users provisioned before the ledger existed have
  // their balance in Clerk metadata. Seed the ledger from it exactly once
  // (guarded by the ledger's unique (reason, ref) index).
  const legacyCredits = typeof raw?.credits === "number" ? raw.credits : 0;
  if (legacyCredits > 0 && !hasLedgerHistory(clerkUserId)) {
    grantCredits(clerkUserId, legacyCredits, "migration", `clerk:${clerkUserId}`);
  }

  // Free trial: brand-new users get a starter allowance so they can hear the
  // product before paying. Idempotent per user via the (reason, ref) index.
  if (!hasLedgerHistory(clerkUserId)) {
    grantCredits(
      clerkUserId,
      SIGNUP_BONUS_CREDITS,
      "signup_bonus",
      `signup:${clerkUserId}`
    );
  }

  return {
    plan: raw?.plan === "premium" ? "premium" : "free",
    credits: getCreditBalance(clerkUserId),
    stripeCustomerId: raw?.stripeCustomerId,
    stripeSubscriptionId: raw?.stripeSubscriptionId,
    creditsGrantedAt: raw?.creditsGrantedAt,
    lastInvoiceId: raw?.lastInvoiceId,
    canceledAt: raw?.canceledAt,
  };
}

/** Persists plan/identity fields to Clerk. Balances belong to the ledger. */
export async function setBillingMetadata(
  clerkUserId: string,
  billing: Omit<BillingMetadata, "credits"> & { credits?: number }
): Promise<void> {
  const client = await clerkClient();
  const { credits: _ignored, ...identity } = billing;
  await client.users.updateUserMetadata(clerkUserId, {
    privateMetadata: { billing: identity },
  });
}

/**
 * Atomically deducts credits via the ledger. Returns the new balance, or
 * null when the balance is insufficient (nothing is written in that case).
 */
export async function deductCredits(
  clerkUserId: string,
  amount: number,
  ref: string
): Promise<number | null> {
  return spendCredits(clerkUserId, amount, ref);
}
