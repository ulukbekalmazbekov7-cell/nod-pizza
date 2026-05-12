-- График смен: одна «документная» строка на slug, payload JSONB — удобно расширять полями без ломки UI.
-- Выполни в Supabase → SQL Editor (одним запуском).

create table if not exists public.shift_schedule_snapshots (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shift_schedule_snapshots_updated_at_idx
  on public.shift_schedule_snapshots (updated_at desc);

comment on table public.shift_schedule_snapshots is 'Снимки графика смен (QC). payload: schemaVersion + employees + assignments + опциональные поля в будущем.';

alter table public.shift_schedule_snapshots enable row level security;

-- Залогиненные пользователи (Supabase Auth) могут читать и писать.
create policy "shift_schedules_select_authenticated"
  on public.shift_schedule_snapshots
  for select
  to authenticated
  using (true);

create policy "shift_schedules_insert_authenticated"
  on public.shift_schedule_snapshots
  for insert
  to authenticated
  with check (true);

create policy "shift_schedules_update_authenticated"
  on public.shift_schedule_snapshots
  for update
  to authenticated
  using (true)
  with check (true);

create policy "shift_schedules_delete_authenticated"
  on public.shift_schedule_snapshots
  for delete
  to authenticated
  using (true);
