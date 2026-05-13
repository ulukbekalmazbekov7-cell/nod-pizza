-- Доступ к проверкам по заявке: SELECT/UPDATE и RPC по тем же правилам, что и complaints.

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

create or replace function public.user_can_access_complaint(p_complaint_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.complaints c
    where c.id = p_complaint_id
      and (
        public.user_is_admin()
        or public.user_can_access_branch(c.branch_id)
        or c.created_by = auth.uid()
      )
  );
$$;

revoke all on function public.user_can_access_complaint(uuid) from public;
grant execute on function public.user_can_access_complaint(uuid) to authenticated;

create or replace function public.create_linked_inspection_for_complaint(
  p_complaint_id uuid,
  p_comment text,
  p_actor_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_complaint public.complaints%rowtype;
  v_author uuid;
  v_inspection_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Требуется авторизация';
  end if;

  if not public.user_can_access_complaint(p_complaint_id) then
    raise exception 'Недостаточно прав для создания проверки по заявке';
  end if;

  select *
  into v_complaint
  from public.complaints
  where id = p_complaint_id;

  if not found then
    raise exception 'Заявка не найдена';
  end if;

  if v_complaint.inspection_id is not null then
    return v_complaint.inspection_id;
  end if;

  v_author := coalesce(p_actor_id, auth.uid());

  insert into public.inspections (
    branch_id,
    inspector,
    score,
    comment,
    status,
    complaint_id,
    author_id,
    inspected_at
  )
  values (
    v_complaint.branch_id,
    'Контроль качества',
    null,
    coalesce(nullif(trim(p_comment), ''), v_complaint.complaint_text),
    'draft',
    v_complaint.id,
    v_author,
    null
  )
  returning id into v_inspection_id;

  update public.complaints
  set
    inspection_id = v_inspection_id,
    status = 'assigned'
  where id = v_complaint.id;

  return v_inspection_id;
end;
$$;

revoke all on function public.create_linked_inspection_for_complaint(uuid, text, uuid) from public;
grant execute on function public.create_linked_inspection_for_complaint(uuid, text, uuid) to authenticated;

drop policy if exists inspections_role_select on public.inspections;

create policy inspections_role_select
  on public.inspections
  for select
  to authenticated
  using (
    public.user_is_admin()
    or public.user_can_access_branch(branch_id)
    or (
      complaint_id is not null
      and public.user_can_access_complaint(complaint_id)
    )
  );

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
      and public.user_can_access_complaint(complaint_id)
    )
  );

drop policy if exists inspections_role_update on public.inspections;

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
    or (
      complaint_id is not null
      and public.user_can_access_complaint(complaint_id)
    )
  )
  with check (
    public.user_is_admin()
    or public.user_can_access_branch(branch_id)
    or (
      complaint_id is not null
      and public.user_can_access_complaint(complaint_id)
    )
  );
