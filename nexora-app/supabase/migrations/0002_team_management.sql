-- NEXORA AI: Team management, invitations and role authorization
-- Existing tables and policies are preserved.

create or replace function public.get_workspace_team(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.company_members cm
    join public.role_permissions rp on rp.role_id = cm.role_id
    join public.permissions p on p.id = rp.permission_id
    where cm.company_id = p_company_id
      and cm.user_id = v_user_id
      and cm.status = 'active'
      and p.code in ('members.view', 'members.manage')
  ) then
    raise exception 'You do not have permission to view team members';
  end if;

  select jsonb_build_object(
    'roles',
    coalesce((
      select jsonb_agg(
        jsonb_build_object('id', r.id, 'name', r.name, 'code', r.code)
        order by r.name
      )
      from public.roles r
      where r.company_id = p_company_id
    ), '[]'::jsonb),
    'members',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', cm.id,
          'user_id', cm.user_id,
          'email', u.email,
          'full_name', pr.full_name,
          'role_id', cm.role_id,
          'role_name', r.name,
          'role_code', r.code,
          'status', cm.status,
          'joined_at', cm.joined_at
        )
        order by cm.joined_at
      )
      from public.company_members cm
      join auth.users u on u.id = cm.user_id
      left join public.profiles pr on pr.id = cm.user_id
      join public.roles r on r.id = cm.role_id
      where cm.company_id = p_company_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.create_workspace_invitation(
  p_company_id uuid,
  p_email text,
  p_role_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_token text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email address is required';
  end if;

  if not exists (
    select 1
    from public.company_members cm
    join public.role_permissions rp on rp.role_id = cm.role_id
    join public.permissions p on p.id = rp.permission_id
    where cm.company_id = p_company_id
      and cm.user_id = v_user_id
      and cm.status = 'active'
      and p.code in ('members.invite', 'members.manage')
  ) then
    raise exception 'You do not have permission to invite members';
  end if;

  if not exists (
    select 1 from public.roles
    where id = p_role_id and company_id = p_company_id
      and code <> 'owner'
  ) then
    raise exception 'Invalid role';
  end if;

  if exists (
    select 1
    from public.company_members cm
    join auth.users u on u.id = cm.user_id
    where cm.company_id = p_company_id
      and lower(u.email) = v_email
      and cm.status = 'active'
  ) then
    raise exception 'This person is already a workspace member';
  end if;

  if exists (
    select 1 from public.invitations
    where company_id = p_company_id
      and lower(email) = v_email
      and status = 'pending'
      and expires_at > now()
  ) then
    raise exception 'A pending invitation already exists for this email';
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.invitations (
    company_id, email, role_id, invited_by, token_hash
  )
  values (
    p_company_id,
    v_email,
    p_role_id,
    v_user_id,
    encode(pg_catalog.sha256(pg_catalog.convert_to(v_token, 'UTF8')), 'hex')
  );

  return v_token;
end;
$$;

create or replace function public.accept_workspace_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invitation public.invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Please log in before accepting an invitation';
  end if;

  if p_token is null or length(p_token) < 32 then
    raise exception 'Invalid invitation token';
  end if;

  select * into v_invitation
  from public.invitations
  where token_hash = encode(
    pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex'
  )
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'This invitation is no longer active';
  end if;

  if v_invitation.expires_at <= now() then
    update public.invitations
    set status = 'expired'
    where id = v_invitation.id;
    raise exception 'This invitation has expired';
  end if;

  if v_email = '' or v_email <> lower(v_invitation.email) then
    raise exception 'Please log in with the email address that received this invitation';
  end if;

  insert into public.company_members (company_id, user_id, role_id, status)
  values (
    v_invitation.company_id,
    v_user_id,
    v_invitation.role_id,
    'active'
  )
  on conflict (company_id, user_id)
  do update set
    role_id = excluded.role_id,
    status = 'active';

  update public.invitations
  set status = 'accepted'
  where id = v_invitation.id;

  return v_invitation.company_id;
end;
$$;

create or replace function public.set_workspace_member_role(
  p_company_id uuid,
  p_member_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.company_members cm
    join public.role_permissions rp on rp.role_id = cm.role_id
    join public.permissions p on p.id = rp.permission_id
    where cm.company_id = p_company_id
      and cm.user_id = v_user_id
      and cm.status = 'active'
      and p.code = 'members.manage'
  ) then
    raise exception 'You do not have permission to manage members';
  end if;

  if not exists (
    select 1 from public.roles
    where id = p_role_id and company_id = p_company_id
      and code <> 'owner'
  ) then
    raise exception 'Invalid role';
  end if;

  if exists (
    select 1
    from public.company_members cm
    join public.companies c on c.id = cm.company_id
    where cm.id = p_member_id
      and cm.company_id = p_company_id
      and (cm.user_id = c.owner_id)
  ) then
    raise exception 'The workspace owner role cannot be changed';
  end if;

  update public.company_members
  set role_id = p_role_id
  where id = p_member_id
    and company_id = p_company_id;

  if not found then
    raise exception 'Member not found';
  end if;
end;
$$;

create or replace function public.set_workspace_member_status(
  p_company_id uuid,
  p_member_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_status not in ('active', 'suspended') then
    raise exception 'Invalid member status';
  end if;

  if not exists (
    select 1
    from public.company_members cm
    join public.role_permissions rp on rp.role_id = cm.role_id
    join public.permissions p on p.id = rp.permission_id
    where cm.company_id = p_company_id
      and cm.user_id = v_user_id
      and cm.status = 'active'
      and p.code = 'members.manage'
  ) then
    raise exception 'You do not have permission to manage members';
  end if;

  if exists (
    select 1
    from public.company_members cm
    join public.companies c on c.id = cm.company_id
    where cm.id = p_member_id
      and cm.company_id = p_company_id
      and (cm.user_id = c.owner_id or cm.user_id = v_user_id)
  ) then
    raise exception 'You cannot suspend yourself or the workspace owner';
  end if;

  update public.company_members
  set status = p_status
  where id = p_member_id
    and company_id = p_company_id;

  if not found then
    raise exception 'Member not found';
  end if;
end;
$$;

revoke all on function public.get_workspace_team(uuid) from public;
revoke all on function public.create_workspace_invitation(uuid, text, uuid) from public;
revoke all on function public.accept_workspace_invitation(text) from public;
revoke all on function public.set_workspace_member_role(uuid, uuid, uuid) from public;
revoke all on function public.set_workspace_member_status(uuid, uuid, text) from public;

grant execute on function public.get_workspace_team(uuid) to authenticated;
grant execute on function public.create_workspace_invitation(uuid, text, uuid) to authenticated;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
grant execute on function public.set_workspace_member_role(uuid, uuid, uuid) to authenticated;
grant execute on function public.set_workspace_member_status(uuid, uuid, text) to authenticated;
