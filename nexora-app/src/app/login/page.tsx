"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    const requestedNext = new URLSearchParams(window.location.search).get("next");
    const nextPath =
      requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
        ? requestedNext
        : "/";

    router.push(nextPath);
    router.refresh();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070B16] text-white">
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-blue-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-purple-600/15 blur-[120px]" />

      <div className="relative mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-2">
        <section className="flex flex-col justify-between px-7 py-8 sm:px-12 lg:px-16 lg:py-12">
          <Link href="/" className="flex w-fit items-center gap-3">
            <img src="/nexora-mark.svg" alt="NEXORA AI" className="h-12 w-12" />
            <span className="text-2xl font-extrabold tracking-wide">
              NEXORA <span className="text-cyan-400">AI</span>
            </span>
          </Link>

          <div className="mx-auto my-14 max-w-xl lg:my-0">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-xs font-semibold text-cyan-300">
              <Sparkles size={15} /> YOUR BUSINESS, INTELLIGENTLY CONNECTED
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl xl:text-6xl">
              Build smarter.
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Automate faster.
              </span>
              <br />
              Grow bigger.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-slate-400">
              Bring your business operations together in one powerful workspace.
              Manage products, customers, orders and automation with NEXORA AI.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                <Zap className="mb-3 text-cyan-400" size={23} />
                <h2 className="font-bold">One smart workspace</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Your essential business tools in one place.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                <ShieldCheck className="mb-3 text-purple-400" size={23} />
                <h2 className="font-bold">Secure access</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Workspace access with account authentication.</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600">© 2026 NEXORA AI · Build · Automate · Grow</p>
        </section>

        <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:bg-white/[0.02] lg:px-14">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#10182B]/90 p-7 shadow-[0_25px_100px_rgba(0,0,0,.4)] backdrop-blur-xl sm:p-10">
            <div className="mb-8">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-600 to-purple-600 shadow-lg shadow-blue-600/20">
                <img src="/nexora-mark.svg" alt="" className="h-10 w-10" />
              </div>
              <p className="text-sm font-semibold text-cyan-300">WELCOME BACK</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Sign in to NEXORA</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">Access your workspace and continue growing your business.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">Email address</label>
                <input
                  id="email" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-700 bg-[#080E1C] px-4 py-3.5 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="password" className="text-sm font-medium text-slate-300">Password</label>
                  <Link href="/forgot-password" className="text-xs font-semibold text-cyan-400 hover:text-cyan-300">Forgot password?</Link>
                </div>
                <input
                  id="password" type="password" required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-700 bg-[#080E1C] px-4 py-3.5 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
                />
              </div>

              {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3.5 font-bold shadow-lg shadow-blue-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? "Signing in..." : "Sign in to workspace"} <ArrowRight size={18} />
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-slate-400">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-bold text-cyan-400 hover:text-cyan-300">Create account</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
