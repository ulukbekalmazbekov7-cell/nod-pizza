-- INSERT в complaints не должен зависеть от RLS на branches.

drop policy if exists complaints_insert on public.complaints;

create policy complaints_insert
  on public.complaints
  for insert
  to authenticated
  with check (
    branch_id is not null
    and (created_by is null or created_by = auth.uid())
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
