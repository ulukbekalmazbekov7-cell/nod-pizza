-- Список проверяющих (admin / qc) для формы проверок.
-- Доступно всем authenticated; редактирование профилей не расширяется.

drop policy if exists profiles_select_inspectors on public.profiles;

create policy profiles_select_inspectors
  on public.profiles
  for select
  to authenticated
  using (role in ('admin', 'qc'));
