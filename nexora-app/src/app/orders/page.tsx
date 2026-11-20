"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Input from "@/components/ui/input";
import Modal from "@/components/ui/modal";

type Customer = { id: string; name: string; phone: string | null };
type Product = { id: string; name: string; sku: string | null; price: number; status: string };
type Order = { id: string; order_number: string; status: string; total: number; subtotal: number; discount: number; delivery_fee: number; payment_method: string | null; notes: string | null; payment_status: string; created_at: string; customer: Customer | null; items: { id: string; product_id: string; variant_id: string | null; product_name: string; quantity: number; line_total: number }[] };

const statuses = ["pending","confirmed","processing","ready_to_ship","shipped","delivered","cancelled","returned"];
const label = (s: string) => s.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());

export default function OrdersPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [companyId, setCompanyId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [orderItems, setOrderItems] = useState([{ product_id: "", quantity: "1" }]);
  const [discount, setDiscount] = useState("0");
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async (cid: string) => {
    const response = await fetch(`/api/orders?company_id=${cid}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load orders.");
    setOrders(result.data || []);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/login"); return; }
        const { data: memberships, error: memberError } = await supabase.from("company_members")
          .select("company_id").eq("user_id", user.id).eq("status", "active").limit(2);
        if (memberError) throw memberError;
        if (!memberships?.length) throw new Error("No active workspace found.");
        if (memberships.length > 1) throw new Error("Multiple workspaces found. Company selection is required.");
        const cid = memberships[0].company_id;
        const [{ data: cs, error: ce }, { data: ps, error: pe }] = await Promise.all([
          supabase.from("customers").select("id,name,phone").eq("company_id", cid).eq("status","active").order("name"),
          supabase.from("products").select("id,name,sku,price,status").eq("company_id", cid).eq("status","active").order("name"),
        ]);
        if (ce || pe) throw ce || pe;
        if (!alive) return;
        setCompanyId(cid); setCustomers(cs || []); setProducts(ps || []);
        await loadOrders(cid);
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : "Load failed."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [supabase, router, loadOrders]);

  async function createOrder(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch(editOrderId ? `/api/orders/${editOrderId}` : "/api/orders", {
        method: editOrderId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId, customer_id: customerId,
          discount: Number(discount), delivery_fee: Number(deliveryFee),
          payment_method: paymentMethod, notes,
          items: orderItems.map(item => ({ product_id: item.product_id, quantity: Number(item.quantity) })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Order creation failed.");
      setOpen(false); setEditOrderId(null); setCustomerId(""); setOrderItems([{ product_id: "", quantity: "1" }]); setDiscount("0"); setDeliveryFee("0"); setPaymentMethod("cash"); setNotes("");
      await loadOrders(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : "Order creation failed."); }
    finally { setSaving(false); }
  }

  function openEdit(order: Order) {
    if (order.status !== "pending") return;
    setError("");
    setEditOrderId(order.id);
    setCustomerId(order.customer?.id || "");
    setOrderItems(order.items.map(item => ({
      product_id: item.product_id,
      quantity: String(item.quantity),
    })));
    setDiscount(String(order.discount || 0));
    setDeliveryFee(String(order.delivery_fee || 0));
    setPaymentMethod(order.payment_method || "cash");
    setNotes(order.notes || "");
    setOpen(true);
  }

  async function updatePayment(orderId: string, payment_status: string) {
    setError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, payment_status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Payment update failed.");
      await loadOrders(companyId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment update failed.");
    }
  }

  async function updateStatus(orderId: string, status: string) {
    if (status === "cancelled" && !window.confirm("এই Order বাতিল করতে চাও? Stock ফেরত যাবে যদি আগে Confirm হয়ে থাকে।")) return;
    setError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: companyId, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Status update failed.");
      await loadOrders(companyId);
    } catch (e) { setError(e instanceof Error ? e.message : "Status update failed."); }
  }

  const money = (n: number) => `৳${Number(n || 0).toLocaleString("en-BD", {minimumFractionDigits:2, maximumFractionDigits:2})}`;

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={17}/> Dashboard</button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm text-blue-400">SALES MANAGEMENT</p><h1 className="text-3xl font-bold">Orders</h1><p className="mt-1 text-sm text-slate-400">Create and manage customer orders</p></div>
          <Button onClick={() => { setEditOrderId(null); setCustomerId(""); setOrderItems([{ product_id: "", quantity: "1" }]); setDiscount("0"); setDeliveryFee("0"); setPaymentMethod("cash"); setNotes(""); setOpen(true); }}><Plus size={17}/> Create Order</Button>
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><p className="text-sm text-slate-400">Total orders</p><p className="mt-1 text-2xl font-bold">{orders.length}</p></Card>
          <Card><p className="text-sm text-slate-400">Pending</p><p className="mt-1 text-2xl font-bold">{orders.filter(o => o.status === "pending").length}</p></Card>
          <Card><p className="text-sm text-slate-400">Delivered sales</p><p className="mt-1 text-2xl font-bold">{money(orders.filter(o => o.status === "delivered").reduce((sum,o) => sum + Number(o.total),0))}</p></Card>
        </div>
        <Card>
          <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Recent Orders</h2><button onClick={() => companyId && loadOrders(companyId)} className="text-slate-400 hover:text-white" aria-label="Refresh"><RefreshCw size={17}/></button></div>
          {loading ? <p className="p-8 text-center text-slate-400">Loading orders...</p> : orders.length === 0 ? <p className="p-8 text-center text-slate-400">No orders yet.</p> :
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Items</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Payment</th><th className="p-3">Update</th></tr></thead><tbody>{orders.map(o => <tr key={o.id} className="border-t border-slate-800"><td className="p-3"><b>{o.order_number}</b><p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleDateString()}</p></td><td className="p-3">{o.customer?.name || "Unknown"}<p className="text-xs text-slate-500">{o.customer?.phone || ""}</p></td><td className="p-3">{o.items?.map(i => `${i.product_name} × ${i.quantity}`).join(", ")}</td><td className="p-3 font-semibold">{money(Number(o.total))}</td><td className="p-3"><span className="rounded-full bg-blue-950 px-2 py-1 text-xs text-blue-300">{label(o.status)}</span></td><td className="p-3"><select aria-label={`Payment ${o.order_number}`} value={o.payment_status} onChange={e => updatePayment(o.id,e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 p-2 text-xs">{["unpaid","partial","paid","refunded"].map(s => <option key={s} value={s}>{label(s)}</option>)}</select></td><td className="p-3">{o.status === "pending" && <button type="button" onClick={() => openEdit(o)} className="mb-2 rounded-md border border-slate-700 px-2 py-1 text-xs text-blue-300 hover:bg-slate-800">Edit</button>}<select aria-label={`Update ${o.order_number}`} value={o.status} onChange={e => updateStatus(o.id,e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 p-2 text-xs">{statuses.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></td></tr>)}</tbody></table></div>}
        </Card>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Create Order" description="নতুন Order তৈরি করো। Stock Confirm করার সময় কমবে।">
        <form onSubmit={createOrder} className="space-y-4">
          <label className="ui-input-wrapper"><span>Customer *</span><select required value={customerId} onChange={e => setCustomerId(e.target.value)} className="ui-input"><option value="">Select customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ""}</option>)}</select></label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Products *</span>
              <Button type="button" size="sm" variant="secondary" onClick={() => setOrderItems(items => [...items, { product_id: "", quantity: "1" }])}>+ Add Product</Button>
            </div>
            {orderItems.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_90px_auto] items-end gap-2">
                <label className="ui-input-wrapper"><span>Product {index + 1}</span><select required value={item.product_id} onChange={e => setOrderItems(items => items.map((row, i) => i === index ? { ...row, product_id: e.target.value } : row))} className="ui-input"><option value="">Select product</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} — {money(Number(p.price))}</option>)}</select></label>
                <Input label="Qty" type="number" min="1" step="1" required value={item.quantity} onChange={e => setOrderItems(items => items.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))}/>
                <Button type="button" size="sm" variant="ghost" disabled={orderItems.length === 1} onClick={() => setOrderItems(items => items.filter((_, i) => i !== index))}>Remove</Button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3"><Input label="Discount (৳)" type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)}/><Input label="Delivery fee (৳)" type="number" min="0" step="0.01" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)}/></div>
          <label className="ui-input-wrapper"><span>Payment method</span><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="ui-input"><option value="cash">Cash</option><option value="bank">Bank</option><option value="mobile_banking">Mobile Banking</option><option value="other">Other</option></select></label>
          <label className="ui-input-wrapper"><span>Notes</span><textarea className="ui-input min-h-20" value={notes} onChange={e => setNotes(e.target.value)}/></label>
          <Button type="submit" disabled={saving || !customers.length || !products.length || orderItems.some(item => !item.product_id || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)} className="w-full">{saving ? (editOrderId ? "Saving..." : "Creating...") : (editOrderId ? "Save Order Changes" : "Create Pending Order")}</Button>
          {!customers.length && <p className="text-xs text-amber-300">আগে একটি Active Customer তৈরি করো।</p>}
          {!products.length && <p className="text-xs text-amber-300">আগে একটি Active Product তৈরি করো।</p>}
        </form>
      </Modal>
    </main>
  );
}
