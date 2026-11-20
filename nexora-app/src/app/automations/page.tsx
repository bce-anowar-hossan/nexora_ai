"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Trigger = "manual" | "schedule" | "order_created" | "customer_created";
type Action = "demo_notification" | "demo_order_update" | "demo_customer_tag";
type Automation = {
  id: string;
  title: string;
  description: string | null;
  trigger_type: Trigger;
  action_type: Action;
  status: "active" | "paused";
  created_at: string;
};
type Run = {
  id: string;
  automation_id: string;
  status: string;
  result: { message?: string } | null;
  started_at: string;
};

const triggers: { value: Trigger; label: string }[] = [
  { value: "manual", label: "Manual Run" },
  { value: "schedule", label: "Scheduled Trigger (Demo)" },
  { value: "order_created", label: "New Order (Demo)" },
  { value: "customer_created", label: "New Customer (Demo)" },
];
const actions: { value: Action; label: string }[] = [
  { value: "demo_notification", label: "Create Demo Notification" },
  { value: "demo_order_update", label: "Demo Order Update" },
  { value: "demo_customer_tag", label: "Demo Customer Tag" },
];

export default function AutomationsPage() {
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState<Trigger>("manual");
  const [action, setAction] = useState<Action>("demo_notification");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "Request failed.");
    return json.data;
  }, []);

  const load = useCallback(async (id: string) => {
    const [automationData, runData] = await Promise.all([
      request(`/api/automations?company_id=${id}`),
      request(`/api/automation-runs?company_id=${id}`),
    ]);
    setItems(automationData as Automation[]);
    setRuns(runData as Run[]);
  }, [request]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
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
        if (!data?.length) throw new Error("No active company membership found.");
        if (data.length > 1) throw new Error("Multiple companies found. Select an active company first.");
        if (!cancelled) {
          setCompanyId(data[0].company_id);
          try {
            const [automationData, runData] = await Promise.all([
              request(`/api/automations?company_id=${data[0].company_id}`),
              request(`/api/automation-runs?company_id=${data[0].company_id}`),
            ]);
            if (!cancelled) {
              setItems(automationData as Automation[]);
              setRuns(runData as Run[]);
            }
          } catch (e) {
            if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load automations.");
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to initialize workspace.");
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, [request]);

  const createAutomation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await request("/api/automations", {
        method: "POST",
        body: JSON.stringify({
          company_id: companyId, title, description: description || null,
          trigger_type: trigger, action_type: action, status: "active",
        }),
      });
      setTitle(""); setDescription("");
      await load(companyId);
      setMessage("Automation created successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create automation.");
    } finally { setBusy(false); }
  };

  const updateStatus = async (item: Automation) => {
    setError(""); setMessage("");
    try {
      await request(`/api/automations/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          company_id: companyId,
          status: item.status === "active" ? "paused" : "active",
        }),
      });
      await load(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed."); }
  };

  const runAutomation = async (item: Automation) => {
    setError(""); setMessage("");
    try {
      await request(`/api/automations/${item.id}/run`, {
        method: "POST",
        body: JSON.stringify({ company_id: companyId }),
      });
      await load(companyId);
      setMessage("Demo run completed. Check execution history.");
    } catch (e) { setError(e instanceof Error ? e.message : "Demo run failed."); }
  };

  const deleteAutomation = async (item: Automation) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setError(""); setMessage("");
    try {
      await request(`/api/automations/${item.id}?company_id=${companyId}`, { method: "DELETE" });
      await load(companyId);
      setMessage("Automation deleted.");
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 text-slate-100 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">NEXORA AI / WORKSPACE</p>
          <h1 className="mt-2 text-3xl font-bold">Automation Center</h1>
          <p className="mt-1 text-sm text-slate-400">Build workflows and review their execution history.</p>
        </div>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">DEMO ENGINE</span>
      </header>

      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {message && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</p>}

      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form onSubmit={createAutomation} className="h-fit space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Create Workflow</h2>
          <input required minLength={2} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="Workflow name" className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3" />
          <textarea maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3" />
          <label className="block space-y-1 text-sm text-slate-400">Trigger
            <select value={trigger} onChange={e => setTrigger(e.target.value as Trigger)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-slate-100">
              {triggers.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="block space-y-1 text-sm text-slate-400">Action
            <select value={action} onChange={e => setAction(e.target.value as Action)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-slate-100">
              {actions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>
          <button disabled={busy || !companyId} className="w-full rounded-lg bg-violet-600 p-3 font-semibold disabled:opacity-50">{busy ? "Saving..." : "Create Automation"}</button>
        </form>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Workflow Library ({items.length})</h2>
          {items.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No workflows yet. Create your first automation.</p>}
          {items.map(item => (
            <article key={item.id} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  {item.description && <p className="mt-1 text-sm text-slate-400">{item.description}</p>}
                </div>
                <span className={`rounded-full px-2 py-1 text-xs ${item.status === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>{item.status}</span>
              </div>
              <p className="text-xs text-slate-400">Trigger: {triggers.find(t => t.value === item.trigger_type)?.label} · Action: {actions.find(a => a.value === item.action_type)?.label}</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void runAutomation(item)} disabled={item.status !== "active"} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold disabled:opacity-40">Run Demo</button>
                <button onClick={() => void updateStatus(item)} className="rounded-lg bg-slate-700 px-3 py-2 text-xs"> {item.status === "active" ? "Pause" : "Activate"} </button>
                <button onClick={() => void deleteAutomation(item)} className="rounded-lg bg-red-950 px-3 py-2 text-xs text-red-300">Delete</button>
              </div>
            </article>
          ))}
        </section>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Execution History</h2>
          <span className="text-xs text-slate-500">{runs.length} runs</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-900 text-slate-400"><tr><th className="p-3">Workflow</th><th className="p-3">Status</th><th className="p-3">Time</th><th className="p-3">Result</th></tr></thead>
            <tbody>
              {runs.map(run => <tr key={run.id} className="border-t border-slate-800">
                <td className="p-3">{items.find(item => item.id === run.automation_id)?.title || "Workflow"}</td>
                <td className="p-3 text-emerald-300">{run.status}</td>
                <td className="p-3 text-slate-400">{new Date(run.started_at).toLocaleString()}</td>
                <td className="max-w-xs p-3 text-xs text-slate-400">{run.result?.message || "Demo run"}</td>
              </tr>)}
              {runs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No execution history yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">Demo only: triggers are stored as workflow settings. No background scheduler, external notification, or real order/customer changes are performed.</p>
      </section>
    </main>
  );
}
