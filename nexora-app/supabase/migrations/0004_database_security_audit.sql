begin;

-- 1. Tenant audit log
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  record_id text,
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_company_created_idx
  on public.audit_logs (company_id, created_at desc);

create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_user_id);

alter table public.audit_logs enable row level security;

drop policy if exists "Company admins can view audit logs"
  on public.audit_logs;

create policy "Company admins can view audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (
    company_id is not null
    and public.has_company_permission(company_id, 'company.update')
  );

revoke all on public.audit_logs from public, anon;
grant select on public.audit_logs to authenticated;

-- 2. Audit trigger function
create or replace function public.capture_company_audit_log()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  old_data jsonb;
  new_data jsonb;
  row_data jsonb;
  target_company_id uuid;
  target_record_id text;
  changed text[];
  operation_name text;
begin
  if tg_op = 'DELETE' then
    old_data := to_jsonb(old);
    row_data := old_data;
    operation_name := 'DELETE';
  elsif tg_op = 'UPDATE' then
    old_data := to_jsonb(old);
    new_data := to_jsonb(new);
    row_data := new_data;
    operation_name := 'UPDATE';
  else
    new_data := to_jsonb(new);
    row_data := new_data;
    operation_name := 'INSERT';
  end if;

  target_company_id :=
    nullif(row_data ->> 'company_id', '')::uuid;

  -- Companies use their own id as the tenant id.
  if target_company_id is null and tg_table_name = 'companies' then
    target_company_id := nullif(row_data ->> 'id', '')::uuid;
  end if;

  -- role_permissions gets tenant id through its role.
  if target_company_id is null and tg_table_name = 'role_permissions' then
    select r.company_id
      into target_company_id
      from public.roles r
     where r.id = nullif(row_data ->> 'role_id', '')::uuid;
  end if;

  -- Skip records without a resolvable tenant.
  if target_company_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  target_record_id := row_data ->> 'id';

  if tg_op = 'INSERT' then
    select coalesce(array_agg(k.key order by k.key), '{}')
      into changed
      from jsonb_object_keys(new_data) as k(key);
  elsif tg_op = 'DELETE' then
    select coalesce(array_agg(k.key order by k.key), '{}')
      into changed
      from jsonb_object_keys(old_data) as k(key);
  else
    select coalesce(array_agg(n.key order by n.key), '{}')
      into changed
      from jsonb_each(new_data) as n
      left join jsonb_each(old_data) as o on o.key = n.key
     where n.value is distinct from o.value;
  end if;

  insert into public.audit_logs (
    company_id,
    actor_user_id,
    action,
    table_name,
    record_id,
    changed_fields
  )
  values (
    target_company_id,
    auth.uid(),
    operation_name,
    tg_table_name,
    target_record_id,
    changed
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

revoke all on function public.capture_company_audit_log()
  from public, anon, authenticated;

-- 3. Attach audit triggers to tenant business tables.
do $block$
declare
  table_name text;
  table_names text[] := array[
    'companies',
    'company_members',
    'roles',
    'role_permissions',
    'invitations',
    'categories',
    'products',
    'product_variants',
    'product_images',
    'inventory',
    'inventory_movements'
  ];
begin
  foreach table_name in array table_names loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'drop trigger if exists capture_company_audit on public.%I',
        table_name
      );

      execute format(
        'create trigger capture_company_audit
         after insert or update or delete on public.%I
         for each row execute function public.capture_company_audit_log()',
        table_name
      );
    end if;
  end loop;
end;
$block$;

-- 4. Restrict inventory movement attribution.
-- Replace INSERT policies only; preserve SELECT policies.
do $block$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
      from pg_policies
     where schemaname = 'public'
       and tablename = 'inventory_movements'
       and cmd = 'INSERT'
  loop
    execute format(
      'drop policy %I on public.inventory_movements',
      policy_record.policyname
    );
  end loop;
end;
$block$;

create policy "Authorized users insert own inventory movements"
  on public.inventory_movements
  for insert
  to authenticated
  with check (
    public.has_company_permission(company_id, 'products.manage')
    and created_by = (select auth.uid())
  );

-- 5. Harden stock function search_path only.
-- Function implementation and behavior remain unchanged.
alter function public.set_product_stock(uuid, integer, text)
  set search_path to '';

commit;
