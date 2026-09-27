-- ============================================================
-- CATÁLOGO GLOBAL DE MARCAS
--
-- Cada empresa cargaba sus propias marcas con un `logo_url` de texto libre.
-- El marketplace agrupa las marcas por nombre y toma el primer logo que
-- encuentra: la imagen que cargaba una empresa pasaba a representar a esa
-- marca para todas. Hoy hay 22 nombres repetidos entre empresas (Samsung en 6,
-- Apple en 4) y los únicos 8 logos cargados son avatares generados.
--
-- El logo oficial pasa a ser un dato de la plataforma, no de cada empresa,
-- con el mismo patrón que `global_categories`.
-- ============================================================

create extension if not exists pg_trgm;

create table if not exists public.global_brands (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        unique not null,
  -- Nombres alternativos para encontrarla al escribir («samsung electronics»).
  aliases     text[]      not null default '{}',
  logo_url    text,
  website     text,
  description text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists idx_global_brands_name_lower
  on public.global_brands (lower(name));

create index if not exists idx_global_brands_name_trgm
  on public.global_brands using gin (name gin_trgm_ops);

-- La marca de la empresa apunta a la del catálogo. `set null` a propósito: si
-- se borra del catálogo, la marca de la empresa sigue existiendo con sus
-- productos, solo deja de estar verificada.
alter table public.brands
  add column if not exists global_brand_id uuid
    references public.global_brands(id) on delete set null;

create index if not exists idx_brands_global_brand_id
  on public.brands (global_brand_id);

comment on table public.global_brands is
  'Catálogo de marcas oficiales que administra el superadmin. El logo sale de acá, no de cada empresa.';
comment on column public.brands.global_brand_id is
  'Marca del catálogo global. Con este vínculo, el nombre y el logo los define la plataforma.';

alter table public.global_brands enable row level security;

-- Lectura para cualquier usuario autenticado: el selector de marcas del panel
-- lo necesita. La escritura queda solo para el service role (superadmin).
drop policy if exists "global_brands_read" on public.global_brands;
create policy "global_brands_read" on public.global_brands
  for select using (auth.role() = 'authenticated');

drop trigger if exists update_global_brands_updated_at on public.global_brands;
create trigger update_global_brands_updated_at before update on public.global_brands
  for each row execute function update_updated_at_column();
