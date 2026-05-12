-- Автор жалобы может обновлять запись (в т.ч. поля Jira после синхронизации).

drop policy if exists complaints_update on public.complaints;

create policy complaints_update
  on public.complaints
  for update
  to authenticated
  using (
    public.user_is_admin()
    or public.user_can_access_branch(branch_id)
    or created_by = auth.uid()
  )
  with check (
    public.user_is_admin()
    or public.user_can_access_branch(branch_id)
    or created_by = auth.uid()
  );
