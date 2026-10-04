create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

create or replace function public.apply_global_category_links(p_links jsonb, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested integer := coalesce(jsonb_array_length(p_links), 0);
  v_linked integer := 0;
  v_skipped integer := 0;
  v_failed jsonb := '[]'::jsonb;
begin
  if p_actor_user_id is null or not exists (select 1 from auth.users where id = p_actor_user_id) then
    raise exception using errcode = 'CAL01', message = 'A valid actor is required';
  end if;
  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = 'CAL02', message = 'Links must be an array';
  end if;

  with parsed as (
    select tenant_id, target_id, expected_name, alias
    from jsonb_to_recordset(p_links) as x(tenant_id uuid, target_id uuid, expected_name text, alias text)
  ), duplicates as (
    select tenant_id from parsed group by tenant_id having count(*) > 1
  ), failures as (
    select p.tenant_id::text as id,
      case
        when p.tenant_id is null or p.target_id is null or nullif(trim(p.expected_name), '') is null then 'invalid_payload'
        when d.tenant_id is not null then 'duplicate_tenant_id'
        when tenant.id is null then 'tenant_category_not_found'
        when target.id is null or not target.is_active then 'inactive_or_missing_target'
        when lower(extensions.unaccent(trim(tenant.name))) <> lower(extensions.unaccent(trim(p.expected_name))) then 'name_changed_since_review'
        when tenant.global_category_id is not null and tenant.global_category_id <> p.target_id then 'already_linked_elsewhere'
      end as reason
    from parsed p
    left join duplicates d on d.tenant_id = p.tenant_id
    left join public.categories tenant on tenant.id = p.tenant_id
    left join public.global_categories target on target.id = p.target_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', coalesce(id, ''), 'reason', reason)) filter (where reason is not null), '[]'::jsonb)
  into v_failed
  from failures;

  if jsonb_array_length(v_failed) > 0 then
    return jsonb_build_object('requested', v_requested, 'created', 0, 'updated', 0, 'linked', 0, 'skipped', 0, 'failed', v_failed);
  end if;

  with parsed as (
    select tenant_id, target_id, alias
    from jsonb_to_recordset(p_links) as x(tenant_id uuid, target_id uuid, expected_name text, alias text)
  )
  select count(*) into v_skipped
  from parsed p join public.categories tenant on tenant.id = p.tenant_id
  where tenant.global_category_id = p.target_id;

  with parsed as (
    select tenant_id, target_id
    from jsonb_to_recordset(p_links) as x(tenant_id uuid, target_id uuid, expected_name text, alias text)
  )
  update public.categories tenant
  set global_category_id = p.target_id
  from parsed p
  where tenant.id = p.tenant_id and tenant.global_category_id is null;
  get diagnostics v_linked = row_count;

  with parsed as (
    select target_id, nullif(trim(alias), '') as alias
    from jsonb_to_recordset(p_links) as x(tenant_id uuid, target_id uuid, expected_name text, alias text)
  ), additions as (
    select target_id, min(alias) as alias from parsed where alias is not null group by target_id
  )
  update public.global_categories target
  set aliases = case
        when exists (
          select 1 from unnest(coalesce(target.aliases, '{}'::text[])) current_alias
          where lower(extensions.unaccent(current_alias)) = lower(extensions.unaccent(a.alias))
        ) then target.aliases
        else array_append(coalesce(target.aliases, '{}'::text[]), a.alias)
      end,
      updated_at = now()
  from additions a
  where target.id = a.target_id
    and lower(extensions.unaccent(a.alias)) <> lower(extensions.unaccent(target.name));

  return jsonb_build_object('requested', v_requested, 'created', 0, 'updated', 0, 'linked', v_linked, 'skipped', v_skipped, 'failed', '[]'::jsonb);
end;
$$;

create or replace function public.apply_global_brand_links(p_links jsonb, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested integer := coalesce(jsonb_array_length(p_links), 0);
  v_linked integer := 0;
  v_skipped integer := 0;
  v_failed jsonb := '[]'::jsonb;
begin
  if p_actor_user_id is null or not exists (select 1 from auth.users where id = p_actor_user_id) then
    raise exception using errcode = 'CAL01', message = 'A valid actor is required';
  end if;
  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = 'CAL02', message = 'Links must be an array';
  end if;

  with parsed as (
    select tenant_id, target_id, expected_name, alias
    from jsonb_to_recordset(p_links) as x(tenant_id uuid, target_id uuid, expected_name text, alias text)
  ), duplicates as (
    select tenant_id from parsed group by tenant_id having count(*) > 1
  ), failures as (
    select p.tenant_id::text as id,
      case
        when p.tenant_id is null or p.target_id is null or nullif(trim(p.expected_name), '') is null then 'invalid_payload'
        when d.tenant_id is not null then 'duplicate_tenant_id'
        when tenant.id is null then 'tenant_brand_not_found'
        when target.id is null or not target.is_active then 'inactive_or_missing_target'
        when lower(extensions.unaccent(trim(tenant.name))) <> lower(extensions.unaccent(trim(p.expected_name))) then 'name_changed_since_review'
        when tenant.global_brand_id is not null and tenant.global_brand_id <> p.target_id then 'already_linked_elsewhere'
      end as reason
    from parsed p
    left join duplicates d on d.tenant_id = p.tenant_id
    left join public.brands tenant on tenant.id = p.tenant_id
    left join public.global_brands target on target.id = p.target_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', coalesce(id, ''), 'reason', reason)) filter (where reason is not null), '[]'::jsonb)
  into v_failed
  from failures;

  if jsonb_array_length(v_failed) > 0 then
    return jsonb_build_object('requested', v_requested, 'created', 0, 'updated', 0, 'linked', 0, 'skipped', 0, 'failed', v_failed);
  end if;

  with parsed as (
    select tenant_id, target_id
    from jsonb_to_recordset(p_links) as x(tenant_id uuid, target_id uuid, expected_name text, alias text)
  )
  select count(*) into v_skipped
  from parsed p join public.brands tenant on tenant.id = p.tenant_id
  where tenant.global_brand_id = p.target_id;

  with parsed as (
    select tenant_id, target_id
    from jsonb_to_recordset(p_links) as x(tenant_id uuid, target_id uuid, expected_name text, alias text)
  )
  update public.brands tenant
  set global_brand_id = target.id, name = target.name, logo_url = target.logo_url, updated_at = now()
  from parsed p join public.global_brands target on target.id = p.target_id
  where tenant.id = p.tenant_id and tenant.global_brand_id is null;
  get diagnostics v_linked = row_count;

  with parsed as (
    select target_id, nullif(trim(alias), '') as alias
    from jsonb_to_recordset(p_links) as x(tenant_id uuid, target_id uuid, expected_name text, alias text)
  ), additions as (
    select target_id, min(alias) as alias from parsed where alias is not null group by target_id
  )
  update public.global_brands target
  set aliases = case
        when exists (
          select 1 from unnest(coalesce(target.aliases, '{}'::text[])) current_alias
          where lower(extensions.unaccent(current_alias)) = lower(extensions.unaccent(a.alias))
        ) then target.aliases
        else array_append(coalesce(target.aliases, '{}'::text[]), a.alias)
      end,
      updated_at = now()
  from additions a
  where target.id = a.target_id
    and lower(extensions.unaccent(a.alias)) <> lower(extensions.unaccent(target.name));

  return jsonb_build_object('requested', v_requested, 'created', 0, 'updated', 0, 'linked', v_linked, 'skipped', v_skipped, 'failed', '[]'::jsonb);
end;
$$;

revoke execute on function public.apply_global_category_links(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.apply_global_category_links(jsonb, uuid) to service_role;
revoke execute on function public.apply_global_brand_links(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.apply_global_brand_links(jsonb, uuid) to service_role;
