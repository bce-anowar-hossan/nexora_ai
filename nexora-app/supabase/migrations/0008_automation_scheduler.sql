insert into public.permissions (code, description)
values
  ('automations.view', 'View company automations and execution logs'),
  ('automations.manage', 'Create and manage company automations')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('owner', 'admin', 'manager')
  and p.code in ('automations.view', 'automations.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'staff'
  and p.code = 'automations.view'
on conflict do nothing;

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  description text,
  trigger_type text not null check (
    trigger_type in ('manual', 'schedule', 'order_created', 'customer_created')
  ),
  action_type text not null check (
    action_type in ('demo_notification', 'demo_order_update', 'demo_customer_tag')
  ),
  config jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'paused')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  automation_id uuid not null,
  status text not null default 'success' check (status in ('success', 'failed')),
  result jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  constraint automation_runs_tenant_fk
    foreign key (automation_id, company_id)
    references public.automations(id, company_id) on delete cascade
);

create index if not exists automations_company_created_idx
  on public.automations(company_id, created_at desc);

create index if not exists automation_runs_company_started_idx
  on public.automation_runs(company_id, started_at desc);

alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;

drop policy if exists automations_select on public.automations;
create policy automations_select on public.automations
for select to authenticated
using (public.has_company_permission(company_id, 'automations.view'));

drop policy if exists automations_insert on public.automations;
create policy automations_insert on public.automations
for insert to authenticated
with check (public.has_company_permission(company_id, 'automations.manage'));

drop policy if exists automations_update on public.automations;
create policy automations_update on public.automations
for update to authenticated
using (public.has_company_permission(company_id, 'automations.manage'))
with check (public.has_company_permission(company_id, 'automations.manage'));

drop policy if exists automations_delete on public.automations;
create policy automations_delete on public.automations
for delete to authenticated
using (public.has_company_permission(company_id, 'automations.manage'));

drop policy if exists automation_runs_select on public.automation_runs;
create policy automation_runs_select on public.automation_runs
for select to authenticated
using (public.has_company_permission(company_id, 'automations.view'));

drop policy if exists automation_runs_insert on public.automation_runs;
create policy automation_runs_insert on public.automation_runs
for insert to authenticated
with check (public.has_company_permission(company_id, 'automations.manage'));

revoke all on public.automations from anon;
revoke all on public.automation_runs from anon;
grant select, insert, update, delete on public.automations to authenticated;
grant select, insert on public.automation_runs to authenticated;
