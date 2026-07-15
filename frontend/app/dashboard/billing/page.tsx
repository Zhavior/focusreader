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
  "Hyper-realistic multilingual neural voices",
  "Unlimited MP3 downloads & Study Vault",
  "Chrome Extension + Voice-Controlled Brain",
  "Hyperfi Studio (PDF/DOCX + XY-Cut)",
  "Binaural soundscapes + ADHD Bionic Reading",
  "Priority audio streaming & early access",
];

const BETA_PLANS = [
  {
    id: "monthly",
    label: "Monthly Beta",
    price: "$19.99",
    per: "/mo",
    sub: "100,000 chars/mo · Cancel anytime",
    savings: null,
    strike: null,
    accent: "indigo",
    cta: "Start Monthly Beta",
  },
  {
    id: "sixmonth",
    label: "6-Month Beta",
    price: "$89.99",
    per: " once",
    sub: "≈ $15/mo · Billed once for 6 months",
    savings: "Save 25%",
    strike: "$119.94 if paid monthly",
    accent: "amber",
    cta: "Lock In 6-Month Beta",
  },
  {
    id: "twoyear",
    label: "2-Year Beta",
    price: "$199.99",
    per: " once",
    sub: "≈ $8.33/mo · Best value — 2 years locked",
    savings: "Save 58%",
    strike: "$479.76 if paid monthly",
    accent: "purple",
    cta: "Lock In 2-Year Beta Deal",
  },
];

export default async function BillingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  const billing = await getBillingMetadata(userId);
  const isPremium = billing.plan === "premium";

  return (
    <main className="relative">
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
  const accentMap: Record<string, string> = {
    indigo: "border-indigo-500/40 shadow-indigo-500/10",
    amber:  "border-amber-500/40  shadow-amber-500/10",
    purple: "border-purple-500/40 shadow-purple-500/10",
  };
  const badgeMap: Record<string, string> = {
    indigo: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
    amber:  "bg-amber-500/20  text-amber-300  border-amber-500/40",
    purple: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  };
  const ctaMap: Record<string, string> = {
    indigo: "bg-indigo-600 hover:bg-indigo-500",
    amber:  "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black",
    purple: "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500",
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
          🚀 Beta Pricing — Locked-In Rate For Life
        </span>
      </div>

      {BETA_PLANS.map((plan) => (
        <div
          key={plan.id}
          className={`rounded-2xl border bg-surface-raised p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 ${accentMap[plan.accent]}`}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeMap[plan.accent]}`}>
                BETA
              </span>
              <h3 className="text-base font-bold text-white">{plan.label}</h3>
              {plan.savings && (
                <span className="px-2 py-0.5 rounded bg-green-500/20 border border-green-500/40 text-green-300 text-[10px] font-bold">
                  {plan.savings}
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-400">{plan.sub}</p>
            {plan.strike && (
              <p className="text-xs text-neutral-600 line-through mt-0.5">{plan.strike}</p>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <span className="text-3xl font-black text-white">{plan.price}</span>
              <span className="text-sm text-neutral-400">{plan.per}</span>
            </div>
            <UpgradeButton label={plan.cta} accent={plan.accent} />
          </div>
        </div>
      ))}

      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {PREMIUM_FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-neutral-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            {feature}
          </li>
        ))}
      </ul>

      <p className="text-center text-xs text-neutral-500">
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
