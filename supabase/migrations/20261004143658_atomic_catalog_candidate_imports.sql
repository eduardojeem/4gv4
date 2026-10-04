create or replace function public.import_global_product_candidates(p_entries jsonb, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested integer := coalesce(jsonb_array_length(p_entries), 0);
  v_created integer := 0;
  v_failed jsonb := '[]'::jsonb;
begin
  if p_actor_user_id is null or not exists (select 1 from auth.users where id = p_actor_user_id) then
    raise exception using errcode = 'CAI01', message = 'A valid actor is required';
  end if;

  with parsed as (
    select case when length(regexp_replace(gtin, '\D', '', 'g')) = 12
           then lpad(regexp_replace(gtin, '\D', '', 'g'), 13, '0')
           else regexp_replace(gtin, '\D', '', 'g') end as gtin,
           name, brand_name, global_brand_id, global_category_id, description, image_url
    from jsonb_to_recordset(p_entries) as x(
      gtin text, name text, brand_name text, global_brand_id uuid,
      global_category_id uuid, description text, image_url text
    )
  ), failures as (
    select p.gtin as id,
      case
        when p.gtin !~ '^[0-9]{8}$|^[0-9]{13}$' or p.gtin ~ '^2[0-9]{12}$' then 'invalid_gtin'
        when nullif(trim(p.name), '') is null then 'invalid_name'
        when p.global_brand_id is not null and (brand.id is null or not brand.is_active) then 'inactive_or_missing_brand'
        when p.global_category_id is not null and (category.id is null or not category.is_active) then 'inactive_or_missing_category'
      end as reason
    from parsed p
    left join public.global_brands brand on brand.id = p.global_brand_id
    left join public.global_categories category on category.id = p.global_category_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', coalesce(id, ''), 'reason', reason)) filter (where reason is not null), '[]'::jsonb)
  into v_failed from failures;

  if jsonb_array_length(v_failed) > 0 then
    return jsonb_build_object('requested', v_requested, 'created', 0, 'updated', 0, 'linked', 0, 'skipped', 0, 'failed', v_failed);
  end if;

  with parsed as (
    select case when length(regexp_replace(gtin, '\D', '', 'g')) = 12
           then lpad(regexp_replace(gtin, '\D', '', 'g'), 13, '0')
           else regexp_replace(gtin, '\D', '', 'g') end as gtin,
           trim(name) as name, nullif(trim(brand_name), '') as brand_name,
           global_brand_id, global_category_id, nullif(trim(description), '') as description,
           nullif(trim(image_url), '') as image_url
    from jsonb_to_recordset(p_entries) as x(
      gtin text, name text, brand_name text, global_brand_id uuid,
      global_category_id uuid, description text, image_url text
    )
  )
  insert into public.global_products (
    gtin, name, brand_name, global_brand_id, global_category_id, description, image_url
  )
  select distinct on (gtin) gtin, name, brand_name, global_brand_id, global_category_id, description, image_url
  from parsed order by gtin
  on conflict (gtin) do nothing;
  get diagnostics v_created = row_count;

  return jsonb_build_object('requested', v_requested, 'created', v_created, 'updated', 0, 'linked', 0, 'skipped', v_requested - v_created, 'failed', '[]'::jsonb);
end;
$$;

create or replace function public.import_global_device_model_candidates(p_entries jsonb, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested integer := coalesce(jsonb_array_length(p_entries), 0);
  v_created integer := 0;
  v_failed jsonb := '[]'::jsonb;
begin
  if p_actor_user_id is null or not exists (select 1 from auth.users where id = p_actor_user_id) then
    raise exception using errcode = 'CAI01', message = 'A valid actor is required';
  end if;

  with parsed as (
    select global_brand_id, model, device_type
    from jsonb_to_recordset(p_entries) as x(global_brand_id uuid, model text, device_type text)
  ), failures as (
    select coalesce(p.global_brand_id::text, '') || ':' || coalesce(p.model, '') as id,
      case
        when brand.id is null or not brand.is_active then 'inactive_or_missing_brand'
        when nullif(trim(p.model), '') is null then 'invalid_model'
        when coalesce(p.device_type, 'smartphone') not in ('smartphone', 'tablet', 'laptop', 'watch', 'other') then 'invalid_device_type'
      end as reason
    from parsed p
    left join public.global_brands brand on brand.id = p.global_brand_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'reason', reason)) filter (where reason is not null), '[]'::jsonb)
  into v_failed from failures;

  if jsonb_array_length(v_failed) > 0 then
    return jsonb_build_object('requested', v_requested, 'created', 0, 'updated', 0, 'linked', 0, 'skipped', 0, 'failed', v_failed);
  end if;

  with parsed as (
    select global_brand_id, trim(model) as model, coalesce(device_type, 'smartphone') as device_type
    from jsonb_to_recordset(p_entries) as x(global_brand_id uuid, model text, device_type text)
  )
  insert into public.global_device_models (global_brand_id, brand, model, device_type, aliases)
  select distinct on (p.global_brand_id, lower(p.model)) p.global_brand_id, brand.name, p.model, p.device_type, '{}'::text[]
  from parsed p join public.global_brands brand on brand.id = p.global_brand_id
  order by p.global_brand_id, lower(p.model)
  on conflict do nothing;
  get diagnostics v_created = row_count;

  return jsonb_build_object('requested', v_requested, 'created', v_created, 'updated', 0, 'linked', 0, 'skipped', v_requested - v_created, 'failed', '[]'::jsonb);
end;
$$;

revoke execute on function public.import_global_product_candidates(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.import_global_product_candidates(jsonb, uuid) to service_role;
revoke execute on function public.import_global_device_model_candidates(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.import_global_device_model_candidates(jsonb, uuid) to service_role;
