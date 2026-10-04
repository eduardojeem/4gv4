create or replace function public.get_global_products_admin(
  p_q text default '', p_status text default 'all', p_brand uuid default null,
  p_category uuid default null, p_sort text default 'name', p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with usage_rows as (
  select case when length(regexp_replace(product.barcode, '\D', '', 'g')) = 12
         then lpad(regexp_replace(product.barcode, '\D', '', 'g'), 13, '0')
         else regexp_replace(product.barcode, '\D', '', 'g') end as gtin,
         product.organization_id
  from public.products product
  where nullif(product.barcode, '') is not null
), usage as (
  select gtin, count(distinct organization_id)::integer as stores
  from usage_rows group by gtin
), filtered as (
  select catalog.*, coalesce(usage.stores, 0) as stores
  from public.global_products catalog
  left join usage on usage.gtin = catalog.gtin
  where (coalesce(trim(p_q), '') = '' or catalog.name ilike '%' || trim(p_q) || '%' or catalog.gtin like '%' || trim(p_q) || '%')
    and (p_status in ('all', 'no-category', 'no-brand', 'no-image') or (p_status = 'active' and catalog.is_active) or (p_status = 'inactive' and not catalog.is_active)
      or (p_status in ('candidate', 'review', 'published') and to_jsonb(catalog) ->> 'catalog_status' = p_status)
      or (p_status = 'used' and coalesce(usage.stores, 0) > 0) or (p_status = 'unused' and coalesce(usage.stores, 0) = 0))
    and (p_status <> 'no-category' or (catalog.is_active and catalog.global_category_id is null))
    and (p_status <> 'no-brand' or (catalog.is_active and catalog.global_brand_id is null))
    and (p_status <> 'no-image' or (catalog.is_active and catalog.image_url is null))
    and (p_brand is null or catalog.global_brand_id = p_brand)
    and (p_category is null or catalog.global_category_id = p_category)
), page_rows as (
  select * from filtered
  order by
    case when p_sort = 'usage_desc' then stores end desc nulls last,
    case when p_sort = 'newest' then created_at end desc nulls last,
    case when p_sort = 'name_desc' then name end desc nulls last,
    case when p_sort = 'name' then name end asc nulls last,
    id
  limit p_page_size offset ((greatest(p_page, 1) - 1) * p_page_size)
), candidate_groups as (
  select rows.gtin, min(product.name) as name, min(product.brand) as brand_name,
         count(*)::integer as uses, count(distinct product.organization_id)::integer as stores
  from usage_rows rows
  join public.products product on product.organization_id = rows.organization_id
    and (case when length(regexp_replace(product.barcode, '\D', '', 'g')) = 12
         then lpad(regexp_replace(product.barcode, '\D', '', 'g'), 13, '0')
         else regexp_replace(product.barcode, '\D', '', 'g') end) = rows.gtin
  where rows.gtin ~ '^[0-9]{8}$|^[0-9]{13}$'
    and rows.gtin !~ '^2[0-9]{12}$'
    and not exists (select 1 from public.global_products existing where existing.gtin = rows.gtin)
  group by rows.gtin
), candidate_page as (
  select * from candidate_groups order by stores desc, uses desc, name limit 300
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(to_jsonb(page_rows)) from page_rows), '[]'::jsonb),
  'page', greatest(p_page, 1), 'pageSize', p_page_size,
  'total', (select count(*) from filtered),
  'metrics', jsonb_build_object(
    'total', (select count(*) from public.global_products),
    'active', (select count(*) from public.global_products where is_active),
    'used', (select count(*) from usage where stores > 0),
    'uncategorized', (select count(*) from public.global_products where is_active and global_category_id is null),
    'unbranded', (select count(*) from public.global_products where is_active and global_brand_id is null),
    'withoutImage', (select count(*) from public.global_products where is_active and image_url is null),
    'inactive', (select count(*) from public.global_products where not is_active),
    'productsWithBarcode', (select count(*) from usage_rows)
  ),
  'candidates', coalesce((select jsonb_agg(to_jsonb(candidate_page)) from candidate_page), '[]'::jsonb),
  'candidatesTotal', (select count(*) from candidate_groups),
  'truncated', (select count(*) > 300 from candidate_groups)
);
$$;

