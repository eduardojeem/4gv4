create or replace function public.move_global_category_safely(
  p_category_id uuid,
  p_parent_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_level integer := -1;
  v_max_relative_depth integer := 0;
begin
  if p_actor_user_id is null or not exists (
    select 1 from auth.users where id = p_actor_user_id
  ) then
    raise exception using errcode = 'CAT04', message = 'A valid actor is required';
  end if;

  -- Serialize taxonomy moves. The catalog is intentionally small and this
  -- prevents two concurrent branch moves from validating stale ancestors.
  perform id
  from public.global_categories
  order by id
  for update;

  if not exists (select 1 from public.global_categories where id = p_category_id) then
    raise exception using errcode = 'CAT03', message = 'Category not found';
  end if;

  if p_parent_id is not null and not exists (
    select 1 from public.global_categories where id = p_parent_id
  ) then
    raise exception using errcode = 'CAT03', message = 'Parent category not found';
  end if;

  with recursive branch as (
    select c.id, c.parent_id, 0 as relative_depth, array[c.id] as path
    from public.global_categories c
    where c.id = p_category_id
    union all
    select child.id, child.parent_id, branch.relative_depth + 1, branch.path || child.id
    from public.global_categories child
    join branch on child.parent_id = branch.id
    where not child.id = any(branch.path)
  )
  select coalesce(max(relative_depth), 0)
  into v_max_relative_depth
  from branch;

  if p_parent_id = p_category_id or exists (
    with recursive branch as (
      select c.id, array[c.id] as path
      from public.global_categories c
      where c.id = p_category_id
      union all
      select child.id, branch.path || child.id
      from public.global_categories child
      join branch on child.parent_id = branch.id
      where not child.id = any(branch.path)
    )
    select 1 from branch where id = p_parent_id
  ) then
    raise exception using errcode = 'CAT01', message = 'Moving the category would create a cycle';
  end if;

  if p_parent_id is not null then
    select level into v_parent_level
    from public.global_categories
    where id = p_parent_id;
  end if;

  if v_parent_level + 1 + v_max_relative_depth > 2 then
    raise exception using errcode = 'CAT02', message = 'The category tree supports at most three levels';
  end if;

  update public.global_categories
  set parent_id = p_parent_id,
      updated_at = now()
  where id = p_category_id;

  with recursive branch as (
    select c.id, v_parent_level + 1 as new_level, array[c.id] as path
    from public.global_categories c
    where c.id = p_category_id
    union all
    select child.id, branch.new_level + 1, branch.path || child.id
    from public.global_categories child
    join branch on child.parent_id = branch.id
    where not child.id = any(branch.path)
  )
  update public.global_categories as category
  set level = branch.new_level,
      updated_at = now()
  from branch
  where category.id = branch.id;
end;
$$;

revoke execute on function public.move_global_category_safely(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.move_global_category_safely(uuid, uuid, uuid) to service_role;
