"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AnalyticsData = {
  metrics: {
    totalOrders: number;
    totalCustomers: number;
    deliveredOrders: number;
    totalRevenue: number;
    campaignCount: number;
    activeCampaigns: number;
    campaignBudget: number;
    campaignSpend: number;
    campaignRevenue: number;
    impressions: number;
    clicks: number;
    conversions: number;
  };
  daily: Array<{ date: string; orders: number; revenue: number }>;
  orderStatuses: Array<{ status: string; count: number }>;
  campaigns: Array<{
    id: string; status: string; budget: number; spend: number;
    impressions: number; clicks: number; conversions: number; revenue: number;
  }>;
};

const money = (value: number) =>
  `৳${Number(value || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in first.");

      const { data: memberships, error: membershipError } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(2);

      if (membershipError) throw membershipError;
      if (!memberships?.length) throw new Error("Active workspace not found.");
      if (memberships.length > 1) throw new Error("Multiple workspaces found.");

      const response = await fetch(
        `/api/analytics?company_id=${encodeURIComponent(memberships[0].company_id)}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Analytics could not load.");
      setData(result.data as AnalyticsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analytics could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const metrics = data?.metrics;
  const cards = [
    ["Total Revenue", money(metrics?.totalRevenue || 0)],
    ["Total Orders", (metrics?.totalOrders || 0).toLocaleString()],
    ["Customers", (metrics?.totalCustomers || 0).toLocaleString()],
    ["Delivered Orders", (metrics?.deliveredOrders || 0).toLocaleString()],
    ["Campaigns", (metrics?.campaignCount || 0).toLocaleString()],
    ["Active Campaigns", (metrics?.activeCampaigns || 0).toLocaleString()],
    ["Campaign Budget", money(metrics?.campaignBudget || 0)],
    ["Campaign Spend", money(metrics?.campaignSpend || 0)],
    ["Campaign Revenue", money(metrics?.campaignRevenue || 0)],
    ["Impressions", (metrics?.impressions || 0).toLocaleString()],
    ["Clicks", (metrics?.clicks || 0).toLocaleString()],
    ["Conversions", (metrics?.conversions || 0).toLocaleString()],
  ];

  const maxRevenue = Math.max(1, ...(data?.daily.map((day) => day.revenue) || [0]));

  return (
    <main className="min-h-screen space-y-6 bg-[#080D18] p-4 text-white sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-blue-400">NEXORA AI / REPORTS</p>
          <h1 className="mt-2 text-3xl font-bold">Analytics</h1>
          <p className="mt-2 text-sm text-slate-400">Business performance and campaign insights.</p>
        </div>
        <button onClick={() => { setLoading(true); setError(""); void load(); }} className="rounded-lg border border-[#334155] px-4 py-2 text-sm hover:bg-[#111C2F]">Refresh</button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {loading && <p className="text-sm text-slate-400">Loading analytics...</p>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-xl border border-[#243149] bg-[#111C2F] p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-3 text-2xl font-bold">{loading ? "—" : value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-xl border border-[#243149] bg-[#111C2F] p-5">
          <h2 className="font-bold">Last 7 Days Revenue</h2>
          <p className="mt-1 text-xs text-slate-500">Delivered orders grouped by order creation date</p>
          <div className="mt-6 space-y-4">
            {data?.daily.map((day) => (
              <div key={day.date}>
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>{new Date(`${day.date}T00:00:00`).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}</span>
                  <span>{money(day.revenue)} · {day.orders} orders</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#0D1422]">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${(day.revenue / maxRevenue) * 100}%` }} />
                </div>
              </div>
            ))}
            {!data?.daily.length && !loading && <p className="text-sm text-slate-500">No daily data available.</p>}
          </div>
        </article>

        <article className="rounded-xl border border-[#243149] bg-[#111C2F] p-5">
          <h2 className="font-bold">Order Status</h2>
          <div className="mt-5 space-y-4">
            {data?.orderStatuses.map((item) => (
              <div key={item.status} className="flex items-center justify-between border-b border-[#243149] pb-3 text-sm">
                <span className="capitalize text-slate-300">{item.status.replaceAll("_", " ")}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
            {!data?.orderStatuses.length && !loading && <p className="text-sm text-slate-500">No orders found.</p>}
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-[#243149] bg-[#111C2F] p-5">
        <h2 className="font-bold">Campaign Performance</h2>
        <p className="mt-1 text-xs text-slate-500">Aggregated campaign metrics entered in Campaigns</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="pb-3">Status</th>
                <th className="pb-3">Budget</th>
                <th className="pb-3">Spend</th>
                <th className="pb-3">Clicks</th>
                <th className="pb-3">Conversions</th>
                <th className="pb-3">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#243149]">
              {data?.campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="py-3 capitalize">{campaign.status}</td>
                  <td className="py-3">{money(campaign.budget)}</td>
                  <td className="py-3">{money(campaign.spend)}</td>
                  <td className="py-3">{campaign.clicks.toLocaleString()}</td>
                  <td className="py-3">{campaign.conversions.toLocaleString()}</td>
                  <td className="py-3">{money(campaign.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.campaigns.length && !loading && <p className="py-5 text-center text-sm text-slate-500">No campaign data yet.</p>}
        </div>
      </section>
    </main>
  );
}
