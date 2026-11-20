"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Bot, Plus, Send, MessageSquare, Trash2,
  RefreshCw, Sparkles, UserRound, XCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Conversation = {
  id: string;
  title: string;
  status: "open" | "closed";
  updated_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type Detail = { conversation: Conversation; messages: Message[] };

export default function AIPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadList = useCallback(async (cid: string) => {
    const response = await fetch(`/api/conversations?company_id=${cid}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Conversation load failed.");
    setItems(result.data || []);
  }, []);

  const loadDetail = useCallback(async (cid: string, id: string) => {
    const response = await fetch(`/api/conversations/${id}?company_id=${cid}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Chat load failed.");
    setDetail(result.data);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/login"); return; }

        const { data, error: memberError } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(2);

        if (memberError) throw memberError;
        if (!data?.length) throw new Error("কোনো Active Workspace পাওয়া যায়নি।");
        if (data.length > 1) throw new Error("একাধিক Workspace আছে। Company নির্বাচন প্রয়োজন।");
        if (!alive) return;

        setCompanyId(data[0].company_id);
        await loadList(data[0].company_id);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "লোড করা যায়নি।");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [supabase, router, loadList]);

  async function createConversation() {
    if (!companyId) return;
    setError("");
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Chat তৈরি করা যায়নি।");
      await loadList(companyId);
      setSelected(result.data.id);
      await loadDetail(companyId, result.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat তৈরি করা যায়নি।");
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !selected || !companyId || sending) return;
    setSending(true);
    setError("");
    setDraft("");
    try {
      const response = await fetch(`/api/conversations/${selected}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, content }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Message পাঠানো যায়নি।");
      await Promise.all([loadDetail(companyId, selected), loadList(companyId)]);
    } catch (e) {
      setDraft(content);
      setError(e instanceof Error ? e.message : "Message পাঠানো যায়নি।");
    } finally {
      setSending(false);
    }
  }

  async function toggleStatus() {
    if (!detail || !companyId) return;
    const next = detail.conversation.status === "open" ? "closed" : "open";
    try {
      const response = await fetch(`/api/conversations/${selected}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, status: next }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Status update failed.");
      await Promise.all([loadDetail(companyId, selected), loadList(companyId)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status update failed.");
    }
  }

  async function deleteConversation() {
    if (!selected || !companyId || !window.confirm("এই conversation ও এর message delete করতে চাও?")) return;
    try {
      const response = await fetch(`/api/conversations/${selected}?company_id=${companyId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Delete failed.");
      setSelected("");
      setDetail(null);
      await loadList(companyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-3 text-slate-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft size={17}/> Dashboard
        </button>

        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-violet-400"><Sparkles size={16}/> NEXORA AI WORKSPACE</p>
            <h1 className="mt-1 text-3xl font-bold">AI Assistant</h1>
            <p className="mt-1 text-sm text-slate-400">Conversation history and Demo AI replies</p>
          </div>
          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-300">DEMO ENGINE</span>
        </header>

        {error && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error"><XCircle size={17}/></button>
          </div>
        )}

        <div className="grid min-h-[650px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
            <button onClick={createConversation} disabled={!companyId} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50">
              <Plus size={17}/> New conversation
            </button>
            <div className="mt-5 flex items-center justify-between px-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">History</p>
              <button onClick={() => companyId && loadList(companyId)} className="text-slate-400 hover:text-white" aria-label="Refresh history"><RefreshCw size={15}/></button>
            </div>
            <div className="mt-2 space-y-1">
              {loading ? <p className="p-4 text-sm text-slate-500">Loading...</p> :
                items.length === 0 ? <p className="p-4 text-sm text-slate-500">এখনো কোনো conversation নেই।</p> :
                items.map(item => (
                  <button key={item.id} onClick={() => {
                    setSelected(item.id);
                    void loadDetail(companyId, item.id).catch(e => setError(e.message));
                  }} className={`w-full rounded-xl p-3 text-left ${selected === item.id ? "bg-violet-600/20 text-violet-200" : "text-slate-300 hover:bg-slate-800"}`}>
                    <span className="flex items-center gap-2 text-sm font-medium"><MessageSquare size={15}/><span className="truncate">{item.title}</span></span>
                    <span className="mt-1 block text-xs text-slate-500">{item.status} · {new Date(item.updated_at).toLocaleString()}</span>
                  </button>
                ))}
            </div>
          </aside>

          <section className="flex min-h-[600px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            {detail ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{detail.conversation.title}</h2>
                    <p className="text-xs text-slate-500">Status: {detail.conversation.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={toggleStatus} className="rounded-lg border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800">{detail.conversation.status === "open" ? "Close" : "Reopen"}</button>
                    <button onClick={deleteConversation} aria-label="Delete conversation" className="rounded-lg border border-red-900 px-3 py-2 text-red-300 hover:bg-red-950"><Trash2 size={15}/></button>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
                  {detail.messages.length === 0 ? (
                    <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
                      <Bot size={38} className="text-violet-400"/>
                      <h3 className="mt-3 text-lg font-semibold">NEXORA Demo AI</h3>
                      <p className="mt-1 max-w-sm text-sm text-slate-400">নিচে একটি message লিখে conversation শুরু করো।</p>
                    </div>
                  ) : detail.messages.map(message => (
                    <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      {message.role === "assistant" && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-violet-300"><Bot size={17}/></div>}
                      <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-blue-600 text-white" : "border border-slate-700 bg-slate-800 text-slate-200"}`}>
                        {message.content}
                        <p className="mt-1 text-right text-[10px] opacity-50">{new Date(message.created_at).toLocaleTimeString()}</p>
                      </div>
                      {message.role === "user" && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-300"><UserRound size={17}/></div>}
                    </div>
                  ))}
                </div>

                <form onSubmit={sendMessage} className="border-t border-slate-800 p-3 md:p-4">
                  <div className="flex items-end gap-2 rounded-xl border border-slate-700 bg-slate-950 p-2">
                    <textarea value={draft} onChange={e => setDraft(e.target.value)} disabled={sending || detail.conversation.status !== "open"} rows={2} maxLength={12000} placeholder={detail.conversation.status === "open" ? "Write your message..." : "Reopen this conversation to send a message"} className="max-h-36 min-h-12 flex-1 resize-y bg-transparent p-2 text-sm outline-none placeholder:text-slate-600"/>
                    <button type="submit" disabled={sending || !draft.trim() || detail.conversation.status !== "open"} className="rounded-lg bg-violet-600 p-3 text-white hover:bg-violet-500 disabled:opacity-40" aria-label="Send message"><Send size={17}/></button>
                  </div>
                  <p className="mt-2 text-center text-[11px] text-slate-500">Demo AI · No external AI API connected</p>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <Bot size={48} className="text-violet-400"/>
                <h2 className="mt-4 text-xl font-bold">Your AI workspace</h2>
                <p className="mt-2 max-w-md text-sm text-slate-400">একটি conversation তৈরি করো অথবা বাম পাশ থেকে আগের chat নির্বাচন করো।</p>
                <button onClick={createConversation} className="mt-5 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold hover:bg-violet-500"><Plus size={16}/> Start a conversation</button>
              </div>
            )}
          </section>
        </div>
        <p className="text-center text-xs text-slate-600">NEXORA AI · Conversation data is isolated by workspace permissions</p>
      </div>
    </main>
  );
}
