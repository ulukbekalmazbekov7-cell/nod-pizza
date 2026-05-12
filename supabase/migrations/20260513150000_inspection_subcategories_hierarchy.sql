-- Иерархия: категория → подгруппа → критерий. Штрафные баллы (penalty_points).
-- Выполни после 20260513140000 и 20260513140100.

-- ─── inspection_subcategories ────────────────────────────────────────────────
create table if not exists public.inspection_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.inspection_categories (id) on delete cascade,
  name text not null,
  sort_order integer not null,
  description text,
  created_at timestamptz not null default now(),
  unique (category_id, name)
);

create index if not exists inspection_subcategories_category_sort_idx
  on public.inspection_subcategories (category_id, sort_order);

alter table public.inspection_subcategories enable row level security;

-- ─── inspection_criteria: подгруппа и penalty_points ─────────────────────────
alter table public.inspection_criteria
  add column if not exists subcategory_id uuid references public.inspection_subcategories (id) on delete cascade;

alter table public.inspection_criteria
  add column if not exists penalty_points integer not null default 0;

-- Временные подгруппы «Общее» для уже существующих строк без subcategory_id.
insert into public.inspection_subcategories (category_id, name, sort_order, description)
select c.id, 'Общее', 1, 'Автоматически создано при миграции иерархии'
from public.inspection_categories c
where not exists (
  select 1
  from public.inspection_subcategories s
  where s.category_id = c.id and s.name = 'Общее'
);

update public.inspection_criteria ic
set subcategory_id = s.id
from public.inspection_subcategories s
where ic.subcategory_id is null
  and ic.category_id = s.category_id
  and s.name = 'Общее';

update public.inspection_criteria
set penalty_points = case
  when not is_evaluated or severity in ('none', 'informational') then 0
  when severity = 'critical' then 10
  when severity = 'medium' then 5
  when severity = 'minor' then 3
  else 0
end
where penalty_points = 0;

alter table public.inspection_criteria
  alter column subcategory_id set not null;

alter table public.inspection_criteria
  drop constraint if exists inspection_criteria_category_id_title_key;

alter table public.inspection_criteria
  drop column if exists category_id;

alter table public.inspection_criteria
  drop column if exists score_impact;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inspection_criteria_subcategory_id_title_key'
  ) then
    alter table public.inspection_criteria
      add constraint inspection_criteria_subcategory_id_title_key unique (subcategory_id, title);
  end if;
end $$;

-- ─── inspections: сумма штрафов ──────────────────────────────────────────────
alter table public.inspections
  add column if not exists total_penalties integer not null default 0;

-- ─── RLS: подгруппы ──────────────────────────────────────────────────────────
drop policy if exists inspection_subcategories_select on public.inspection_subcategories;
drop policy if exists inspection_subcategories_write on public.inspection_subcategories;

create policy inspection_subcategories_select
  on public.inspection_subcategories
  for select
  to authenticated
  using (true);

create policy inspection_subcategories_write
  on public.inspection_subcategories
  for all
  to authenticated
  using (public.user_is_admin())
  with check (public.user_is_admin());
