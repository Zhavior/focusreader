"use client";

import { useCallback, useState } from "react";
import { Loader2, Sparkles, Settings2, TriangleAlert } from "lucide-react";

function useBillingRedirect(endpoint: string, payload?: Record<string, any>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Something went wrong.");
      }
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }, [endpoint, payload]);

  return { go, loading, error };
}

export function UpgradeButton({ label, accent, tier, priceId }: { label?: string; accent?: string; tier?: string; priceId?: string }) {
  const { go, loading, error } = useBillingRedirect("/api/billing/checkout", { tier, priceId });

  const accentClass =
    accent === "amber"
      ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black"
      : accent === "purple"
      ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
      : "bg-brand hover:bg-brand-hover text-white";

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={go}
        disabled={loading}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${accentClass}`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {loading ? "Redirecting to checkout..." : (label ?? "Upgrade to Premium")}
      </button>
      {error && <BillingError message={error} />}
    </div>
  );
}

export function ManageSubscriptionButton() {
  const { go, loading, error } = useBillingRedirect("/api/billing/portal");

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={go}
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-xl border border-surface-border px-5 py-3 text-sm font-medium text-neutral-200 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Settings2 className="h-4 w-4" />
        )}
        {loading ? "Opening portal..." : "Manage Subscription / Cancel"}
      </button>
      {error && <BillingError message={error} />}
    </div>
  );
}

function BillingError({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-red-400">
      <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}
