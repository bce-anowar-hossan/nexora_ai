
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LogoutButton from "@/components/auth/logout-button";
import {
  LayoutDashboard, Bot, Package, ShoppingCart,
  Users, MessageSquare, Share2, CalendarDays,
  Workflow, Megaphone, ChartNoAxesCombined,
  Plug, Settings, Bell, Search, Menu, X,
  TrendingUp, ArrowUpRight,
  Sparkles, CircleCheck, MoreHorizontal,
  Plus, ChevronDown,
  CreditCard,
} from "lucide-react";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "AI Assistant", icon: Bot },
  { label: "Products", icon: Package },
  { label: "Orders", icon: ShoppingCart },
  { label: "Customers", icon: Users },
  { label: "Conversations", icon: MessageSquare },
  { label: "Social Accounts", icon: Share2 },
  { label: "Content Studio", icon: Sparkles },
  { label: "Post Scheduler", icon: CalendarDays },
  { label: "Automations", icon: Workflow },
  { label: "Campaigns", icon: Megaphone },
  { label: "Analytics", icon: ChartNoAxesCombined },
  { label: "Integrations", icon: Plug },
  { label: "Billing", icon: CreditCard },
  { label: "Team Management", icon: Users },
]

type DashboardData = {
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    totalCustomers: number;
    pendingOrders: number;
    deliveredOrders: number;
    aiConversations: number | null;
  };
  recentOrders: Array<{
    id: string;
    order_number: string;
    status: string;
    total: number;
    created_at: string;
    customer: { name: string } | null;
    items: Array<{ product_name: string; quantity: number }>;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    table_name: string;
    record_id: string | null;
    created_at: string;
  }>;
};

