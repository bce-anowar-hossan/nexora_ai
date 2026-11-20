begin;

-- Remove duplicate SELECT policies.
drop policy if exists "Members can view their companies" on public.companies;
drop policy if exists "Members can view their company members" on public.company_members;
drop policy if exists "Members can view company roles" on public.roles;

-- Membership writes must go through protected SECURITY DEFINER RPCs.
drop policy if exists "Authorized admins can add company members" on public.company_members;
drop policy if exists "Authorized admins can remove company members" on public.company_members;
drop policy if exists "Authorized admins can update company members" on public.company_members;

-- Role and permission changes must not bypass protected RPC logic.
drop policy if exists "Authorized admins can manage roles" on public.roles;
drop policy if exists "Authorized admins can manage role permissions" on public.role_permissions;

-- Invitations are created and accepted through protected RPCs.
drop policy if exists "Authorized members can create invitations" on public.invitations;
drop policy if exists "Authorized members can update invitations" on public.invitations;

-- Restrict permission helper functions to authenticated users.
revoke all on function public.has_company_permission(uuid, text) from public, anon;
grant execute on function public.has_company_permission(uuid, text) to authenticated;

revoke all on function public.is_company_member(uuid) from public, anon;
grant execute on function public.is_company_member(uuid) to authenticated;

commit;
