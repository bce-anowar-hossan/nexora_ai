begin;

-- AI permissions
insert into public.permissions (code, description)
values
  ('conversations.view', 'View AI conversations and messages'),
  ('conversations.manage', 'Create and manage AI conversations and messages')
on conflict (code) do nothing;

-- Grant permissions to existing workspace roles
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where
  (r.code in ('owner', 'admin') and p.code in ('conversations.view', 'conversations.manage'))
  or (r.code = 'manager' and p.code in ('conversations.view', 'conversations.manage'))
  or (r.code = 'staff' and p.code = 'conversations.view')
on conflict do nothing;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null default 'New conversation'
    check (char_length(title) between 1 and 200),
  status text not null default 'open'
    check (status in ('open', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, company_id)
    references public.conversations(id, company_id) on delete cascade
);

create index if not exists conversations_company_updated_idx
  on public.conversations(company_id, updated_at desc);

create index if not exists conversation_messages_thread_idx
  on public.conversation_messages(company_id, conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists "conversations_select" on public.conversations;
create policy "conversations_select"
on public.conversations for select to authenticated
using (
  public.has_company_permission(company_id, 'conversations.view')
);

drop policy if exists "conversations_insert" on public.conversations;
create policy "conversations_insert"
on public.conversations for insert to authenticated
with check (
  public.has_company_permission(company_id, 'conversations.manage')
  and (created_by is null or created_by = (select auth.uid()))
);

drop policy if exists "conversations_update" on public.conversations;
create policy "conversations_update"
on public.conversations for update to authenticated
using (
  public.has_company_permission(company_id, 'conversations.manage')
)
with check (
  public.has_company_permission(company_id, 'conversations.manage')
);

drop policy if exists "conversations_delete" on public.conversations;
create policy "conversations_delete"
on public.conversations for delete to authenticated
using (
  public.has_company_permission(company_id, 'conversations.manage')
);

drop policy if exists "conversation_messages_select" on public.conversation_messages;
create policy "conversation_messages_select"
on public.conversation_messages for select to authenticated
using (
  public.has_company_permission(company_id, 'conversations.view')
);

drop policy if exists "conversation_messages_insert" on public.conversation_messages;
create policy "conversation_messages_insert"
on public.conversation_messages for insert to authenticated
with check (
  public.has_company_permission(company_id, 'conversations.manage')
);

drop policy if exists "conversation_messages_delete" on public.conversation_messages;
create policy "conversation_messages_delete"
on public.conversation_messages for delete to authenticated
using (
  public.has_company_permission(company_id, 'conversations.manage')
);

revoke all on public.conversations from anon, public;
revoke all on public.conversation_messages from anon, public;

grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, delete on public.conversation_messages to authenticated;

commit;
