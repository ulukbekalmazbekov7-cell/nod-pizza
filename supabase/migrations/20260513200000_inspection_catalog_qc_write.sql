-- Аудиторы (qc) могут дополнять справочник критериев в подгруппах.

drop policy if exists inspection_criteria_write on public.inspection_criteria;
drop policy if exists inspection_subcategories_write on public.inspection_subcategories;

create policy inspection_criteria_write
  on public.inspection_criteria
  for all
  to authenticated
  using (
    public.user_is_admin()
    or public.current_user_role() = 'qc'
  )
  with check (
    public.user_is_admin()
    or public.current_user_role() = 'qc'
  );

create policy inspection_subcategories_write
  on public.inspection_subcategories
  for all
  to authenticated
  using (
    public.user_is_admin()
    or public.current_user_role() = 'qc'
  )
  with check (
    public.user_is_admin()
    or public.current_user_role() = 'qc'
  );
