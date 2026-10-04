alter table public.global_device_models
  add column if not exists global_brand_id uuid
  references public.global_brands (id) on delete restrict;

with brand_names as (
  select brand.id,
         lower(extensions.unaccent(trim(name_value))) as normalized_name
  from public.global_brands brand
  cross join lateral unnest(array_prepend(brand.name, coalesce(brand.aliases, '{}'::text[]))) name_value
  where brand.is_active
), matches as (
  select model.id as model_id,
         min(brand_names.id) as brand_id,
         count(distinct brand_names.id) as match_count
  from public.global_device_models model
  join brand_names
    on brand_names.normalized_name = lower(extensions.unaccent(trim(model.brand)))
  where model.global_brand_id is null
  group by model.id
  having count(distinct brand_names.id) = 1
)
update public.global_device_models model
set global_brand_id = matches.brand_id,
    updated_at = now()
from matches
where model.id = matches.model_id
  and model.global_brand_id is null;

create index if not exists global_device_models_global_brand_idx
  on public.global_device_models (global_brand_id);

create unique index if not exists global_device_models_global_brand_model_key
  on public.global_device_models (global_brand_id, lower(model))
  where global_brand_id is not null;
