-- NEXORA AI: Tenant and RBAC foundation

create extension if not exists pgcrypto;

-- 1. User profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Companies / Workspaces
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Company roles
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (company_id, code),
  unique (id, company_id)
);

-- 4. Permissions
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text
);

-- 5. Role permissions
create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- 6. Company members
create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null,
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  joined_at timestamptz not null default now(),
  foreign key (role_id, company_id)
    references public.roles(id, company_id),
  unique (company_id, user_id)
);

-- 7. Invitations
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  role_id uuid not null,
  invited_by uuid not null references auth.users(id),
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  foreign key (role_id, company_id)
    references public.roles(id, company_id)
);

-- 8. Permission catalog
insert into public.permissions (code, description)
values
  ('company.view', 'View company workspace'),
  ('company.update', 'Update company settings'),
  ('company.delete', 'Delete company'),
  ('members.view', 'View company members'),
  ('members.invite', 'Invite company members'),
  ('members.manage', 'Manage company members'),
  ('roles.view', 'View roles'),
  ('roles.manage', 'Manage roles'),
  ('products.view', 'View products'),
  ('products.manage', 'Manage products'),
  ('orders.view', 'View orders'),
  ('orders.manage', 'Manage orders'),
  ('customers.view', 'View customers'),
  ('customers.manage', 'Manage customers'),
  ('analytics.view', 'View analytics')
on conflict (code) do nothing;

-- 9. Create a profile automatically after signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 10. Create a workspace and its owner in one transaction
create or replace function public.create_company(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_company_id uuid;
  v_owner_role_id uuid;
  v_admin_role_id uuid;
  v_manager_role_id uuid;
  v_staff_role_id uuid;
  v_slug text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Company name must contain at least 2 characters';
  end if;

  v_slug :=
    trim(both '-' from
      regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g')
    ) || '-' || left(gen_random_uuid()::text, 8);

  insert into public.companies (name, slug, owner_id)
  values (trim(p_name), v_slug, v_user_id)
  returning id into v_company_id;

  insert into public.roles (company_id, name, code, description)
  values
    (v_company_id, 'Owner', 'owner', 'Full workspace access'),
    (v_company_id, 'Admin', 'admin', 'Administrative workspace access'),
    (v_company_id, 'Manager', 'manager', 'Manage daily business operations'),
    (v_company_id, 'Staff', 'staff', 'Limited operational access');

  select id into v_owner_role_id
  from public.roles
  where company_id = v_company_id and code = 'owner';

  select id into v_admin_role_id
  from public.roles
  where company_id = v_company_id and code = 'admin';

  select id into v_manager_role_id
  from public.roles
  where company_id = v_company_id and code = 'manager';

  select id into v_staff_role_id
  from public.roles
  where company_id = v_company_id and code = 'staff';

  -- Owner receives every permission
  insert into public.role_permissions (role_id, permission_id)
  select v_owner_role_id, id
  from public.permissions;

  -- Admin receives all permissions except company deletion
  insert into public.role_permissions (role_id, permission_id)
  select v_admin_role_id, id
  from public.permissions
  where code <> 'company.delete';

  -- Manager receives operational permissions
  insert into public.role_permissions (role_id, permission_id)
  select v_manager_role_id, id
  from public.permissions
  where code in (
    'company.view',
    'members.view',
    'products.view', 'products.manage',
    'orders.view', 'orders.manage',
    'customers.view', 'customers.manage',
    'analytics.view'
  );

  -- Staff receives view permissions
  insert into public.role_permissions (role_id, permission_id)
  select v_staff_role_id, id
  from public.permissions
  where code in (
    'company.view',
    'products.view',
    'orders.view',
    'customers.view'
  );

  insert into public.company_members (company_id, user_id, role_id)
  values (v_company_id, v_user_id, v_owner_role_id);

  return v_company_id;
end;
$$;

-- 11. Enable Row Level Security.
-- Policies will be added in the security phase before app data access.
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.company_members enable row level security;
alter table public.invitations enable row level security;

revoke all on function public.create_company(text) from public;
grant execute on function public.create_company(text) to authenticated;