export default function Home() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("Overview");
  const [language, setLanguage] = useState<"EN" | "বাংলা">("EN");

  const dictionary: Record<string, string> = {
    "Overview": "ওভারভিউ",
    "AI Assistant": "এআই সহকারী",
    "Products": "পণ্য",
    "Orders": "অর্ডার",
    "Customers": "গ্রাহক",
    "Conversations": "কথোপকথন",
    "Social Accounts": "সোশ্যাল অ্যাকাউন্ট",
    "Content Studio": "কনটেন্ট স্টুডিও",
    "Post Scheduler": "পোস্ট শিডিউলার",
    "Automations": "অটোমেশন",
    "Campaigns": "ক্যাম্পেইন",
    "Analytics": "বিশ্লেষণ",
    "Integrations": "ইন্টিগ্রেশন",
    "Billing": "বিলিং",
    "Team Management": "টিম ম্যানেজমেন্ট",
    "Settings": "সেটিংস",
    "Workspace": "ওয়ার্কস্পেস",
    "Main Menu": "প্রধান মেনু",
    "Preferences": "পছন্দসমূহ",
    "Business workspace": "ব্যবসায়িক ওয়ার্কস্পেস",
    "Welcome back! Here's your business overview.": "স্বাগতম! আপনার ব্যবসার সারসংক্ষেপ দেখুন।",
    "Welcome,": "স্বাগতম,",
    "Here's what's happening with your business today.": "আজ আপনার ব্যবসায় কী ঘটছে তার বিবরণ।",
    "Create New": "নতুন তৈরি করুন",
    "Total Revenue": "মোট আয়",
    "Total Orders": "মোট অর্ডার",
    "AI Conversations": "এআই কথোপকথন",
    "Compared to last month": "গত মাসের তুলনায়",
    "Revenue Overview": "আয়ের সারসংক্ষেপ",
    "Last 7 days": "গত ৭ দিন",
    "Recent Orders": "সাম্প্রতিক অর্ডার",
    "View all orders": "সব অর্ডার দেখুন",
    "Order ID": "অর্ডার আইডি",
    "Customer": "গ্রাহক",
    "Product": "পণ্য",
    "Amount": "পরিমাণ",
    "Status": "অবস্থা",
    "Confirmed": "নিশ্চিত",
    "Processing": "প্রক্রিয়াধীন",
    "Pending": "অপেক্ষমাণ",
    "Delivered": "ডেলিভারি সম্পন্ন",
    "Recent Activity": "সাম্প্রতিক কার্যক্রম",
    "Quick Actions": "দ্রুত কাজ",
    "Add Product": "পণ্য যোগ করুন",
    "View Orders": "অর্ডার দেখুন",
    "Demo mode": "ডেমো মোড",
    "Explore AI Assistant": "এআই সহকারী দেখুন",
    "All rights reserved.": "সর্বস্বত্ব সংরক্ষিত।",
  };

  const t = (value: string) =>
    language === "বাংলা" ? (dictionary[value] || value) : value;

  useEffect(() => {
    const saved = localStorage.getItem("nexora-language");
    if (saved === "EN" || saved === "বাংলা") {
      queueMicrotask(() => setLanguage(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("nexora-language", language);
    document.documentElement.lang = language === "বাংলা" ? "bn" : "en";
  }, [language]);
  const [companyName, setCompanyName] = useState("Loading workspace...");
  const [userName, setUserName] = useState("Loading...");
  const [roleName, setRoleName] = useState("Member");
  const [workspaceError, setWorkspaceError] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      const supabase = createClient();

      try {
        const { data: { user }, error: userError } =
          await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("Unable to load your account. Please log in again.");
        }

        const metadataName =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : "";

        const fallbackName = user.email?.split("@")[0] || "User";

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        const { data: memberships, error: memberError } = await supabase
          .from("company_members")
          .select("company_id, role_id")
          .eq("user_id", user.id)
          .eq("status", "active");

        if (memberError) throw memberError;

        if (!memberships || memberships.length === 0) {
          throw new Error("No active workspace found. Please contact your workspace owner.");
        }

        const membership = memberships[0];

        const { data: company, error: companyError } = await supabase
          .from("companies")
          .select("id, name, slug")
          .eq("id", membership.company_id)
          .maybeSingle();

        if (companyError) throw companyError;
        if (!company) throw new Error("Workspace information could not be found.");

        const { data: role, error: roleError } = await supabase
          .from("roles")
          .select("name, code")
          .eq("id", membership.role_id)
          .maybeSingle();

        if (roleError) throw roleError;

        if (!active) return;

        setCompanyName(company.name);
        setCompanyId(company.id);
        setUserName(profile?.full_name || metadataName || fallbackName);
        setRoleName(role?.name || "Member");
      } catch (error) {
        if (!active) return;

        const errorMessage =
          typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
            ? error.message
            : error instanceof Error
              ? error.message
              : JSON.stringify(error);

        console.error("Workspace loading failed:", error);
        setWorkspaceError(errorMessage || "Unable to load workspace.");
        setCompanyName("Workspace unavailable");
        setUserName("User");
        setRoleName("Unknown");
      }
    }

    loadWorkspace();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!companyId) return;

    let active = true;

    async function loadDashboard() {
      setDashboardLoading(true);
      setDashboardError("");

      try {
        const response = await fetch(
          `/api/dashboard?company_id=${encodeURIComponent(companyId)}`,
          { cache: "no-store" }
        );
        const result = await response.json();

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || "Dashboard data could not be loaded.");
        }

        if (active) setDashboardData(result.data as DashboardData);
      } catch (error) {
        if (!active) return;
        setDashboardError(
          error instanceof Error ? error.message : "Dashboard data could not be loaded."
        );
      } finally {
        if (active) setDashboardLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [companyId]);

  const formatAmount = (value: number) =>
    new Intl.NumberFormat(language === "বাংলা" ? "bn-BD" : "en-US", {
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <div className="min-h-screen bg-[#080D18] text-[#F8FAFC]">
      {menuOpen && (
        <button
          aria-label="Close menu overlay"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-[#243149] bg-[#0D1422] transition-transform duration-300 ${menuOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="flex h-[76px] items-center justify-between border-b border-[#243149] px-6">
          <div className="flex items-center gap-3">
            <img src="/nexora-mark.svg" alt="NEXORA AI" className="h-11 w-11 rounded-xl shadow-lg shadow-blue-500/20" />
            <div>
              <h1 className="text-xl font-bold tracking-wide">NEXORA<span className="text-blue-400"> AI</span></h1>
              <p className="text-[10px] tracking-[2px] text-slate-500">BUSINESS AUTOMATION</p>
            </div>
          </div>
          <button onClick={() => setMenuOpen(false)} className="text-slate-400 lg:hidden" aria-label="Close sidebar">
            <X size={21} />
          </button>
        </div>

        <div className="px-4 pt-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[2px] text-slate-500">{t("Workspace")}</p>
          <button className="flex w-full items-center gap-3 rounded-xl border border-[#243149] bg-[#111C2F] p-3 text-left">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">{companyName.charAt(0).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{companyName}</p>
              <p className="text-xs text-slate-500">{t("Business workspace")}</p>
            </div>
            <ChevronDown size={16} className="text-slate-500" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[2px] text-slate-500">{t("Main Menu")}</p>
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => {
                setActive(label);
                setMenuOpen(false);
                const routes: Record<string, string> = {
                  Products: "/products",
                  Orders: "/orders",
                  Customers: "/customers",
                  "AI Assistant": "/ai",
                  "Content Studio": "/content",
                  "Social Accounts": "/content",
                  "Post Scheduler": "/content",
                  Automations: "/automations",
                  Campaigns: "/campaigns",
                  Analytics: "/analytics",
                  Integrations: "/integrations",
                  Billing: "/billing",
                  "Team Management": "/team",
                };
                if (routes[label]) router.push(routes[label]);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active === label ? "bg-blue-600/15 font-semibold text-blue-400" : "text-slate-400 hover:bg-[#111C2F] hover:text-white"}`}
            >
              <Icon size={18} />
              {t(label)}
              {label === "AI Assistant" && <span className="ml-auto rounded-md bg-purple-500/15 px-2 py-0.5 text-[10px] text-purple-400">AI</span>}
            </button>
          ))}
          <p className="mb-3 mt-7 px-3 text-[10px] font-bold uppercase tracking-[2px] text-slate-500">{t("Preferences")}</p>
          <button onClick={() => setActive("Settings")} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${active === "Settings" ? "bg-blue-600/15 text-blue-400" : "text-slate-400 hover:bg-[#111C2F]"}`}>
            <Settings size={18} /> Settings
          </button>
        </nav>

        <div className="border-t border-[#243149] p-4">
          <div className="flex items-center gap-3 rounded-xl bg-[#111C2F] p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold">{userName.charAt(0).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{userName}</p>
              <p className="text-xs text-slate-500">{roleName}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-[260px]">
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#243149] bg-[#080D18]/95 px-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuOpen(true)} className="text-slate-300 lg:hidden" aria-label="Open menu">
              <Menu size={23} />
            </button>
            <div>
              <h2 className="text-lg font-bold">{t(active)}</h2>
              <p className="hidden text-xs text-slate-500 sm:block">{t("Welcome back! Here's your business overview.")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button aria-label="Search" className="hidden rounded-lg border border-[#243149] p-2.5 text-slate-400 hover:text-white sm:block">
              <Search size={18} />
            </button>
            <button onClick={() => setLanguage(language === "EN" ? "বাংলা" : "EN")} className="rounded-lg border border-[#243149] px-3 py-2 text-xs font-semibold text-slate-300">
              {language}
            </button>
            <button aria-label="Notifications" className="relative rounded-lg border border-[#243149] p-2.5 text-slate-400">
              <Bell size={18} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-500" />
            </button>
            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold sm:flex">{userName.charAt(0).toUpperCase()}</div>
          </div>
        </header>

        {workspaceError && (
          <div role="alert" className="mx-4 mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 sm:mx-8">
            Workspace loading error: {workspaceError}
          </div>
        )}
        {dashboardError && (
          <div role="alert" className="mx-4 mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 sm:mx-8">
            Dashboard loading error: {dashboardError}
          </div>
        )}

        <div className="space-y-7 p-4 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{t("Welcome,")} {userName} 👋</h2>
              <p className="mt-1 text-sm text-slate-400">{t("Here's what's happening with your business today.")}</p>
            </div>
            <button onClick={() => router.push("/products")} className="premium-button flex items-center gap-2 px-4 py-2.5 text-sm font-semibold">
              <Plus size={17} /> {t("Create New")}
            </button>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Revenue", value: dashboardData ? formatAmount(dashboardData.metrics.totalRevenue) : "—", icon: TrendingUp, detail: "Delivered orders only" },
              { label: "Total Orders", value: dashboardData ? formatAmount(dashboardData.metrics.totalOrders) : "—", icon: ShoppingCart, detail: dashboardData ? `${dashboardData.metrics.pendingOrders} pending` : " " },
              { label: "Customers", value: dashboardData ? formatAmount(dashboardData.metrics.totalCustomers) : "—", icon: Users, detail: "Registered customers" },
              { label: "AI Conversations", value: "Not connected", icon: Bot, detail: "AI module not connected" },
            ].map(({ label, value, icon: Icon, detail }) => (
              <div key={label} className="rounded-2xl border border-[#243149] bg-[#111C2F] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                  <Icon size={20} />
                </div>
                <p className="mt-5 text-sm text-slate-400">{t(label)}</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight">
                  {dashboardLoading ? "Loading..." : value}
                </h3>
                <p className="mt-2 text-xs text-slate-500">{detail}</p>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-[#243149] bg-[#111C2F] p-6 xl:col-span-2">
              <h3 className="font-bold">{t("Revenue Overview")}</h3>
              <p className="mt-1 text-xs text-slate-500">Revenue from delivered orders</p>
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[#243149] bg-[#0D1422] p-5">
                  <p className="text-sm text-slate-400">Delivered orders</p>
                  <p className="mt-2 text-3xl font-bold">
                    {dashboardLoading ? "—" : formatAmount(dashboardData?.metrics.deliveredOrders || 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-[#243149] bg-[#0D1422] p-5">
                  <p className="text-sm text-slate-400">Pending orders</p>
                  <p className="mt-2 text-3xl font-bold">
                    {dashboardLoading ? "—" : formatAmount(dashboardData?.metrics.pendingOrders || 0)}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-xs text-slate-500">
                Revenue is calculated from delivered orders only. Historical chart data is not available yet.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[#17152D] to-[#111C2F] p-6">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-purple-500/15 p-2 text-purple-400"><Bot size={20} /></div>
                <span className="text-sm font-bold">NEXORA AI Assistant</span>
              </div>
              <p className="mt-5 text-lg font-semibold">Your AI workspace is ready.</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Connect your business data to prepare AI-powered customer support and automation.</p>
              <div className="mt-5 rounded-xl border border-purple-500/20 bg-black/20 p-3">
                <div className="flex items-center gap-2 text-xs text-purple-300"><Sparkles size={14} /> Not connected</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">AI services have not been configured for this workspace yet.</p>
              </div>
              <button onClick={() => setActive("AI Assistant")} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold hover:bg-purple-500">
                Explore AI Assistant <ArrowUpRight size={16} />
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#243149] bg-[#111C2F]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#243149] p-5 sm:p-6">
              <div>
                <h3 className="font-bold">{t("Recent Orders")}</h3>
                <p className="mt-1 text-xs text-slate-500">Latest orders from this workspace</p>
              </div>
              <button onClick={() => router.push("/orders")} className="text-xs font-semibold text-blue-400 hover:text-blue-300">{t("View all orders")} <ArrowUpRight size={14} className="ml-1 inline" /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-[#0D1422] text-xs text-slate-500">
                  <tr><th className="px-6 py-4 font-medium">{t("Order ID")}</th><th className="px-6 py-4 font-medium">{t("Customer")}</th><th className="px-6 py-4 font-medium">{t("Product")}</th><th className="px-6 py-4 font-medium">{t("Amount")}</th><th className="px-6 py-4 font-medium">{t("Status")}</th></tr>
                </thead>
                <tbody className="divide-y divide-[#243149]">
                  {dashboardLoading ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Loading orders...</td></tr>
                  ) : dashboardData?.recentOrders.length ? (
                    dashboardData.recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-white/[0.02]">
                        <td className="px-6 py-4 font-semibold text-blue-400">{order.order_number}</td>
                        <td className="px-6 py-4">{order.customer?.name || "Guest"}</td>
                        <td className="px-6 py-4 text-slate-400">
                          {order.items.length
                            ? order.items.map((item) => `${item.product_name} × ${item.quantity}`).join(", ")
                            : "—"}
                        </td>
                        <td className="px-6 py-4 font-semibold">{formatAmount(Number(order.total || 0))}</td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            order.status === "delivered" ? "bg-green-500/10 text-green-400" :
                            order.status === "cancelled" ? "bg-red-500/10 text-red-400" :
                            "bg-amber-500/10 text-amber-400"
                          }`}>{order.status}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No orders found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[#243149] bg-[#111C2F] p-6">
              <h3 className="font-bold">{t("Recent Activity")}</h3>
              <div className="mt-5 space-y-5">
                {dashboardLoading ? (
                  <p className="text-sm text-slate-400">Loading activity...</p>
                ) : dashboardData?.recentActivity.length ? (
                  dashboardData.recentActivity.map((entry) => (
                    <div key={entry.id} className="flex gap-3">
                      <CircleCheck size={18} className="shrink-0 text-blue-400" />
                      <div className="min-w-0">
                        <p className="break-words text-sm">{entry.action} · {entry.table_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(entry.created_at).toLocaleString(language === "বাংলা" ? "bn-BD" : "en-US")}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No recent activity recorded yet.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-[#243149] bg-[#111C2F] p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{t("Quick Actions")}</h3>
                <MoreHorizontal size={20} className="text-slate-500" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  { label: "Add Product", icon: Package, target: "Products" },
                  { label: "View Orders", icon: ShoppingCart, target: "Orders" },
                  { label: "Customers", icon: Users, target: "Customers" },
                  { label: "Automations", icon: Workflow, target: "Automations" },
                ].map(({ label, icon: Icon, target }) => (
                  <button key={label} onClick={() => {
                    const routes: Record<string, string> = {
                      Products: "/products",
                      Orders: "/orders",
                      Customers: "/customers",
                      Automations: "/automations",
                    };
                    if (routes[target]) router.push(routes[target]);
                  }} className="flex flex-col items-start gap-3 rounded-xl border border-[#243149] bg-[#0D1422] p-4 text-left transition hover:border-blue-500/50">
                    <Icon size={20} className="text-blue-400" />
                    <span className="text-xs font-semibold">{t(label)}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#243149] py-5 text-xs text-slate-500">
            <div>
              <span>© 2026 NEXORA AI. {t("All rights reserved.")}</span>
              <p className="mt-2 text-[11px] text-slate-500">Founder & Developer: <span className="font-semibold text-slate-300">𝐀𝐇 𝐀𝐍𝐎𝐖𝐀𝐑 𝐇𝐎𝐒𝐒𝐀𝐍</span></p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[11px]">
                <a className="text-blue-400 hover:text-blue-300" href="https://www.facebook.com/profile.php?id=61590404766833" target="_blank" rel="noreferrer">Facebook · AH ANOWAR</a>
                <a className="text-cyan-400 hover:text-cyan-300" href="https://www.tiktok.com/@ah_anowar" target="_blank" rel="noreferrer">TikTok · @ah_anowar</a>
                <a className="text-sky-400 hover:text-sky-300" href="https://t.me/AH_ANOWAR" target="_blank" rel="noreferrer">Telegram · @AH_ANOWAR</a>
                <a className="text-green-400 hover:text-green-300" href="https://wa.me/8801609591314" target="_blank" rel="noreferrer">WhatsApp</a>
              </div>
            </div>
            <span>{dashboardLoading ? "Loading workspace data..." : "Workspace dashboard"}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
