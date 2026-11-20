"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CustomerData = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: string;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  payment_method: string | null;
  payment_status: string;
  created_at: string;
};

export default function CustomerDetailsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950 p-8 text-slate-300">Loading customer...</main>}>
      <CustomerDetailsContent />
    </Suspense>
  );
}

function CustomerDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const customerId = String(params.id);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: memberships, error: membershipError } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (membershipError || !memberships?.length) {
        if (!cancelled) {
          setError("কোনো সক্রিয় Workspace পাওয়া যায়নি।");
          setLoading(false);
        }
        return;
      }

      if (memberships.length > 1) {
        if (!cancelled) {
          setError("একাধিক Workspace আছে। Customer Details দেখতে একটি Workspace নির্বাচন করতে হবে।");
          setLoading(false);
        }
        return;
      }

      const cid = memberships[0].company_id;
      const response = await fetch(
        `/api/customers/${customerId}?company_id=${cid}`,
        { cache: "no-store" }
      );
      const result = await response.json();

      if (!response.ok) {
        if (!cancelled) {
          setError(result.error || "Customer তথ্য লোড করা যায়নি।");
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setCustomer(result.data.customer);
        setOrders(result.data.orders || []);
        setTotalSpent(Number(result.data.totalSpent || 0));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [customerId, router]);

  const money = (value: number) =>
    new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));

  if (loading) {
    return <main className="min-h-screen bg-slate-950 p-8 text-slate-300">Loading customer...</main>;
  }

  if (error || !customer) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <button onClick={() => router.push("/customers")} className="mb-6 text-blue-400">← Customers</button>
        <p className="text-red-400">{error || "Customer পাওয়া যায়নি।"}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-6xl">
        <button onClick={() => router.push("/customers")} className="mb-6 text-sm text-blue-400 hover:text-blue-300">
          ← Back to Customers
        </button>

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-sm text-slate-400">CUSTOMER DETAILS</p>
            <h1 className="text-3xl font-bold">{customer.name}</h1>
            <p className="mt-2 text-sm text-slate-400">{customer.status}</p>
          </div>
          <button
            onClick={() => router.push("/customers")}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Customer List
          </button>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Total Orders</p>
            <p className="mt-2 text-3xl font-bold">{orders.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Delivered Order Spending</p>
            <p className="mt-2 text-2xl font-bold">{money(totalSpent)}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Customer Status</p>
            <p className="mt-2 text-2xl font-bold capitalize">{customer.status}</p>
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-lg font-semibold">Contact Information</h2>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <p><span className="text-slate-400">Phone:</span> {customer.phone || "—"}</p>
            <p><span className="text-slate-400">Email:</span> {customer.email || "—"}</p>
            <p className="sm:col-span-2"><span className="text-slate-400">Address:</span> {customer.address || "—"}</p>
            <p className="sm:col-span-2"><span className="text-slate-400">Notes:</span> {customer.notes || "—"}</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 p-5">
            <h2 className="text-lg font-semibold">Order History</h2>
          </div>
          {orders.length === 0 ? (
            <p className="p-8 text-center text-slate-400">এই Customer-এর কোনো Order নেই।</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/70 text-slate-300">
                  <tr>
                    <th className="p-4">Order</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4">Order Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-t border-slate-800">
                      <td className="p-4 font-medium">{order.order_number}</td>
                      <td className="p-4 text-slate-300">{new Date(order.created_at).toLocaleDateString("en-BD")}</td>
                      <td className="p-4">{money(order.total)}</td>
                      <td className="p-4 capitalize">{order.payment_status.replaceAll("_", " ")}</td>
                      <td className="p-4 capitalize">{order.status.replaceAll("_", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
