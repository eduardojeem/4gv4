-- Catálogo global de modelos de equipos.
--
-- Cada tienda sugería marca y modelo (iPhone 13, Galaxy A15...) solo con lo
-- que ella misma ya había cargado en productos y reparaciones: una tienda
-- nueva arrancaba sin sugerencias y cada una escribía el modelo a su manera.
-- La plataforma mantiene una lista común, que se administra desde
-- /superadmin/device-models y se suma a las sugerencias de cada tienda.
--
-- Igual que global_brands: cualquier usuario con sesión la lee; solo el
-- servidor (service role) la escribe.

create table if not exists public.global_device_models (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (length(trim(brand)) between 1 and 80),
  model text not null check (length(trim(model)) between 1 and 80),
  device_type text not null default 'smartphone'
    check (device_type in ('smartphone', 'tablet', 'laptop', 'watch', 'other')),
  aliases text[] not null default '{}',
  release_year integer check (release_year is null or release_year between 1990 and 2100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.global_device_models is
  'Modelos de equipos comunes a todas las tiendas (sugerencias de marca/modelo en productos y reparaciones).';

-- Un modelo por marca, sin importar mayúsculas.
create unique index if not exists global_device_models_brand_model_key
  on public.global_device_models (lower(brand), lower(model));

create index if not exists global_device_models_active_idx
  on public.global_device_models (is_active, brand);

alter table public.global_device_models enable row level security;

drop policy if exists global_device_models_read on public.global_device_models;
create policy global_device_models_read on public.global_device_models
  for select using (auth.role() = 'authenticated');

revoke all on public.global_device_models from anon;
grant select on public.global_device_models to authenticated;
grant all on public.global_device_models to service_role;
