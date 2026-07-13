import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Check, CreditCard, Zap } from "lucide-react";
import { getBillingMetadata } from "@/lib/credits";
import { PREMIUM_MONTHLY_CREDITS } from "@/lib/stripe";
import {
  UpgradeButton,
  ManageSubscriptionButton,
} from "@/components/billing/BillingActions";

export const dynamic = "force-dynamic";

const PREMIUM_FEATURES = [
  "100,000 text-to-voice characters every month",
  "Hyper-realistic multilingual voices (eleven_multilingual_v2)",
  "Unlimited MP3 downloads",
  "Priority audio streaming",
];

export default async function BillingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  const billing = await getBillingMetadata(userId);
  const isPremium = billing.plan === "premium";

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-16">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-brand">
            <CreditCard className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-wider">
              Billing
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            {isPremium ? "Your subscription" : "Choose your plan"}
          </h1>
          <p className="text-sm text-neutral-400">
            {isPremium
              ? "Manage your plan, payment method, and invoices below."
              : "Unlock high-volume, hyper-realistic voice generation."}
          </p>
        </header>

        {isPremium ? (
          <PremiumPanel credits={billing.credits} />
        ) : (
          <FreePricingCard />
        )}
      </div>
    </main>
  );
}

function FreePricingCard() {
  return (
    <div className="rounded-2xl border border-brand/40 bg-surface-raised p-8 shadow-xl shadow-brand/5">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-brand" />
          <h2 className="text-lg font-semibold text-white">Premium</h2>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight text-white">
            $19
          </span>
          <span className="text-sm text-neutral-400">/month</span>
        </div>
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {PREMIUM_FEATURES.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2.5 text-sm text-neutral-300"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <UpgradeButton />
      </div>

      <p className="mt-4 text-center text-xs text-neutral-500">
        Cancel anytime from your billing portal. Secured by Stripe.
      </p>
    </div>
  );
}

function PremiumPanel({ credits }: { credits: number }) {
  const usedPct = Math.min(
    100,
    Math.round(
      ((PREMIUM_MONTHLY_CREDITS - credits) / PREMIUM_MONTHLY_CREDITS) * 100
    )
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-400">
            Remaining credits
          </h2>
          <span className="rounded-full bg-brand/15 px-3 py-1 text-xs font-medium text-brand">
            Premium
          </span>
        </div>

        <p className="mt-3 text-4xl font-bold tracking-tight text-white">
          {credits.toLocaleString()}
          <span className="ml-2 text-base font-normal text-neutral-500">
            / {PREMIUM_MONTHLY_CREDITS.toLocaleString()} characters
          </span>
        </p>

        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${100 - usedPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {usedPct}% used this billing cycle. Credits reset on renewal.
        </p>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-raised p-8">
        <h2 className="text-sm font-medium text-white">
          Manage your subscription
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          Update your payment method, download invoices, or cancel — handled
          securely on Stripe&apos;s hosted portal.
        </p>
        <div className="mt-5">
          <ManageSubscriptionButton />
        </div>
      </div>
    </div>
  );
}
