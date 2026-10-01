-- Unifica la marca de los productos: texto (`products.brand`) y vínculo
-- (`products.brand_id`) de acuerdo.
--
-- Medido el 2026-09-30: 57 productos tenían la marca solo como texto (la
-- importación no mandaba el vínculo), así que no aparecían bajo su marca en
-- los filtros ni en el marketplace; y 6 tenían un texto viejo distinto de su
-- marca vinculada («FTX» con «FASTRAX»). Desde ahora la API los mantiene
-- sincronizados (src/lib/products/product-brand.ts); esto corrige lo que ya
-- estaba guardado, con la misma regla:
--   1. el vínculo manda: el texto pasa a ser el nombre de la marca;
--   2. solo texto: la marca de la tienda vinculada a la marca del catálogo que
--      corresponde al texto (por nombre o alias: «Iphone» -> Apple);
--   3. si no, la marca de la tienda con el mismo nombre;
--   4. si no existe, se crea (vinculada al catálogo cuando corresponde).
-- Es idempotente: correrlo de nuevo no cambia nada.

-- La marca del catálogo que corresponde a un texto, por nombre o alias.
create or replace function pg_temp.catalog_brand_for(text_value text)
returns uuid
language sql
stable
as $$
  select g.id
  from public.global_brands g
  where g.is_active
    and (lower(g.name) = lower(trim(text_value))
      or exists (select 1 from unnest(coalesce(g.aliases, '{}')) as alias where lower(alias) = lower(trim(text_value))))
  order by g.name
  limit 1
$$;

-- 2) y 3): vincular los que tienen solo texto a una marca que la tienda ya tiene.
create or replace function pg_temp.link_text_only_products()
returns void
language sql
as $$
  -- Por la marca del catálogo.
  update public.products p
  set brand_id = m.brand_id
  from (
    select distinct on (p2.id) p2.id as product_id, tb.id as brand_id
    from public.products p2
    join public.brands tb
      on tb.organization_id = p2.organization_id
     and tb.global_brand_id = pg_temp.catalog_brand_for(p2.brand)
    where p2.brand_id is null and nullif(trim(p2.brand), '') is not null
    order by p2.id, tb.created_at
  ) m
  where p.id = m.product_id;

  -- Por el mismo nombre.
  update public.products p
  set brand_id = m.brand_id
  from (
    select distinct on (p2.id) p2.id as product_id, tb.id as brand_id
    from public.products p2
    join public.brands tb
      on tb.organization_id = p2.organization_id
     and lower(trim(tb.name)) = lower(trim(p2.brand))
    where p2.brand_id is null and nullif(trim(p2.brand), '') is not null
    order by p2.id, tb.created_at
  ) m
  where p.id = m.product_id;
$$;

select pg_temp.link_text_only_products();

-- 4) Las marcas que la tienda no tenía: una por tienda y por marca (dos textos
--    que son la misma marca del catálogo, «Iphone» y «Apple», crean una sola).
insert into public.brands (organization_id, name, global_brand_id, logo_url, is_active, created_at, updated_at)
select distinct on (p.organization_id, coalesce(g.id::text, lower(trim(p.brand))))
  p.organization_id,
  left(coalesce(g.name, trim(p.brand)), 200),
  g.id,
  nullif(trim(coalesce(g.logo_url, '')), ''),
  true,
  now(),
  now()
from public.products p
left join public.global_brands g on g.id = pg_temp.catalog_brand_for(p.brand)
where p.brand_id is null
  and p.organization_id is not null
  and nullif(trim(p.brand), '') is not null
order by p.organization_id, coalesce(g.id::text, lower(trim(p.brand))), p.created_at;

select pg_temp.link_text_only_products();

-- 1) El vínculo manda: el texto es el nombre de la marca vinculada.
update public.products p
set brand = b.name
from public.brands b
where p.brand_id = b.id
  and p.brand is distinct from b.name;
