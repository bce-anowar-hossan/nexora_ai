"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, UserPlus, RefreshCw, ShieldCheck } from "lucide-react";

type Role = { id: string; name: string; code: string };
type Member = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role_id: string;
  role_name: string;
  role_code: string;
  status: "active" | "suspended";
  joined_at: string;
};

export default function TeamPage() {
  const [companyId, setCompanyId] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setError("Please log in to manage your team.");
      setLoading(false);
      return;
    }

    const { data: memberships, error: memberError } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (memberError || !memberships?.length) {
      setError(memberError?.message || "No active workspace found.");
      setLoading(false);
      return;
    }

    const activeCompanyId = memberships[0].company_id;
    setCompanyId(activeCompanyId);

    const { data, error: teamError } = await supabase.rpc(
      "get_workspace_team",
      { p_company_id: activeCompanyId }
    );

    if (teamError) {
      setError(teamError.message);
      setLoading(false);
      return;
    }

    const result = data as { roles: Role[]; members: Member[] };
    setRoles(result.roles || []);
    setMembers(result.members || []);
    setRoleId((current) => current || result.roles?.find((r) => r.code === "staff")?.id || "");
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => void loadTeam());
  }, [loadTeam]);

  async function createInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setInviteLink("");

    const { data, error: inviteError } = await supabase.rpc(
      "create_workspace_invitation",
      {
        p_company_id: companyId,
        p_email: email.trim(),
        p_role_id: roleId,
      }
    );

    if (inviteError) {
      setError(inviteError.message);
    } else {
      const link = `${window.location.origin}/invite/accept?token=${encodeURIComponent(data)}`;
      setInviteLink(link);
      setNotice("Invitation link created. Copy it and share it with the invited person.");
      setEmail("");
    }
    setBusy(false);
  }

  async function updateRole(member: Member, nextRoleId: string) {
    setBusy(true);
    setError("");
    const { error: updateError } = await supabase.rpc("set_workspace_member_role", {
      p_company_id: companyId,
      p_member_id: member.id,
      p_role_id: nextRoleId,
    });
    if (updateError) setError(updateError.message);
    else await loadTeam();
    setBusy(false);
  }

  async function toggleStatus(member: Member) {
    setBusy(true);
    setError("");
    const nextStatus = member.status === "active" ? "suspended" : "active";
    const { error: statusError } = await supabase.rpc("set_workspace_member_status", {
      p_company_id: companyId,
      p_member_id: member.id,
      p_status: nextStatus,
    });
    if (statusError) setError(statusError.message);
    else await loadTeam();
    setBusy(false);
  }

  async function copyInvitation() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setNotice("Invitation link copied.");
    } catch {
      setError("Could not copy automatically. Select and copy the invitation link.");
    }
  }

  return (
    <main className="min-h-screen bg-[#080D18] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm text-blue-400">NEXORA AI / Workspace</p>
            <h1 className="text-3xl font-bold">Team Management</h1>
            <p className="mt-2 text-sm text-slate-400">
              Manage workspace members, roles and invitations.
            </p>
          </div>
          <button onClick={() => void loadTeam()} className="flex items-center gap-2 rounded-lg border border-[#334155] px-4 py-2 text-sm hover:bg-white/5">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {error && <p role="alert" className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</p>}

        <section className="mb-8 rounded-2xl border border-[#243149] bg-[#111C2F] p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <UserPlus className="text-blue-400" />
            <div>
              <h2 className="font-semibold">Invite a team member</h2>
              <p className="text-xs text-slate-400">Create a secure, time-limited invitation link.</p>
            </div>
          </div>
          <form onSubmit={createInvitation} className="grid gap-3 sm:grid-cols-[1fr_190px_auto]">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="member@example.com"
              className="min-w-0 rounded-lg border border-[#334155] bg-[#080D18] px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
            <select
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              required
              className="rounded-lg border border-[#334155] bg-[#080D18] px-3 py-3 text-sm"
            >
              {roles.filter((role) => role.code !== "owner").map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
            <button disabled={busy || loading || !companyId || !roleId} className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">
              {busy ? "Please wait..." : "Create invitation"}
            </button>
          </form>
          {inviteLink && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input readOnly value={inviteLink} className="min-w-0 flex-1 rounded-lg border border-[#334155] bg-[#080D18] px-3 py-2 text-xs text-slate-300" />
              <button onClick={() => void copyInvitation()} className="rounded-lg border border-blue-500 px-4 py-2 text-sm text-blue-300">Copy link</button>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#243149] bg-[#111C2F]">
          <div className="flex items-center justify-between border-b border-[#243149] p-5">
            <div className="flex items-center gap-3">
              <Users className="text-blue-400" />
              <h2 className="font-semibold">Workspace members</h2>
            </div>
            <span className="text-xs text-slate-400">{members.length} members</span>
          </div>

          {loading ? (
            <p className="p-8 text-sm text-slate-400">Loading team...</p>
          ) : members.length === 0 ? (
            <p className="p-8 text-sm text-slate-400">No members found.</p>
          ) : (
            <div className="divide-y divide-[#243149]">
              {members.map((member) => (
                <div key={member.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.full_name || member.email || "Workspace member"}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">{member.email}</p>
                    <p className="mt-2 text-xs text-slate-500">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs ${member.status === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
                      {member.status}
                    </span>
                    {member.role_code === "owner" ? (
                      <span className="flex items-center gap-1 rounded-lg border border-[#334155] px-3 py-2 text-xs text-slate-300">
                        <ShieldCheck size={14} /> Owner
                      </span>
                    ) : (
                      <>
                        <select
                          value={member.role_id}
                          disabled={busy}
                          onChange={(event) => void updateRole(member, event.target.value)}
                          className="rounded-lg border border-[#334155] bg-[#080D18] px-3 py-2 text-xs"
                        >
                          {roles.filter((role) => role.code !== "owner").map((role) => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                          ))}
                        </select>
                        <button
                          disabled={busy}
                          onClick={() => void toggleStatus(member)}
                          className="rounded-lg border border-[#475569] px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-50"
                        >
                          {member.status === "active" ? "Suspend" : "Reactivate"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <p className="mt-5 text-xs text-slate-500">
          All member and role changes are verified by database permissions. The workspace owner cannot be changed or suspended here.
        </p>
      </div>
    </main>
  );
}
