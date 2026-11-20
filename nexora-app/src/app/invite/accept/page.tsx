"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accountEmail, setAccountEmail] = useState("");

  async function acceptInvitation() {
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      const token = new URLSearchParams(window.location.search).get("token");

      if (!token) {
        throw new Error("Invitation token is missing.");
      }

      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      setAccountEmail(user?.email ?? "Not logged in");

      if (!user) {
        const next = `/invite/accept?token=${encodeURIComponent(token)}`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const { error } = await supabase.rpc(
        "accept_workspace_invitation",
        { p_token: token }
      );

      if (error) throw error;

      setMessage("Invitation accepted. Opening your workspace...");

      router.replace("/");
      router.refresh();
    } catch (error: unknown) {
      console.error("Invitation acceptance failed:", error);

      const details =
        typeof error === "object" && error !== null
          ? JSON.stringify(error, Object.getOwnPropertyNames(error))
          : String(error);

      setMessage(details || "Unknown invitation error. Check browser console.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080D18] px-4 text-white">
      <section className="w-full max-w-md rounded-2xl border border-[#243149] bg-[#111C2F] p-8 text-center">
        <h1 className="text-2xl font-bold">Workspace invitation</h1>

        <p className="mt-3 text-sm text-slate-400">
          Accept this invitation to join the workspace using the email address it was sent to.
        </p>

        {accountEmail && (
          <p className="mt-4 break-words text-sm text-slate-300">
            Logged-in email: {accountEmail}
          </p>
        )}

        {message && (
          <p
            role="status"
            className="mt-5 break-words rounded-lg bg-blue-500/10 p-3 text-sm text-blue-200"
          >
            {message}
          </p>
        )}

        <button
          onClick={() => void acceptInvitation()}
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? "Please wait..." : "Accept invitation"}
        </button>
      </section>
    </main>
  );
}
