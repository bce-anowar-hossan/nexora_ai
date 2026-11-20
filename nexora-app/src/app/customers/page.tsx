"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Search, Pencil, UserRound, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Input from "@/components/ui/input";
import Modal from "@/components/ui/modal";

type Customer = {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; notes: string | null; status: "active" | "inactive";
};

const emptyForm = { name: "", phone: "", email: "", address: "", notes: "" };

export default function CustomersPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [companyId, setCompanyId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (cid: string) => {
    const response = await fetch(`/api/customers?company_id=${cid}&search=${encodeURIComponent(search)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Customer load failed.");
    setCustomers(result.data || []);
  }, [search]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/login"); return; }
        const { data, error: memberError } = await supabase.from("company_members")
          .select("company_id").eq("user_id", user.id).eq("status", "active").limit(2);
        if (memberError) throw memberError;
        if (!data?.length) throw new Error("কোনো Active Workspace পাওয়া যায়নি।");
        if (data.length > 1) throw new Error("একাধিক Workspace আছে। Company নির্বাচন প্রয়োজন।");
        if (!alive) return;
        setCompanyId(data[0].company_id);
        await load(data[0].company_id);
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : "Load failed."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [supabase, router, load]);

  useEffect(() => {
    if (!companyId) return;
    const timer = window.setTimeout(() => { void load(companyId).catch(e => setError(e.message)); }, 250);
    return () => window.clearTimeout(timer);
  }, [companyId, search, load]);

  function openCreate() { setEditing(null); setForm(emptyForm); setOpen(true); }
  function openEdit(c: Customer) {
    setEditing(c.id);
    setForm({ name: c.name, phone: c.phone || "", email: c.email || "", address: c.address || "", notes: c.notes || "" });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/customers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, company_id: companyId, id: editing || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Save failed.");
      setOpen(false); await load(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    finally { setSaving(false); }
  }

  async function reactivate(id: string) {
    setError("");
    try {
      const response = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, id, status: "active" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Reactivate failed.");
      await load(companyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reactivate failed.");
    }
  }

  async function deactivate(id: string) {
    if (!window.confirm("এই Customer-কে Inactive করতে চাও?")) return;
    try {
      const response = await fetch(`/api/customers?company_id=${companyId}&id=${id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Update failed.");
      await load(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed."); }
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={17}/> Dashboard</button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm text-blue-400">CUSTOMER MANAGEMENT</p><h1 className="text-3xl font-bold">Customers</h1><p className="mt-1 text-sm text-slate-400">Customer directory and contact information</p></div>
          <Button onClick={openCreate}><Plus size={17}/> Add Customer</Button>
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card><div className="flex items-center gap-3"><Users className="text-blue-400"/><div><p className="text-sm text-slate-400">Total customers</p><p className="text-2xl font-bold">{customers.length}</p></div></div></Card>
          <Card><div className="flex items-center gap-3"><UserRound className="text-emerald-400"/><div><p className="text-sm text-slate-400">Active customers</p><p className="text-2xl font-bold">{customers.filter(c => c.status === "active").length}</p></div></div></Card>
        </div>
        <Card>
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3"><Search size={17} className="text-slate-500"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone or email..." className="min-h-11 w-full bg-transparent text-sm outline-none"/></div>
          {loading ? <p className="p-8 text-center text-slate-400">Loading customers...</p> : customers.length === 0 ? <p className="p-8 text-center text-slate-400">No customers found. Add your first customer.</p> :
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr><th className="p-3">Customer</th><th className="p-3">Phone</th><th className="p-3">Email</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody>{customers.map(c => <tr key={c.id} className="border-t border-slate-800"><td className="p-3 font-semibold"><a href={`/customers/${c.id}`} className="text-blue-400 hover:text-blue-300">{c.name} → Details</a></td><td className="p-3">{c.phone || "—"}</td><td className="p-3">{c.email || "—"}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${c.status === "active" ? "bg-emerald-950 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>{c.status}</span></td><td className="p-3"><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => openEdit(c)}><Pencil size={14}/> Edit</Button>{c.status === "active" ? <Button size="sm" variant="ghost" onClick={() => deactivate(c.id)}>Deactivate</Button> : <Button size="sm" variant="secondary" onClick={() => reactivate(c.id)}>Reactivate</Button>}</div></td></tr>)}</tbody></table></div>}
        </Card>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Customer" : "Add Customer"}>
        <form onSubmit={save} className="space-y-4">
          <Input label="Customer name *" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required maxLength={200}/>
          <Input label="Phone" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} maxLength={40}/>
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})}/>
          <Input label="Address" value={form.address} onChange={e => setForm({...form,address:e.target.value})}/>
          <label className="ui-input-wrapper"><span>Notes</span><textarea className="ui-input min-h-24" value={form.notes} onChange={e => setForm({...form,notes:e.target.value})}/></label>
          <Button type="submit" disabled={saving} className="w-full">{saving ? "Saving..." : "Save Customer"}</Button>
        </form>
      </Modal>
    </main>
  );
}
