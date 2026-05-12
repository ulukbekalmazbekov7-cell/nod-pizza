-- Связь заявок с проверками и роль operator.

alter table public.inspections
  add column if not exists complaint_id uuid references public.complaints (id) on delete set null;

alter table public.complaints
  add column if not exists inspection_id bigint references public.inspections (id) on delete set null;

create index if not exists inspections_complaint_id_idx on public.inspections (complaint_id);
create index if not exists complaints_inspection_id_idx on public.complaints (inspection_id);

create or replace function public.user_can_access_branch(bid bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_user_role()
    when 'admin' then true
    when 'operator' then true
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

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'qc', 'operator'));

drop policy if exists inspections_role_insert on public.inspections;

create policy inspections_role_insert
  on public.inspections
  for insert
  to authenticated
  with check (
    public.user_is_admin()
    or public.user_can_access_branch(branch_id)
    or (
      complaint_id is not null
      and exists (
        select 1
        from public.complaints c
        where c.id = complaint_id
          and (
            c.created_by = auth.uid()
            or public.user_is_admin()
            or public.user_can_access_branch(c.branch_id)
          )
      )
    )
  );

drop policy if exists complaints_select on public.complaints;

create policy complaints_select
  on public.complaints
  for select
  to authenticated
  using (
    public.user_is_admin()
    or public.user_can_access_branch(branch_id)
    or created_by = auth.uid()
  );
