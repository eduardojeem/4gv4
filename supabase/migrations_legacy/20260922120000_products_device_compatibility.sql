-- ───────────────────────────────────────────────────────────────────────────
-- Para qué celular es un repuesto
--
-- Un repuesto tiene tres datos que el catálogo mezclaba en dos campos:
--   · la marca del celular al que pertenece  → device_brand   (Apple, Samsung)
--   · el modelo (o los modelos) del celular  → device_models  (iPhone 13, A15)
--   · la marca del repuesto                  → brand, el de siempre (AmpSentrix)
--
-- Hasta ahora `brand` decía a veces para qué teléfono era («pantalla a12» →
-- Samsung) y a veces quién fabricó la pieza («OLED Assembly For iPhone 13» →
-- «Aftermarket Plus: Soft 3.0»), y el modelo sólo vivía dentro del nombre. Así
-- no había forma de ordenar ni de buscar por modelo.
--
-- `device_models` es una lista porque una misma pantalla sirve para varios
-- modelos («For iPhone 12 / 12 Pro»).
--
-- La aplicación sigue funcionando antes de aplicar esta migración: detecta si
-- las columnas existen y, si no, guarda el producto sin estos datos.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.products
  add column if not exists device_brand text,
  add column if not exists device_models text[] not null default '{}'::text[],
  add column if not exists device_sort_key text;

comment on column public.products.device_brand is
  'Marca del celular al que pertenece el repuesto (Apple, Samsung). No es la marca del repuesto: esa es brand.';
comment on column public.products.device_models is
  'Modelos de celular compatibles (iPhone 13, A15). Lista: una pieza puede servir para varios.';
comment on column public.products.device_sort_key is
  'Clave para ordenar por celular. La completa el trigger products_device_sort_key; no se escribe a mano.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_device_brand_length'
  ) then
    alter table public.products
      add constraint products_device_brand_length
      check (device_brand is null or char_length(device_brand) <= 60);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_device_models_limit'
  ) then
    alter table public.products
      add constraint products_device_models_limit
      check (coalesce(array_length(device_models, 1), 0) <= 20);
  end if;
end $$;

-- Ordenar como texto pone «iPhone 11» antes que «iPhone 8». La clave rellena
-- cada número a seis dígitos (iphone 000008 < iphone 000011). Es el espejo de
-- `deviceSortKey` en src/lib/products/device-compatibility.ts: si cambiás una,
-- cambiá la otra.
create or replace function public.products_compute_device_sort_key()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  base text;
begin
  if coalesce(new.device_brand, '') = '' and coalesce(array_length(new.device_models, 1), 0) = 0 then
    new.device_sort_key := null;
    return new;
  end if;

  base := lower(btrim(coalesce(new.device_brand, '') || ' ' || coalesce(new.device_models[1], '')));

  select string_agg(
           case when t.parte[1] ~ '^[0-9]+$' then lpad(t.parte[1], 6, '0') else t.parte[1] end,
           '' order by t.orden
         )
    into new.device_sort_key
    from regexp_matches(base, '([0-9]+|[^0-9]+)', 'g') with ordinality as t(parte, orden);

  return new;
end;
$$;

drop trigger if exists products_device_sort_key on public.products;
create trigger products_device_sort_key
  before insert or update of device_brand, device_models on public.products
  for each row execute function public.products_compute_device_sort_key();

-- Buscar «todo lo que sirve para un iPhone 13» y ordenar por celular.
create index if not exists products_device_models_gin
  on public.products using gin (device_models);

create index if not exists products_org_device_brand_idx
  on public.products (organization_id, device_brand);

create index if not exists products_org_device_sort_idx
  on public.products (organization_id, device_sort_key);
