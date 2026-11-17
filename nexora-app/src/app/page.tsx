
"use client";

import { useState } from "react";
import LogoutButton from "@/components/auth/logout-button";
import {
  LayoutDashboard, Bot, Package, ShoppingCart,
  Users, MessageSquare, Share2, CalendarDays,
  Workflow, Megaphone, ChartNoAxesCombined,
  Plug, Settings, Bell, Search, Menu, X,
  TrendingUp, ArrowUpRight,
  Sparkles, Clock3, CircleCheck, MoreHorizontal,
  Plus, ChevronDown
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
];

const stats = [
  { label: "Total Revenue", value: "$24,580", change: "+12.8%", icon: TrendingUp },
  { label: "Total Orders", value: "1,284", change: "+8.2%", icon: ShoppingCart },
  { label: "Customers", value: "8,549", change: "+14.5%", icon: Users },
  { label: "AI Conversations", value: "3,642", change: "+18.3%", icon: Bot },
];

const orders = [
  { id: "#NX-1024", customer: "Alex Morgan", product: "Premium Headphones", amount: "$129.00", status: "Confirmed" },
  { id: "#NX-1023", customer: "Sarah Wilson", product: "Smart Watch Pro", amount: "$249.00", status: "Processing" },
  { id: "#NX-1022", customer: "James Cooper", product: "Wireless Keyboard", amount: "$89.00", status: "Pending" },
  { id: "#NX-1021", customer: "Emily Davis", product: "USB-C Hub", amount: "$59.00", status: "Delivered" },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("Overview");
  const [language, setLanguage] = useState("EN");

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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <Sparkles size={22} />
            </div>
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
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[2px] text-slate-500">Workspace</p>
          <button className="flex w-full items-center gap-3 rounded-xl border border-[#243149] bg-[#111C2F] p-3 text-left">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">N</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">My Business</p>
              <p className="text-xs text-slate-500">Free workspace</p>
            </div>
            <ChevronDown size={16} className="text-slate-500" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[2px] text-slate-500">Main Menu</p>
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => { setActive(label); setMenuOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active === label ? "bg-blue-600/15 font-semibold text-blue-400" : "text-slate-400 hover:bg-[#111C2F] hover:text-white"}`}
            >
              <Icon size={18} />
              {label}
              {label === "AI Assistant" && <span className="ml-auto rounded-md bg-purple-500/15 px-2 py-0.5 text-[10px] text-purple-400">AI</span>}
            </button>
          ))}
          <p className="mb-3 mt-7 px-3 text-[10px] font-bold uppercase tracking-[2px] text-slate-500">Preferences</p>
          <button onClick={() => setActive("Settings")} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${active === "Settings" ? "bg-blue-600/15 text-blue-400" : "text-slate-400 hover:bg-[#111C2F]"}`}>
            <Settings size={18} /> Settings
          </button>
        </nav>

        <div className="border-t border-[#243149] p-4">
          <div className="flex items-center gap-3 rounded-xl bg-[#111C2F] p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold">A</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Admin User</p>
              <p className="text-xs text-slate-500">Workspace Admin</p>
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
              <h2 className="text-lg font-bold">{active}</h2>
              <p className="hidden text-xs text-slate-500 sm:block">Welcome back! Here&apos;s your business overview.</p>
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
            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold sm:flex">A</div>
          </div>
        </header>

        <div className="space-y-7 p-4 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Good morning, Admin 👋</h2>
              <p className="mt-1 text-sm text-slate-400">Here&apos;s what&apos;s happening with your business today.</p>
            </div>
            <button className="premium-button flex items-center gap-2 px-4 py-2.5 text-sm font-semibold">
              <Plus size={17} /> Create New
            </button>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(({ label, value, change, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-[#243149] bg-[#111C2F] p-5">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                    <Icon size={20} />
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-400">
                    <TrendingUp size={13} /> {change}
                  </span>
                </div>
                <p className="mt-5 text-sm text-slate-400">{label}</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight">{value}</h3>
                <p className="mt-2 text-xs text-slate-500">Compared to last month</p>
              </div>
            ))}
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-[#243149] bg-[#111C2F] p-6 xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">Revenue Overview</h3>
                  <p className="mt-1 text-xs text-slate-500">Sample dashboard data · Not connected to a live store</p>
                </div>
                <button className="rounded-lg border border-[#243149] px-3 py-2 text-xs text-slate-300">Last 7 days <ChevronDown size={13} className="ml-2 inline" /></button>
              </div>
              <div className="mt-8 flex h-48 items-end justify-between gap-2">
                {[35, 52, 42, 70, 56, 86, 64, 92, 68, 78, 57, 96].map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end">
                    <div className="w-full rounded-t-md bg-gradient-to-t from-blue-700 to-blue-400 opacity-80 transition hover:opacity-100" style={{ height: `${height}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-slate-500">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>

            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[#17152D] to-[#111C2F] p-6">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-purple-500/15 p-2 text-purple-400"><Bot size={20} /></div>
                <span className="text-sm font-bold">NEXORA AI Assistant</span>
              </div>
              <p className="mt-5 text-lg font-semibold">Your AI workspace is ready.</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Connect your business data to prepare AI-powered customer support and automation.</p>
              <div className="mt-5 rounded-xl border border-purple-500/20 bg-black/20 p-3">
                <div className="flex items-center gap-2 text-xs text-purple-300"><Sparkles size={14} /> Demo mode</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">AI integrations are not connected yet. No messages are being sent.</p>
              </div>
              <button onClick={() => setActive("AI Assistant")} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold hover:bg-purple-500">
                Explore AI Assistant <ArrowUpRight size={16} />
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#243149] bg-[#111C2F]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#243149] p-5 sm:p-6">
              <div>
                <h3 className="font-bold">Recent Orders</h3>
                <p className="mt-1 text-xs text-slate-500">Sample records for UI preview</p>
              </div>
              <button onClick={() => setActive("Orders")} className="text-xs font-semibold text-blue-400 hover:text-blue-300">View all orders <ArrowUpRight size={14} className="ml-1 inline" /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-[#0D1422] text-xs text-slate-500">
                  <tr><th className="px-6 py-4 font-medium">Order ID</th><th className="px-6 py-4 font-medium">Customer</th><th className="px-6 py-4 font-medium">Product</th><th className="px-6 py-4 font-medium">Amount</th><th className="px-6 py-4 font-medium">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-[#243149]">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-white/[0.02]">
                      <td className="px-6 py-4 font-semibold text-blue-400">{order.id}</td>
                      <td className="px-6 py-4">{order.customer}</td>
                      <td className="px-6 py-4 text-slate-400">{order.product}</td>
                      <td className="px-6 py-4 font-semibold">{order.amount}</td>
                      <td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${order.status === "Confirmed" ? "bg-green-500/10 text-green-400" : order.status === "Processing" ? "bg-blue-500/10 text-blue-400" : order.status === "Delivered" ? "bg-purple-500/10 text-purple-400" : "bg-amber-500/10 text-amber-400"}`}>{order.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[#243149] bg-[#111C2F] p-6">
              <h3 className="font-bold">Recent Activity</h3>
              <div className="mt-5 space-y-5">
                <div className="flex gap-3"><CircleCheck size={18} className="text-green-400" /><div><p className="text-sm">Dashboard workspace initialized</p><p className="mt-1 text-xs text-slate-500">System setup · Just now</p></div></div>
                <div className="flex gap-3"><Package size={18} className="text-blue-400" /><div><p className="text-sm">Product module ready for setup</p><p className="mt-1 text-xs text-slate-500">Products · Demo</p></div></div>
                <div className="flex gap-3"><Clock3 size={18} className="text-purple-400" /><div><p className="text-sm">Integrations awaiting configuration</p><p className="mt-1 text-xs text-slate-500">Integrations · Pending</p></div></div>
              </div>
            </div>
            <div className="rounded-2xl border border-[#243149] bg-[#111C2F] p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Quick Actions</h3>
                <MoreHorizontal size={20} className="text-slate-500" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  { label: "Add Product", icon: Package, target: "Products" },
                  { label: "View Orders", icon: ShoppingCart, target: "Orders" },
                  { label: "Customers", icon: Users, target: "Customers" },
                  { label: "Automations", icon: Workflow, target: "Automations" },
                ].map(({ label, icon: Icon, target }) => (
                  <button key={label} onClick={() => setActive(target)} className="flex flex-col items-start gap-3 rounded-xl border border-[#243149] bg-[#0D1422] p-4 text-left transition hover:border-blue-500/50">
                    <Icon size={20} className="text-blue-400" />
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#243149] py-5 text-xs text-slate-500">
            <span>© 2026 NEXORA AI. All rights reserved.</span>
            <span>Platform preview · Demo data only</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
