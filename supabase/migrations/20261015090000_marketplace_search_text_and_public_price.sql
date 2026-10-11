-- Catálogo del marketplace: buscar sin importar tildes y ordenar por el precio
-- que se ve.
--
-- * «basica» no encontraba «Remera Básica»: el filtro era un ILIKE sobre cada
--   columna, que distingue tildes. `search_text` junta nombre, SKU, marca y
--   descripción en minúsculas y sin tildes; el código busca cada palabra ahí.
-- * «Menor precio» ordenaba por `sale_price`, y un producto de 150.000 en
--   oferta a 90.000 salía después de uno de 100.000. `public_price` es el
--   precio de oferta cuando la oferta es válida y el normal si no.
--   (Las promociones automáticas por tienda se calculan aparte y no entran.)
--
-- El código pregunta si las columnas existen: hasta aplicar esto, sigue
-- buscando y ordenando como antes.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- `unaccent` no es IMMUTABLE (depende del diccionario elegido por search_path);
-- fijando el diccionario se puede usar en una columna generada.
create or replace function public.immutable_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value)
$$;

alter table public.products
  add column if not exists search_text text generated always as (
    lower(public.immutable_unaccent(
      coalesce(name, '') || ' ' || coalesce(sku, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(description, '')
    ))
  ) stored;

alter table public.products
  add column if not exists public_price numeric generated always as (
    case
      when has_offer and offer_price > 0 and offer_price < sale_price then offer_price
      else sale_price
    end
  ) stored;

create index if not exists products_search_text_trgm_idx
  on public.products using gin (search_text extensions.gin_trgm_ops);

create index if not exists products_public_price_idx
  on public.products (public_price);
