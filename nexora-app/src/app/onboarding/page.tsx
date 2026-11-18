"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const cleanName = companyName.trim();

    if (cleanName.length < 2) {
      setError("Business name must contain at least 2 characters.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error: createError } = await supabase.rpc("create_company", {
        p_name: cleanName,
      });

      if (createError) {
        setError(createError.message);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080D18] px-4 py-10 text-white">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-400">
            <Building2 size={28} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Create your workspace</h1>
          <p className="mt-3 text-sm text-slate-400">
            Set up your business workspace to get started with NEXORA AI.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[#243149] bg-[#111C2F] p-6 shadow-xl sm:p-8"
        >
          <label htmlFor="companyName" className="mb-2 block text-sm font-medium text-slate-200">
            Business name
          </label>

          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. My Online Store"
            maxLength={100}
            required
            disabled={loading}
            className="w-full rounded-xl border border-[#334155] bg-[#080D18] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
          />

          {error && (
            <p role="alert" className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || companyName.trim().length < 2}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Creating workspace...
              </>
            ) : (
              <>
                Create workspace
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <p className="mt-5 text-center text-xs leading-5 text-slate-500">
            You will become the workspace owner. You can invite team members later.
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          NEXORA AI · Business Automation Platform
        </p>
      </div>
    </main>
  );
}
