-- Роли, профили, аудит, фото инспекций и узкая RLS по филиалам.
-- Выполни в Supabase → SQL Editor (после базовых таблиц branches / employees / inspections).

-- ─── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'qc' check (role in ('admin', 'manager', 'qc')),
  full_name text,
  branch_id bigint references public.branches (id) on delete set null,
  branch_ids bigint[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_branch_id_idx on public.profiles (branch_id);

alter table public.profiles enable row level security;

-- ─── inspections: статус и автор ─────────────────────────────────────────────
alter table public.inspections
  add column if not exists status text not null default 'completed';

alter table public.inspections
  add column if not exists author_id uuid references auth.users (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inspections_status_check'
  ) then
    alter table public.inspections
      add constraint inspections_status_check
      check (status in ('draft', 'in_progress', 'completed', 'needs_review'));
  end if;
end $$;

-- ─── audit_logs ──────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

-- ─── inspection_photos ───────────────────────────────────────────────────────
create table if not exists public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id bigint not null references public.inspections (id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inspection_photos_inspection_id_idx
  on public.inspection_photos (inspection_id);

alter table public.inspection_photos enable row level security;

-- ─── shift_schedule_snapshots: метаданные ────────────────────────────────────
alter table public.shift_schedule_snapshots
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

alter table public.shift_schedule_snapshots
  add column if not exists branch_id bigint references public.branches (id) on delete set null;

alter table public.shift_schedule_snapshots
  add column if not exists period_label text;

-- ─── Storage: inspection-photos (приватный bucket) ───────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspection-photos',
  'inspection-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ─── helpers (security definer) ──────────────────────────────────────────────
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'qc'
  );
$$;

create or replace function public.user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.user_can_access_branch(bid bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_user_role()
    when 'admin' then true
    when 'manager' then bid = (
      select branch_id from public.profiles where id = auth.uid()
    )
    when 'qc' then bid = any (
      coalesce(
        (select branch_ids from public.profiles where id = auth.uid()),
        '{}'::bigint[]
      )
    )
    else false
  end;
$$;

create or replace function public.audit_log_insert(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.user_is_admin() from public;
revoke all on function public.user_can_access_branch(bigint) from public;
revoke all on function public.audit_log_insert(text, text, text, jsonb) from public;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.user_is_admin() to authenticated;
grant execute on function public.user_can_access_branch(bigint) to authenticated;
grant execute on function public.audit_log_insert(text, text, text, jsonb) to authenticated;

-- ─── profiles policies ───────────────────────────────────────────────────────
drop policy if exists profiles_corp_auth_all on public.profiles;
drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_update_own_or_admin on public.profiles;
drop policy if exists profiles_insert_admin on public.profiles;

create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.user_is_admin());

create policy profiles_update_own_or_admin
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() or public.user_is_admin())
  with check (id = auth.uid() or public.user_is_admin());

create policy profiles_insert_admin
  on public.profiles
  for insert
  to authenticated
  with check (public.user_is_admin() or id = auth.uid());

-- ─── branches ────────────────────────────────────────────────────────────────
drop policy if exists branches_corp_auth_all on public.branches;
drop policy if exists branches_role_select on public.branches;
drop policy if exists branches_role_write on public.branches;

create policy branches_role_select
  on public.branches
  for select
  to authenticated
  using (public.user_is_admin() or public.user_can_access_branch(id));

create policy branches_role_write
  on public.branches
  for all
  to authenticated
  using (public.user_is_admin())
  with check (public.user_is_admin());

-- ─── employees ─────────────────────────────────────────────────────────────
drop policy if exists employees_corp_auth_all on public.employees;
drop policy if exists employees_role_select on public.employees;
drop policy if exists employees_role_write on public.employees;

create policy employees_role_select
  on public.employees
  for select
  to authenticated
  using (
    public.user_is_admin()
    or (branch_id is not null and public.user_can_access_branch(branch_id))
  );

create policy employees_role_write
  on public.employees
  for all
  to authenticated
  using (public.user_is_admin())
  with check (public.user_is_admin());

-- ─── inspections ─────────────────────────────────────────────────────────────
drop policy if exists inspections_corp_auth_all on public.inspections;
drop policy if exists inspections_role_select on public.inspections;
drop policy if exists inspections_role_insert on public.inspections;
drop policy if exists inspections_role_update on public.inspections;
drop policy if exists inspections_role_delete on public.inspections;

create policy inspections_role_select
  on public.inspections
  for select
  to authenticated
  using (public.user_is_admin() or public.user_can_access_branch(branch_id));

create policy inspections_role_insert
  on public.inspections
  for insert
  to authenticated
  with check (public.user_is_admin() or public.user_can_access_branch(branch_id));

create policy inspections_role_update
  on public.inspections
  for update
  to authenticated
  using (
    public.user_is_admin()
    or (
      public.user_can_access_branch(branch_id)
      and (author_id is null or author_id = auth.uid())
    )
  )
  with check (public.user_is_admin() or public.user_can_access_branch(branch_id));

create policy inspections_role_delete
  on public.inspections
  for delete
  to authenticated
  using (public.user_is_admin() or author_id = auth.uid());

-- ─── inspection_photos ───────────────────────────────────────────────────────
drop policy if exists inspection_photos_select on public.inspection_photos;
drop policy if exists inspection_photos_insert on public.inspection_photos;
drop policy if exists inspection_photos_delete on public.inspection_photos;

create policy inspection_photos_select
  on public.inspection_photos
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.inspections i
      where i.id = inspection_id
        and (public.user_is_admin() or public.user_can_access_branch(i.branch_id))
    )
  );

