"use client";

import { useCallback, useEffect, useState } from "react";

type Plan = {
  id: string;
  code: "free" | "pro" | "business";
  name: string;
  description: string;
  price_monthly: number;
  currency: string;
  limits: Record<string, number>;
  features: string[];
};

type BillingData = {
  companyId: string;
  plans: Plan[];
  subscription: {
    status: string;
    billing_mode: string;
    current_period_end: string;
    plan: Plan;
  } | null;
  usage: Record<string, number>;
  payments: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    description: string;
    created_at: string;
  }[];
  billingMode: string;
};

const metricLabels: Record<string, string> = {
  products: "Products",
  orders: "Orders",
  ai_messages: "AI messages",
  campaigns: "Campaigns",
};

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/billing", { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Unable to load billing.");

      setData(result as BillingData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function submit(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Billing action failed.");

      setNotice(result.message || "Demo usage recorded.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#0B1220] p-8 text-slate-300">Loading billing...</main>;
  }

  return (
    <main className="min-h-screen bg-[#0B1220] p-4 text-slate-100 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[3px] text-blue-400">NEXORA AI / WORKSPACE</p>
            <h1 className="mt-2 text-3xl font-bold">Billing & Subscription</h1>
            <p className="mt-2 text-sm text-slate-400">Manage your workspace plan and monitor usage.</p>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-300">
            DEMO PAYMENT MODE
          </span>
        </header>

        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
          Demo mode only. No real payment, card processing, or recurring charge is enabled. Never enter card details or payment credentials here.
        </section>

        {error && (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            {notice}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-[#111C2F] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">Current workspace plan</p>
              <h2 className="mt-1 text-2xl font-bold">{data?.subscription?.plan?.name || "Free"}</h2>
              <p className="mt-1 text-xs text-slate-400">
                Status: {data?.subscription?.status || "active"} · Demo subscription
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">
                ৳{Number(data?.subscription?.plan?.price_monthly || 0).toLocaleString("en-BD")}
              </p>
              <p className="text-xs text-slate-400">per month · simulated</p>
            </div>
          </div>
          {data?.subscription?.current_period_end && (
            <p className="mt-4 text-xs text-slate-500">
              Demo period ends: {new Date(data.subscription.current_period_end).toLocaleDateString()}
            </p>
          )}
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold">Subscription Plans</h2>
            <p className="mt-1 text-sm text-slate-400">Choose a plan for this workspace.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(data?.plans || []).map((plan) => {
              const current = data?.subscription?.plan?.code === plan.code;
              return (
                <article key={plan.id} className={`rounded-2xl border p-5 ${current ? "border-blue-500 bg-blue-500/10" : "border-slate-800 bg-[#111C2F]"}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    {current && <span className="rounded-full bg-blue-500/20 px-2 py-1 text-xs text-blue-300">Current</span>}
                  </div>
                  <p className="mt-2 min-h-10 text-sm text-slate-400">{plan.description}</p>
                  <p className="my-5 text-3xl font-bold">
                    ৳{Number(plan.price_monthly).toLocaleString("en-BD")}
                    <span className="text-sm font-normal text-slate-400"> / month</span>
                  </p>
                  <ul className="mb-6 space-y-2 text-sm text-slate-300">
                    {plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
                  </ul>
                  <div className="mb-4 space-y-1 text-xs text-slate-400">
                    {Object.entries(plan.limits || {}).map(([key, value]) => (
                      <p key={key}>{metricLabels[key] || key}: {Number(value).toLocaleString()}</p>
                    ))}
                  </div>
                  <button
                    disabled={busy || current}
                    onClick={() => void submit({ action: "change_plan", planCode: plan.code })}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {current ? "Current Plan" : busy ? "Please wait..." : `Select ${plan.name} · Demo`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#111C2F] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">Usage Tracking</h2>
              <p className="mt-1 text-sm text-slate-400">Recorded demo usage during the last 30 days.</p>
            </div>
            <button onClick={() => void load()} className="rounded-lg border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800">
              Refresh
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(metricLabels).map(([key, label]) => {
              const used = data?.usage?.[key] || 0;
              const limit = data?.subscription?.plan?.limits?.[key] || 0;
              const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
              return (
                <div key={key} className="rounded-xl border border-slate-800 bg-[#0B1220] p-4">
                  <p className="text-sm text-slate-400">{label}</p>
                  <p className="mt-2 text-2xl font-bold">{used.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-slate-500">Plan limit: {limit.toLocaleString()}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5">
            <p className="mb-3 text-sm font-semibold">Add demo usage event</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metricLabels).map(([metric, label]) => (
                <button
                  key={metric}
                  disabled={busy}
                  onClick={() => void submit({ action: "record_usage", metric, quantity: 1 })}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-blue-500 hover:text-white disabled:opacity-50"
                >
                  +1 {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#111C2F] p-5">
          <h2 className="text-xl font-bold">Payment History</h2>
          <p className="mt-1 text-sm text-slate-400">Simulated records only. No money was collected.</p>
          <div className="mt-4 space-y-3">
            {!data?.payments?.length && <p className="text-sm text-slate-500">No demo payment records yet.</p>}
            {(data?.payments || []).map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 text-sm last:border-0">
                <div>
                  <p className="font-medium">{payment.description}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(payment.created_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">৳{Number(payment.amount).toLocaleString("en-BD")}</p>
                  <p className="text-xs text-amber-300">Simulated</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
