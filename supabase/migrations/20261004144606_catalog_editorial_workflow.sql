-- Flujo editorial compartido por los catálogos que alimentan directamente a
-- las tiendas. Los registros importados nacen como candidatos; solamente los
-- publicados pueden ser consumidos por barcode lookup y device options.

alter table public.global_products
  add column if not exists catalog_status text,
  add column if not exists source_type text,
  add column if not exists source_summary jsonb,
  add column if not exists confidence numeric,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists deactivation_reason text;

alter table public.global_device_models
  add column if not exists catalog_status text,
  add column if not exists source_type text,
  add column if not exists source_summary jsonb,
  add column if not exists confidence numeric,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists deactivation_reason text;

update public.global_products
set catalog_status = case when is_active then 'published' else 'inactive' end,
    source_type = coalesce(source_type, 'legacy')
where catalog_status is null;

update public.global_device_models
set catalog_status = case when is_active then 'published' else 'inactive' end,
    source_type = coalesce(source_type, 'legacy')
where catalog_status is null;

alter table public.global_products
  alter column catalog_status set default 'candidate',
  alter column catalog_status set not null,
  add constraint global_products_catalog_status_check
    check (catalog_status in ('candidate', 'review', 'published', 'inactive')),
  add constraint global_products_confidence_check
    check (confidence is null or confidence between 0 and 1);

alter table public.global_device_models
  alter column catalog_status set default 'candidate',
  alter column catalog_status set not null,
  add constraint global_device_models_catalog_status_check
    check (catalog_status in ('candidate', 'review', 'published', 'inactive')),
  add constraint global_device_models_confidence_check
    check (confidence is null or confidence between 0 and 1);

create or replace function public.sync_catalog_editorial_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.is_active := new.catalog_status = 'published';
    if new.source_type is null then
      new.source_type := case when new.catalog_status = 'candidate' then 'tenant_usage' else 'manual' end;
    end if;
  elsif new.catalog_status is distinct from old.catalog_status then
    new.is_active := new.catalog_status = 'published';
  elsif new.is_active is distinct from old.is_active then
    -- Compatibilidad temporal para escritores antiguos durante el despliegue.
    new.catalog_status := case when new.is_active then 'published' else 'inactive' end;
  end if;
  return new;
end;
$$;

drop trigger if exists global_products_sync_catalog_editorial_state on public.global_products;
create trigger global_products_sync_catalog_editorial_state
before insert or update of catalog_status, is_active on public.global_products
for each row execute function public.sync_catalog_editorial_state();

drop trigger if exists global_device_models_sync_catalog_editorial_state on public.global_device_models;
create trigger global_device_models_sync_catalog_editorial_state
before insert or update of catalog_status, is_active on public.global_device_models
for each row execute function public.sync_catalog_editorial_state();

create index if not exists global_products_catalog_status_idx
  on public.global_products (catalog_status, updated_at desc);
create index if not exists global_device_models_catalog_status_idx
  on public.global_device_models (catalog_status, updated_at desc);
