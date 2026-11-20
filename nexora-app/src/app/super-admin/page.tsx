"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  Building2,
  Users,
  CreditCard,
  RefreshCw,
  AlertCircle,
  LayoutDashboard,
  Layers,
  Menu,
  X,
} from "lucide-react";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  owner_name: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  created_at: string;
};

type Dashboard = {
  total_workspaces: number;
  total_users: number;
  total_subscriptions: number;
  active_subscriptions: number;
  simulated_payments: number;
  simulated_revenue: number;
  plans: {
    code: string;
    name: string;
    price_monthly: number;
    active: boolean;
  }[];
};

const navigation = [
  { label: "Overview", href: "#overview", icon: LayoutDashboard },
  { label: "Users", href: "#users", icon: Users },
  { label: "Workspaces", href: "#workspaces", icon: Building2 },
  { label: "Subscriptions", href: "#subscriptions", icon: CreditCard },
  { label: "Plans", href: "#plans", icon: Layers },
];

export default function SuperAdminPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/platform-admin", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load admin dashboard.");
      }

      setDashboard(data.dashboard);
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const stats = [
    {
      label: "Total Workspaces",
      value: dashboard?.total_workspaces ?? 0,
      icon: Building2,
    },
    {
      label: "Total Users",
      value: dashboard?.total_users ?? 0,
      icon: Users,
    },
    {
      label: "Active Subscriptions",
      value: dashboard?.active_subscriptions ?? 0,
      icon: ShieldCheck,
    },
    {
      label: "Demo Payments",
      value: dashboard?.simulated_payments ?? 0,
      icon: CreditCard,
    },
  ];

  return (
    <div className="min-h-screen bg-[#080D18] text-white md:flex">
      <aside className="border-b border-slate-800 bg-[#0D1423] md:fixed md:inset-y-0 md:left-0 md:z-20 md:flex md:w-64 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-5">
          <a href="#overview" className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-600/20 p-2 text-blue-400">
              <ShieldCheck size={25} />
            </div>
            <div>
              <p className="font-bold tracking-wide">NEXORA AI</p>
              <p className="text-xs text-slate-400">Platform Admin</p>
            </div>
          </a>

          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg border border-slate-700 p-2 text-slate-300 md:hidden"
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div className={`${menuOpen ? "block" : "hidden"} px-3 pb-4 md:block md:flex-1`}>
          <p className="px-3 pb-3 pt-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Platform Menu
          </p>

          <nav className="space-y-1">
            {navigation.map(({ label, href, icon: Icon }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-slate-300 transition hover:bg-blue-500/10 hover:text-blue-400"
              >
                <Icon size={19} />
                {label}
              </a>
            ))}
          </nav>
        </div>

        <div className="hidden border-t border-slate-800 p-4 md:block">
          <div className="rounded-lg bg-slate-800/60 p-3">
            <p className="text-xs font-medium text-emerald-400">
              Platform Protected
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Authorized admin access
            </p>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:ml-64 md:px-8 md:py-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <header
            id="overview"
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-blue-400">
                <ShieldCheck size={17} />
                NEXORA AI / PLATFORM ADMIN
              </div>
              <h1 className="text-3xl font-bold">Super Admin</h1>
              <p className="mt-2 text-sm text-slate-400">
                Platform overview and workspace monitoring.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </header>

          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              <AlertCircle size={19} />
              {error}
            </div>
          )}

          {loading && (
            <p className="text-sm text-slate-400">
              Loading platform data...
            </p>
          )}

          <section
            id="users"
            className="grid scroll-mt-6 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {stats.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-xl border border-slate-800 bg-[#111827] p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm text-slate-400">{label}</span>
                  <Icon className="text-blue-400" size={20} />
                </div>
                <p className="text-3xl font-bold">
                  {value.toLocaleString()}
                </p>
              </div>
            ))}
          </section>

          <section
            id="subscriptions"
            className="scroll-mt-6 rounded-xl border border-slate-800 bg-[#111827] p-5"
          >
            <h2 className="mb-4 text-lg font-semibold">
              Subscription Overview
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-slate-400">
                  Total Subscriptions
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {dashboard?.total_subscriptions ?? 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Simulated Revenue</p>
                <p className="mt-1 text-2xl font-bold">
                  ৳{Number(
                    dashboard?.simulated_revenue ?? 0
                  ).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">Demo records only</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Platform Mode</p>
                <p className="mt-1 text-lg font-semibold text-amber-400">
                  Demo Billing
                </p>
              </div>
            </div>
          </section>

          <section
            id="plans"
            className="scroll-mt-6 rounded-xl border border-slate-800 bg-[#111827] p-5"
          >
            <h2 className="mb-4 text-lg font-semibold">
              Subscription Plans
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {(dashboard?.plans || []).map((plan) => (
                <div
                  key={plan.code}
                  className="rounded-lg border border-slate-700 p-4"
                >
                  <p className="font-semibold">{plan.name}</p>
                  <p className="mt-2 text-xl font-bold">
                    ৳{Number(plan.price_monthly).toLocaleString()}
                    <span className="text-xs font-normal text-slate-400">
                      {" "}/ month
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {plan.active ? "Active" : "Inactive"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section
            id="workspaces"
            className="scroll-mt-6 overflow-hidden rounded-xl border border-slate-800 bg-[#111827]"
          >
            <div className="border-b border-slate-800 p-5">
              <h2 className="text-lg font-semibold">
                Workspace Management
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Platform workspace directory · Read-only
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/70 text-slate-400">
                  <tr>
                    <th className="p-4">Workspace</th>
                    <th className="p-4">Owner</th>
                    <th className="p-4">Plan</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((workspace) => (
                    <tr
                      key={workspace.id}
                      className="border-t border-slate-800"
                    >
                      <td className="p-4">
                        <p className="font-medium">{workspace.name}</p>
                        <p className="text-xs text-slate-500">
                          {workspace.slug}
                        </p>
                      </td>
                      <td className="p-4">
                        {workspace.owner_name || "Workspace owner"}
                      </td>
                      <td className="p-4">
                        {workspace.plan_name || "Free"}
                      </td>
                      <td className="p-4">
                        {workspace.subscription_status || "No subscription"}
                      </td>
                    </tr>
                  ))}

                  {!loading && workspaces.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-6 text-center text-slate-500"
                      >
                        No workspaces found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
