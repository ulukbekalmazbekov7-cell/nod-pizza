-- Справочник критериев QC и результаты по проверкам.
-- Выполни после миграций branches / inspections / roles.

-- ─── inspection_categories ───────────────────────────────────────────────────
create table if not exists public.inspection_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists inspection_categories_sort_order_idx
  on public.inspection_categories (sort_order);

alter table public.inspection_categories enable row level security;

-- ─── inspection_criteria ───────────────────────────────────────────────────
create table if not exists public.inspection_criteria (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.inspection_categories (id) on delete cascade,
  title text not null,
  severity text not null check (
    severity in ('minor', 'medium', 'critical', 'none', 'informational')
  ),
  score_impact integer not null default 0,
  is_evaluated boolean not null default true,
  sort_order integer not null,
  description text,
  created_at timestamptz not null default now(),
  unique (category_id, title)
);

create index if not exists inspection_criteria_category_sort_idx
  on public.inspection_criteria (category_id, sort_order);

alter table public.inspection_criteria enable row level security;

-- ─── inspection_results ──────────────────────────────────────────────────────
create table if not exists public.inspection_results (
  id uuid primary key default gen_random_uuid(),
  inspection_id bigint not null references public.inspections (id) on delete cascade,
  criterion_id uuid not null references public.inspection_criteria (id) on delete restrict,
  answer text not null check (answer in ('yes', 'no', 'no_data', 'not_applicable')),
  comment text,
  created_at timestamptz not null default now(),
  unique (inspection_id, criterion_id)
);

create index if not exists inspection_results_inspection_id_idx
  on public.inspection_results (inspection_id);

create index if not exists inspection_results_criterion_id_idx
  on public.inspection_results (criterion_id);

alter table public.inspection_results enable row level security;

-- ─── inspections: дата и агрегаты ───────────────────────────────────────────
alter table public.inspections
  add column if not exists inspected_at timestamptz;

alter table public.inspections
  add column if not exists minor_violations integer not null default 0;

alter table public.inspections
  add column if not exists medium_violations integer not null default 0;

alter table public.inspections
  add column if not exists critical_violations integer not null default 0;

alter table public.inspections
  add column if not exists non_scoring_findings integer not null default 0;

-- ─── inspection_photos: привязка к критерию (опционально) ──────────────────
alter table public.inspection_photos
  add column if not exists criterion_id uuid references public.inspection_criteria (id) on delete set null;

-- ─── RLS: справочники ────────────────────────────────────────────────────────
drop policy if exists inspection_categories_select on public.inspection_categories;
drop policy if exists inspection_categories_write on public.inspection_categories;
drop policy if exists inspection_criteria_select on public.inspection_criteria;
drop policy if exists inspection_criteria_write on public.inspection_criteria;

create policy inspection_categories_select
  on public.inspection_categories
  for select
  to authenticated
  using (true);

create policy inspection_categories_write
  on public.inspection_categories
  for all
  to authenticated
  using (public.user_is_admin())
  with check (public.user_is_admin());

create policy inspection_criteria_select
  on public.inspection_criteria
  for select
  to authenticated
  using (true);

create policy inspection_criteria_write
  on public.inspection_criteria
  for all
  to authenticated
  using (public.user_is_admin())
  with check (public.user_is_admin());

-- ─── RLS: результаты через доступ к филиалу проверки ───────────────────────
drop policy if exists inspection_results_select on public.inspection_results;
drop policy if exists inspection_results_insert on public.inspection_results;
drop policy if exists inspection_results_update on public.inspection_results;
drop policy if exists inspection_results_delete on public.inspection_results;

create policy inspection_results_select
  on public.inspection_results
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

create policy inspection_results_insert
  on public.inspection_results
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.inspections i
      where i.id = inspection_id
        and (public.user_is_admin() or public.user_can_access_branch(i.branch_id))
    )
  );

create policy inspection_results_update
  on public.inspection_results
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.inspections i
      where i.id = inspection_id
        and (
          public.user_is_admin()
          or (
            public.user_can_access_branch(i.branch_id)
            and (i.author_id is null or i.author_id = auth.uid())
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.inspections i
      where i.id = inspection_id
        and (public.user_is_admin() or public.user_can_access_branch(i.branch_id))
    )
  );

create policy inspection_results_delete
  on public.inspection_results
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.inspections i
      where i.id = inspection_id
        and (public.user_is_admin() or i.author_id = auth.uid())
    )
  );
