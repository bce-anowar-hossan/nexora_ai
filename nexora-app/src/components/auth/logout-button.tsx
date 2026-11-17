"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg border border-[#34435D] px-4 py-2 text-sm text-slate-300 transition hover:border-red-500 hover:text-red-400 disabled:opacity-50"
    >
      <LogOut size={17} />
      {loading ? "Signing out..." : "Logout"}
    </button>
  );
}