create policy inspection_photos_insert
  on public.inspection_photos
  for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1
      from public.inspections i
      where i.id = inspection_id
        and (public.user_is_admin() or public.user_can_access_branch(i.branch_id))
    )
  );

create policy inspection_photos_delete
  on public.inspection_photos
  for delete
  to authenticated
  using (
    public.user_is_admin()
    or uploaded_by = auth.uid()
  );

-- ─── shift_schedule_snapshots ────────────────────────────────────────────────
drop policy if exists shift_schedules_select_authenticated on public.shift_schedule_snapshots;
drop policy if exists shift_schedules_insert_authenticated on public.shift_schedule_snapshots;
drop policy if exists shift_schedules_update_authenticated on public.shift_schedule_snapshots;
drop policy if exists shift_schedules_delete_authenticated on public.shift_schedule_snapshots;
drop policy if exists shift_schedule_snapshots_corp_auth_all on public.shift_schedule_snapshots;
drop policy if exists shift_schedule_snapshots_role_select on public.shift_schedule_snapshots;
drop policy if exists shift_schedule_snapshots_role_write on public.shift_schedule_snapshots;

create policy shift_schedule_snapshots_role_select
  on public.shift_schedule_snapshots
  for select
  to authenticated
  using (
    public.user_is_admin()
    or branch_id is null
    or public.user_can_access_branch(branch_id)
  );

create policy shift_schedule_snapshots_role_write
  on public.shift_schedule_snapshots
  for all
  to authenticated
  using (
    public.user_is_admin()
    or branch_id is null
    or public.user_can_access_branch(branch_id)
  )
  with check (
    public.user_is_admin()
    or branch_id is null
    or public.user_can_access_branch(branch_id)
  );

-- ─── audit_logs (только admin) ───────────────────────────────────────────────
drop policy if exists audit_logs_admin_select on public.audit_logs;
drop policy if exists audit_logs_insert_authenticated on public.audit_logs;

create policy audit_logs_admin_select
  on public.audit_logs
  for select
  to authenticated
  using (public.user_is_admin());

create policy audit_logs_insert_authenticated
  on public.audit_logs
  for insert
  to authenticated
  with check (actor_id = auth.uid() or actor_id is null);

-- ─── storage.objects (inspection-photos) ─────────────────────────────────────
drop policy if exists inspection_photos_storage_select on storage.objects;
drop policy if exists inspection_photos_storage_insert on storage.objects;
drop policy if exists inspection_photos_storage_delete on storage.objects;

create policy inspection_photos_storage_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'inspection-photos');

create policy inspection_photos_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'inspection-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy inspection_photos_storage_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'inspection-photos'
    and (
      public.user_is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