create or replace function public.get_global_device_models_admin(
  p_q text default '', p_status text default 'all', p_brand uuid default null,
  p_sort text default 'name', p_page integer default 1, p_page_size integer default 50
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with usage_rows as (
  select product.organization_id,
         lower(extensions.unaccent(trim(product.device_brand))) as brand_key,
         lower(extensions.unaccent(trim(model))) as model_key
  from public.products product cross join lateral unnest(coalesce(product.device_models, '{}'::text[])) model
  where nullif(trim(product.device_brand), '') is not null
  union all
  select repair.organization_id,
         lower(extensions.unaccent(trim(repair.device_brand))),
         lower(extensions.unaccent(trim(repair.device_model)))
  from public.repairs repair
  where nullif(trim(repair.device_brand), '') is not null and nullif(trim(repair.device_model), '') is not null
), catalog_keys as (
  select model.id, lower(extensions.unaccent(trim(coalesce(brand.name, model.brand)))) as brand_key,
         lower(extensions.unaccent(trim(name_value))) as model_key
  from public.global_device_models model
  left join public.global_brands brand on brand.id = model.global_brand_id
  cross join lateral unnest(array_prepend(model.model, coalesce(model.aliases, '{}'::text[]))) name_value
), usage as (
  select key.id, count(distinct rows.organization_id)::integer as stores
  from catalog_keys key join usage_rows rows using (brand_key, model_key)
  group by key.id
), filtered as (
  select model.*, coalesce(brand.name, model.brand) as resolved_brand, coalesce(usage.stores, 0) as stores
  from public.global_device_models model
  left join public.global_brands brand on brand.id = model.global_brand_id
  left join usage on usage.id = model.id
  where (coalesce(trim(p_q), '') = '' or model.model ilike '%' || trim(p_q) || '%'
      or coalesce(brand.name, model.brand) ilike '%' || trim(p_q) || '%')
    and (p_status = 'all' or (p_status = 'active' and model.is_active) or (p_status = 'inactive' and not model.is_active)
      or (p_status in ('candidate', 'review', 'published') and to_jsonb(model) ->> 'catalog_status' = p_status)
      or (p_status = 'used' and coalesce(usage.stores, 0) > 0) or (p_status = 'unused' and coalesce(usage.stores, 0) = 0))
    and (p_brand is null or model.global_brand_id = p_brand)
), page_rows as (
  select * from filtered
  order by
    case when p_sort = 'usage_desc' then stores end desc nulls last,
    case when p_sort = 'newest' then created_at end desc nulls last,
    case when p_sort = 'name_desc' then resolved_brand || ' ' || model end desc nulls last,
    case when p_sort = 'name' then resolved_brand || ' ' || model end asc nulls last,
    id
  limit p_page_size offset ((greatest(p_page, 1) - 1) * p_page_size)
), candidate_groups as (
  select rows.brand_key as brand, rows.model_key as model, count(*)::integer as uses,
         count(distinct rows.organization_id)::integer as stores
  from usage_rows rows
  where not exists (select 1 from catalog_keys key where key.brand_key = rows.brand_key and key.model_key = rows.model_key)
  group by rows.brand_key, rows.model_key
), candidate_page as (
  select * from candidate_groups order by stores desc, uses desc, brand, model limit 300
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(to_jsonb(page_rows)) from page_rows), '[]'::jsonb),
  'page', greatest(p_page, 1), 'pageSize', p_page_size,
  'total', (select count(*) from filtered),
  'metrics', jsonb_build_object(
    'total', (select count(*) from public.global_device_models),
    'active', (select count(*) from public.global_device_models where is_active),
    'used', (select count(*) from usage where stores > 0),
    'storesUsing', (select count(distinct organization_id) from usage_rows)
  ),
  'candidates', coalesce((select jsonb_agg(to_jsonb(candidate_page)) from candidate_page), '[]'::jsonb),
  'candidatesTotal', (select count(*) from candidate_groups),
  'truncated', (select count(*) > 300 from candidate_groups)
);
$$;

revoke execute on function public.get_global_products_admin(text, text, uuid, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_global_products_admin(text, text, uuid, uuid, text, integer, integer) to service_role;
revoke execute on function public.get_global_device_models_admin(text, text, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_global_device_models_admin(text, text, uuid, text, integer, integer) to service_role;
