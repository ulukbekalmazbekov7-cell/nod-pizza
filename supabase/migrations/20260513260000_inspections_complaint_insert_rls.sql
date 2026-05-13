-- Разрешить INSERT в inspections при создании проверки по заявке (operator / QC / admin).

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

create or replace function public.user_can_insert_complaint_inspection(
  p_complaint_id uuid,
  p_branch_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(p_branch_id, 0) > 0
    and (
      public.user_is_admin()
      or public.user_can_access_branch(p_branch_id)
      or (
        p_complaint_id is not null
        and exists (
          select 1
          from public.complaints c
          where c.id = p_complaint_id
            and c.branch_id = p_branch_id
            and (
              c.created_by = auth.uid()
              or public.user_is_admin()
              or public.user_can_access_branch(c.branch_id)
            )
        )
      )
    );
$$;

revoke all on function public.user_can_insert_complaint_inspection(uuid, bigint) from public;
grant execute on function public.user_can_insert_complaint_inspection(uuid, bigint) to authenticated;

drop policy if exists inspections_role_insert on public.inspections;

create policy inspections_role_insert
  on public.inspections
  for insert
  to authenticated
  with check (
    public.user_can_insert_complaint_inspection(complaint_id, branch_id)
  );
