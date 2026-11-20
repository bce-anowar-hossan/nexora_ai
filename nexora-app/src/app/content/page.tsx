"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "draft" | "scheduled" | "published";
type Platform = "facebook" | "instagram" | "tiktok" | "youtube" | "linkedin" | "other";
type Content = {
  id: string; title: string; caption: string; body: string; media_url: string | null;
  platform: Platform; status: Status; scheduled_at: string | null; published_at: string | null;
  social_account_id: string | null; created_at: string;
};
type Account = { id: string; platform: Platform; display_name: string; handle: string | null; status: string };

const platforms: Platform[] = ["facebook","instagram","tiktok","youtube","linkedin","other"];
const statusLabels: Record<Status,string> = { draft: "Draft", scheduled: "Scheduled", published: "Published" };

export default function ContentPage() {
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState<Content[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"content"|"calendar"|"accounts">("content");
  const [month, setMonth] = useState(() => new Date(2026, 10, 1));
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", caption: "", body: "", media_url: "", platform: "facebook" as Platform,
    status: "draft" as Status, scheduled_at: "", social_account_id: "",
  });
  const [accountForm, setAccountForm] = useState({
    platform: "facebook" as Platform, display_name: "", handle: "",
  });

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "Request failed.");
    return result.data;
  }, []);

  const load = useCallback(async (id: string) => {
    const [content, social] = await Promise.all([
      request(`/api/content?company_id=${id}`),
      request(`/api/social-accounts?company_id=${id}`),
    ]);
    setItems(content);
    setAccounts(social);
  }, [request]);

  useEffect(() => {
    let alive = true;
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (alive) setError("Please sign in first."); return; }
      const { data, error: membershipError } = await supabase.from("company_members")
        .select("company_id").eq("user_id", user.id).eq("status","active").limit(2);
      if (membershipError || !data?.length) { if (alive) setError("Active workspace not found."); return; }
      if (data.length > 1) { if (alive) setError("Multiple workspaces found. Open this page from a selected workspace."); return; }
      if (!alive) return;
      setCompanyId(data[0].company_id);
      try { await load(data[0].company_id); }
      catch (e) { if (alive) setError(e instanceof Error ? e.message : "Could not load content."); }
    }
    void init();
    return () => { alive = false; };
  }, [load]);

  const resetForm = () => {
    setEditing(null);
    setForm({ title:"", caption:"", body:"", media_url:"", platform:"facebook", status:"draft", scheduled_at:"", social_account_id:"" });
  };

  const saveContent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyId) return;
    setBusy(true); setError("");
    try {
      const scheduledInput = form.scheduled_at.trim();
      let scheduledAt: string | null = null;

      if (form.status === "scheduled") {
        if (!scheduledInput) {
          throw new Error("Scheduled date and time are required.");
        }

        const parsedDate = new Date(scheduledInput);
        if (Number.isNaN(parsedDate.getTime())) {
          throw new Error("Invalid scheduled date or time.");
        }

        scheduledAt = parsedDate.toISOString();
      }

      const payload = {
        company_id: companyId, ...form,
        media_url: form.media_url || null,
        social_account_id: form.social_account_id || null,
        scheduled_at: scheduledAt,
      };
      if (editing) {
        await request(`/api/content/${editing}`, { method:"PATCH", body:JSON.stringify(payload) });
      } else {
        await request("/api/content", { method:"POST", body:JSON.stringify(payload) });
      }
      resetForm();
      await load(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    finally { setBusy(false); }
  };

  const editContent = (item: Content) => {
    setEditing(item.id);
    setForm({
      title:item.title, caption:item.caption || "", body:item.body || "",
      media_url:item.media_url || "", platform:item.platform, status:item.status,
      scheduled_at:item.scheduled_at
        ? (() => {
            const d = new Date(item.scheduled_at);
            const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
            return local.toISOString().slice(0, 16);
          })()
        : "",
      social_account_id:item.social_account_id || "",
    });
    setTab("content");
  };

  const deleteContent = async (id: string) => {
    if (!companyId || !window.confirm("Delete this content permanently?")) return;
    setError("");
    try { await request(`/api/content/${id}?company_id=${companyId}`, { method:"DELETE" }); await load(companyId); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
  };

  const changeStatus = async (item: Content, status: Status) => {
    if (!companyId) return;
    const scheduled = status === "scheduled"
      ? item.scheduled_at || new Date(Date.now() + 3600000).toISOString() : null;
    try {
      await request(`/api/content/${item.id}`, {
        method:"PATCH",
        body:JSON.stringify({ company_id:companyId, status, scheduled_at:scheduled }),
      });
      await load(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : "Status update failed."); }
  };

  const addAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await request("/api/social-accounts", {
        method:"POST", body:JSON.stringify({ company_id:companyId, ...accountForm }),
      });
      setAccountForm({ platform:"facebook", display_name:"", handle:"" });
      await load(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add account."); }
  };

  const removeAccount = async (id: string) => {
    if (!window.confirm("Remove this social account?")) return;
    try { await request(`/api/social-accounts?company_id=${companyId}&id=${id}`, { method:"DELETE" }); await load(companyId); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not remove account."); }
  };

  const monthDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length:42 }, (_,i) => {
      const day = new Date(start); day.setDate(start.getDate()+i); return day;
    });
  }, [month]);

  const calendarItems = (day: Date) => items.filter(item => {
    const date = item.scheduled_at || item.published_at || (item.status === "draft" ? item.created_at : null);
    if (!date) return false;
    const d = new Date(date);
    return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
  });

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-violet-300">NEXORA AI / WORKSPACE</p>
            <h1 className="text-3xl font-bold">Content Studio</h1>
            <p className="mt-1 text-sm text-slate-400">Plan, organize and manage your social content.</p>
          </div>
          <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">DEMO MODE</span>
        </header>

        {error && <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        <nav className="flex flex-wrap gap-2">
          {(["content","calendar","accounts"] as const).map(value => (
            <button key={value} onClick={() => setTab(value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium capitalize ${tab===value ? "bg-violet-600" : "bg-slate-800 hover:bg-slate-700"}`}>
              {value === "content" ? "Content & Captions" : value === "calendar" ? "Content Calendar" : "Social Accounts"}
            </button>
          ))}
        </nav>

        {tab === "content" && <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <form noValidate onSubmit={saveContent} className="h-fit space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold">{editing ? "Edit Content" : "Create Content"}</h2>
            <input required maxLength={200} placeholder="Content title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3" />
            <select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value as Platform})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3">
              {platforms.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.social_account_id} onChange={e=>setForm({...form,social_account_id:e.target.value})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3">
              <option value="">No linked account</option>
              {accounts.filter(a=>a.platform===form.platform && a.status==="active").map(a=><option key={a.id} value={a.id}>{a.display_name} {a.handle ? `(${a.handle})` : ""}</option>)}
            </select>
            <textarea rows={4} maxLength={10000} placeholder="Caption" value={form.caption} onChange={e=>setForm({...form,caption:e.target.value})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3" />
            <textarea rows={3} maxLength={20000} placeholder="Additional content / notes" value={form.body} onChange={e=>setForm({...form,body:e.target.value})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3" />
            <input type="url" placeholder="Media URL (optional)" value={form.media_url} onChange={e=>setForm({...form,media_url:e.target.value})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3" />
            <select value={form.status} onChange={e=>setForm({...form,status:e.target.value as Status})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3">
              <option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published (Demo)</option>
            </select>
            {form.status==="scheduled" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm">
                  <span>Date</span>
                  <input type="date" required value={form.scheduled_at.slice(0,10)}
                    onChange={e=>setForm({...form,scheduled_at:e.target.value ? `${e.target.value}T${form.scheduled_at.slice(11,16) || "09:00"}` : ""})}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3" />
                </label>
                <label className="space-y-1 text-sm">
                  <span>Time</span>
                  <input type="time" required value={form.scheduled_at.slice(11,16)}
                    onChange={e=>setForm({...form,scheduled_at:form.scheduled_at.slice(0,10) && e.target.value ? `${form.scheduled_at.slice(0,10)}T${e.target.value}` : ""})}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3" />
                </label>
              </div>
            )}
            <div className="flex gap-2">
              <button disabled={busy} className="flex-1 rounded-lg bg-violet-600 p-3 font-semibold disabled:opacity-50">{busy ? "Saving..." : editing ? "Update Content" : "Save Content"}</button>
              {editing && <button type="button" onClick={resetForm} className="rounded-lg bg-slate-700 px-3">Cancel</button>}
            </div>
            <p className="text-xs text-slate-500">Media is stored as a URL reference. No file upload or real social publishing is performed.</p>
          </form>

          <section className="space-y-3">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Content Library</h2><span className="text-sm text-slate-400">{items.length} items</span></div>
            {items.length===0 && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">No content yet. Create your first post.</div>}
            {items.map(item=><article key={item.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h3 className="font-semibold">{item.title}</h3><p className="text-xs capitalize text-slate-400">{item.platform} · {statusLabels[item.status]}</p></div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={()=>editContent(item)} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs">Edit</button>
                  {item.status!=="published" && <button onClick={()=>void changeStatus(item,"published")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs">Publish Demo</button>}
                  {item.status!=="draft" && <button onClick={()=>void changeStatus(item,"draft")} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs">Move to Draft</button>}
                  <button onClick={()=>void deleteContent(item.id)} className="rounded-lg bg-red-900/70 px-3 py-1.5 text-xs">Delete</button>
                </div>
              </div>
              {item.caption && <p className="whitespace-pre-wrap text-sm text-slate-300">{item.caption}</p>}
              {item.media_url && <a href={item.media_url} target="_blank" rel="noreferrer" className="break-all text-xs text-violet-300 underline">Open media URL</a>}
              {item.scheduled_at && <p className="text-xs text-amber-300">Scheduled: {new Date(item.scheduled_at).toLocaleString()}</p>}
              {item.published_at && <p className="text-xs text-emerald-300">Demo published: {new Date(item.published_at).toLocaleString()}</p>}
            </article>)}
          </section>
        </div>}

        {tab === "calendar" && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))} className="rounded-lg bg-slate-800 px-3 py-2">←</button>
            <h2 className="font-semibold">{month.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</h2>
            <button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))} className="rounded-lg bg-slate-800 px-3 py-2">→</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} className="p-2">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">{monthDays.map((day,i)=>{
            const dayItems=calendarItems(day);
            const inMonth=day.getMonth()===month.getMonth();
            return <div key={i} className={`min-h-24 rounded-lg border p-1.5 ${inMonth?"border-slate-700 bg-slate-950":"border-slate-800 bg-slate-900/50 opacity-40"}`}>
              <div className="text-xs">{day.getDate()}</div>
              {dayItems.slice(0,3).map(item=><button key={item.id} onClick={()=>editContent(item)} title={item.title} className={`mt-1 block w-full truncate rounded px-1 py-1 text-left text-[10px] ${item.status==="published"?"bg-emerald-900 text-emerald-200":item.status==="scheduled"?"bg-amber-900 text-amber-200":"bg-slate-700 text-slate-200"}`}>{item.title}</button>)}
              {dayItems.length>3 && <p className="text-[10px] text-slate-400">+{dayItems.length-3} more</p>}
            </div>;
          })}</div>
          <p className="mt-3 text-xs text-slate-500">Calendar uses scheduled date, published date, or draft creation date.</p>
        </section>}

        {tab === "accounts" && <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form onSubmit={addAccount} className="h-fit space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">Add Social Account</h2>
            <select value={accountForm.platform} onChange={e=>setAccountForm({...accountForm,platform:e.target.value as Platform})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3">{platforms.map(p=><option key={p}>{p}</option>)}</select>
            <input required maxLength={120} placeholder="Account display name" value={accountForm.display_name} onChange={e=>setAccountForm({...accountForm,display_name:e.target.value})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3" />
            <input maxLength={120} placeholder="@handle (optional)" value={accountForm.handle} onChange={e=>setAccountForm({...accountForm,handle:e.target.value})} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3" />
            <button className="w-full rounded-lg bg-violet-600 p-3 font-semibold">Add Account</button>
            <p className="text-xs text-slate-500">Demo account records only. OAuth connection is not enabled.</p>
          </form>
          <section className="space-y-3">
            <h2 className="font-semibold">Connected Account Records</h2>
            {accounts.length===0 && <p className="rounded-xl border border-dashed border-slate-700 p-6 text-slate-400">No social accounts added.</p>}
            {accounts.map(account=><article key={account.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div><h3 className="font-medium">{account.display_name}</h3><p className="text-xs capitalize text-slate-400">{account.platform} · {account.handle || "No handle"} · {account.status}</p></div>
              <button onClick={()=>void removeAccount(account.id)} className="rounded-lg bg-red-900/70 px-3 py-2 text-xs">Remove</button>
            </article>)}
          </section>
        </div>}
      </div>
    </main>
  );
}
