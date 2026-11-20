"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Campaign = {
  id: string;
  name: string;
  objective: string;
  channel: string;
  status: "draft" | "active" | "paused" | "completed";
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  start_date: string | null;
  end_date: string | null;
  notes: string;
};

const initialForm = {
  name: "", objective: "awareness", channel: "facebook",
  status: "draft", budget: "0", spend: "0",
  impressions: "0", clicks: "0", conversions: "0",
  revenue: "0", start_date: "", end_date: "", notes: "",
};

const money = (value: number) =>
  `৳${Number(value || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

export default function CampaignsPage() {
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState<Campaign[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    const data = await request(`/api/campaigns?company_id=${encodeURIComponent(id)}`);
    setItems(data as Campaign[]);
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
        if (alive) setError(e instanceof Error ? e.message : "Could not load workspace.");
      }
    }
    void init();
    return () => { alive = false; };
  }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId) return;
    setBusy(true);
    setError("");

    try {
      const payload = {
        company_id: companyId,
        ...form,
        budget: Number(form.budget),
        spend: Number(form.spend),
        impressions: Number(form.impressions),
        clicks: Number(form.clicks),
        conversions: Number(form.conversions),
        revenue: Number(form.revenue),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };

      await request(editing ? `/api/campaigns/${editing}` : "/api/campaigns", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      setForm(initialForm);
      setEditing(null);
      await load(companyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save campaign.");
    } finally {
      setBusy(false);
    }
  };

  const edit = (item: Campaign) => {
    setEditing(item.id);
    setForm({
      name: item.name,
      objective: item.objective,
      channel: item.channel,
      status: item.status,
      budget: String(item.budget),
      spend: String(item.spend),
      impressions: String(item.impressions),
      clicks: String(item.clicks),
      conversions: String(item.conversions),
      revenue: String(item.revenue),
      start_date: item.start_date || "",
      end_date: item.end_date || "",
      notes: item.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this campaign permanently?")) return;
    try {
      await request(`/api/campaigns/${id}?company_id=${companyId}`, { method: "DELETE" });
      await load(companyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  const field = (label: string, key: keyof typeof initialForm, type = "text") => (
    <label className="block text-sm text-slate-400">
      {label}
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((old) => ({ ...old, [key]: e.target.value }))}
        required={key === "name"}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "any" : undefined}
        className="mt-1 w-full rounded-lg border border-[#243149] bg-[#0D1422] px-3 py-2.5 text-white outline-none focus:border-blue-500"
      />
    </label>
  );

  const select = (label: string, key: "objective" | "channel" | "status", options: string[]) => (
    <label className="block text-sm text-slate-400">
      {label}
      <select
        value={form[key]}
        onChange={(e) => setForm((old) => ({ ...old, [key]: e.target.value }))}
        className="mt-1 w-full rounded-lg border border-[#243149] bg-[#0D1422] px-3 py-2.5 text-white"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
        ))}
      </select>
    </label>
  );

  return (
    <main className="min-h-screen space-y-6 bg-[#080D18] p-4 text-white sm:p-8">
      <header>
        <p className="text-sm text-blue-400">NEXORA AI / MARKETING</p>
        <h1 className="mt-2 text-3xl font-bold">Campaigns</h1>
        <p className="mt-2 text-sm text-slate-400">Create, manage and track your marketing campaigns.</p>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <section className="rounded-2xl border border-[#243149] bg-[#111C2F] p-5">
        <h2 className="mb-5 text-lg font-bold">{editing ? "Edit Campaign" : "Create Campaign"}</h2>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("Campaign name", "name")}
          {select("Objective", "objective", ["awareness", "traffic", "leads", "sales", "engagement"])}
          {select("Channel", "channel", ["facebook", "instagram", "google", "tiktok", "youtube", "email", "other"])}
          {select("Status", "status", ["draft", "active", "paused", "completed"])}
          {field("Budget (BDT)", "budget", "number")}
          {field("Spend (BDT)", "spend", "number")}
          {field("Impressions", "impressions", "number")}
          {field("Clicks", "clicks", "number")}
          {field("Conversions", "conversions", "number")}
          {field("Revenue (BDT)", "revenue", "number")}
          {field("Start date", "start_date", "date")}
          {field("End date", "end_date", "date")}
          <label className="block text-sm text-slate-400 sm:col-span-2 lg:col-span-3">
            Notes
            <textarea
              value={form.notes}
              onChange={(e) => setForm((old) => ({ ...old, notes: e.target.value }))}
              maxLength={5000}
              rows={3}
              className="mt-1 w-full rounded-lg border border-[#243149] bg-[#0D1422] px-3 py-2.5 text-white"
            />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3">
            <button disabled={busy} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">
              {busy ? "Saving..." : editing ? "Update Campaign" : "Create Campaign"}
            </button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(initialForm); }} className="rounded-lg border border-[#334155] px-5 py-2.5 text-sm">Cancel</button>}
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Campaign List ({items.length})</h2>
        {items.length === 0 ? (
          <div className="rounded-xl border border-[#243149] bg-[#111C2F] p-8 text-center text-slate-400">No campaigns yet. Create your first campaign above.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <article key={item.id} className="rounded-xl border border-[#243149] bg-[#111C2F] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{item.name}</h3>
                    <p className="mt-1 text-xs capitalize text-slate-400">{item.channel} · {item.objective}</p>
                  </div>
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs capitalize text-blue-300">{item.status}</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <p className="text-slate-400">Budget <strong className="block text-white">{money(item.budget)}</strong></p>
                  <p className="text-slate-400">Spend <strong className="block text-white">{money(item.spend)}</strong></p>
                  <p className="text-slate-400">Clicks <strong className="block text-white">{item.clicks.toLocaleString()}</strong></p>
                  <p className="text-slate-400">Conversions <strong className="block text-white">{item.conversions.toLocaleString()}</strong></p>
                  <p className="text-slate-400">Impressions <strong className="block text-white">{item.impressions.toLocaleString()}</strong></p>
                  <p className="text-slate-400">Revenue <strong className="block text-white">{money(item.revenue)}</strong></p>
                </div>
                {item.notes && <p className="mt-4 border-t border-[#243149] pt-3 text-sm text-slate-400">{item.notes}</p>}
                <div className="mt-5 flex gap-3 border-t border-[#243149] pt-4">
                  <button onClick={() => edit(item)} className="text-sm font-semibold text-blue-400">Edit</button>
                  <button onClick={() => void remove(item.id)} className="text-sm font-semibold text-red-400">Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
