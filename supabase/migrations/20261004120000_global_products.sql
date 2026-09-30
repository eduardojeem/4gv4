-- Catálogo global de productos por código de barras.
--
-- El código del fabricante (EAN-13, EAN-8, UPC-A) identifica igual un producto
-- en cualquier rubro. Cada tienda cargaba nombre, marca, categoría y foto del
-- mismo producto por su cuenta, con nombres distintos y una foto por tienda.
-- Acá vive una sola ficha por código: al escanear, el formulario de producto
-- la usa para completar lo que falta y reutiliza la foto.
--
-- `gtin` guarda el código normalizado: un UPC-A de 12 dígitos se guarda con un
-- 0 adelante (su EAN-13). Los códigos internos 2xx de cada comercio no entran.
--
-- Igual que global_brands: la lee cualquier usuario con sesión y solo el
-- servidor (service role) la escribe.

create table if not exists public.global_products (
  id uuid primary key default gen_random_uuid(),
  gtin text not null unique check (gtin ~ '^[0-9]{8}$|^[0-9]{13}$' and gtin !~ '^2[0-9]{12}$'),
  name text not null check (length(trim(name)) between 2 and 200),
  brand_name text check (brand_name is null or length(brand_name) <= 120),
  global_brand_id uuid references public.global_brands(id) on delete set null,
  global_category_id uuid references public.global_categories(id) on delete set null,
  description text check (description is null or length(description) <= 2000),
  image_url text check (image_url is null or length(image_url) <= 600),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.global_products is
  'Fichas de producto comunes a todas las tiendas, por código de barras del fabricante.';

create index if not exists global_products_brand_idx on public.global_products (global_brand_id);
create index if not exists global_products_category_idx on public.global_products (global_category_id);

alter table public.global_products enable row level security;

drop policy if exists global_products_read on public.global_products;
create policy global_products_read on public.global_products
  for select using (auth.role() = 'authenticated');

revoke all on public.global_products from anon;
grant select on public.global_products to authenticated;
grant all on public.global_products to service_role;
