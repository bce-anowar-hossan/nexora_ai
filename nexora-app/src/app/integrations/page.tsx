"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Provider =
  | "shopify" | "woocommerce" | "facebook" | "instagram"
  | "google_ads" | "stripe" | "whatsapp" | "slack";

type Integration = {
  id: string;
  provider: Provider;
  status: "connected" | "disconnected";
  connection_mode: "demo";
};

const catalog: { id: Provider; name: string; category: string; description: string }[] = [
  { id: "shopify", name: "Shopify", category: "E-commerce", description: "Store and order workflow integration." },
  { id: "woocommerce", name: "WooCommerce", category: "E-commerce", description: "Connect an online store workflow." },
  { id: "facebook", name: "Facebook", category: "Social", description: "Social page workflow integration." },
  { id: "instagram", name: "Instagram", category: "Social", description: "Social content workflow integration." },
  { id: "google_ads", name: "Google Ads", category: "Marketing", description: "Advertising campaign workflow." },
  { id: "stripe", name: "Stripe", category: "Payments", description: "Payment workflow integration." },
  { id: "whatsapp", name: "WhatsApp", category: "Messaging", description: "Customer messaging workflow." },
  { id: "slack", name: "Slack", category: "Productivity", description: "Team notification workflow." },
];

export default function IntegrationsPage() {
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState<Integration[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "Request failed.");
    }
    return result.data;
  }, []);

  const load = useCallback(async (id: string) => {
    const result = await request(`/api/integrations?company_id=${encodeURIComponent(id)}`);
    setItems(result as Integration[]);
  }, [request]);

  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Please sign in first.");

        const { data, error: membershipError } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(2);

        if (membershipError) throw membershipError;
        if (!data?.length) throw new Error("Active workspace not found.");
        if (data.length > 1) throw new Error("Multiple workspaces found.");

        if (!alive) return;
        setCompanyId(data[0].company_id);
        await load(data[0].company_id);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load integrations.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void init();
    return () => { alive = false; };
  }, [load]);

  const connect = async (provider: Provider) => {
    setBusy(provider);
    setError("");
    try {
      await request("/api/integrations", {
        method: "POST",
        body: JSON.stringify({ company_id: companyId, provider }),
      });
      await load(companyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect integration.");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (item: Integration) => {
    setBusy(item.provider);
    setError("");
    try {
      await request(`/api/integrations/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          company_id: companyId,
          status: item.status === "connected" ? "disconnected" : "connected",
        }),
      });
      await load(companyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update integration.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (item: Integration) => {
    if (!window.confirm(`Remove ${item.provider} integration?`)) return;
    setBusy(item.provider);
    setError("");
    try {
      await request(`/api/integrations/${item.id}?company_id=${encodeURIComponent(companyId)}`, {
        method: "DELETE",
      });
      await load(companyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove integration.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="min-h-screen space-y-6 bg-[#080D18] p-4 text-white sm:p-8">
      <header>
        <p className="text-sm text-blue-400">NEXORA AI / WORKSPACE</p>
        <h1 className="mt-2 text-3xl font-bold">Integrations</h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage services connected to your workspace.
        </p>
      </header>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        Demo mode: connection records are simulated. Real provider authorization and data sync are not enabled yet. Never enter API keys or passwords here.
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading integrations...</p>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {catalog.map((provider) => {
            const item = items.find((entry) => entry.provider === provider.id);
            const connected = item?.status === "connected";

            return (
              <article key={provider.id} className="flex flex-col rounded-xl border border-[#243149] bg-[#111C2F] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-blue-400">{provider.category}</p>
                    <h2 className="mt-2 text-lg font-bold">{provider.name}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs ${connected ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-700/60 text-slate-300"}`}>
                    {connected ? "Connected · Demo" : item ? "Disconnected" : "Not connected"}
                  </span>
                </div>

                <p className="mt-3 min-h-10 text-sm text-slate-400">{provider.description}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {!item ? (
                    <button
                      disabled={busy !== null}
                      onClick={() => void connect(provider.id)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                    >
                      {busy === provider.id ? "Connecting..." : "Connect Demo"}
                    </button>
                  ) : (
                    <>
                      <button
                        disabled={busy !== null}
                        onClick={() => void toggle(item)}
                        className="rounded-lg border border-[#40516B] px-4 py-2 text-sm hover:bg-[#1A2940] disabled:opacity-50"
                      >
                        {busy === provider.id ? "Updating..." : connected ? "Disconnect" : "Reconnect Demo"}
                      </button>
                      <button
                        disabled={busy !== null}
                        onClick={() => void remove(item)}
                        className="rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
