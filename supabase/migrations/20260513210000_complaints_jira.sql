-- Жалобы / задачи операторов с синхронизацией в Jira.

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  branch_id bigint not null references public.branches (id) on delete restrict,
  source text not null check (source in ('phone', 'app', 'delivery', 'hall', 'rocket', 'other')),
  request_type text not null,
  category text not null default '',
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  priority text not null check (priority in ('low', 'medium', 'high', 'critical')),
  complaint_text text not null,
  customer_name text,
  customer_phone text,
  invoice_number text,
  table_number text,
  floor text,
  has_media boolean not null default false,
  operator_comment text,
  status text not null default 'created' check (
    status in ('created', 'assigned', 'in_progress', 'correction_check', 'closed')
  ),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  jira_issue_key text,
  jira_issue_url text,
  jira_sync_status text not null default 'pending' check (
    jira_sync_status in ('pending', 'success', 'failed')
  ),
  jira_sync_error text
);

create index if not exists complaints_branch_id_idx on public.complaints (branch_id);
create index if not exists complaints_status_idx on public.complaints (status);
create index if not exists complaints_created_at_idx on public.complaints (created_at desc);
create index if not exists complaints_jira_sync_status_idx on public.complaints (jira_sync_status);

create or replace function public.set_complaints_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists complaints_set_updated_at on public.complaints;

create trigger complaints_set_updated_at
  before update on public.complaints
  for each row
  execute function public.set_complaints_updated_at();

alter table public.complaints enable row level security;

drop policy if exists complaints_select on public.complaints;
drop policy if exists complaints_insert on public.complaints;
drop policy if exists complaints_update on public.complaints;
drop policy if exists complaints_delete on public.complaints;

create policy complaints_select
  on public.complaints
  for select
  to authenticated
  using (public.user_is_admin() or public.user_can_access_branch(branch_id));

create policy complaints_insert
  on public.complaints
  for insert
  to authenticated
  with check (public.user_is_admin() or public.user_can_access_branch(branch_id));

create policy complaints_update
  on public.complaints
  for update
  to authenticated
  using (public.user_is_admin() or public.user_can_access_branch(branch_id))
  with check (public.user_is_admin() or public.user_can_access_branch(branch_id));

create policy complaints_delete
  on public.complaints
  for delete
  to authenticated
  using (public.user_is_admin());
