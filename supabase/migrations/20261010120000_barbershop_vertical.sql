-- Rubro «Barbería y peluquería» (barbershop).
--
-- Las barberías y peluquerías venden turnos más que productos: al elegir este
-- rubro el sistema les sugiere la agenda, la plantilla de tienda «Servicios» y
-- servicios típicos. Acá se amplía la lista de rubros válidos (organizaciones
-- y categorías globales) y se suman las categorías globales del kit de inicio
-- del rubro (src/lib/organization/starter-kit.ts, STARTER_CATEGORIES.barbershop)
-- para que una barbería nueva quede agrupada en el marketplace.
--
-- Es idempotente: se puede correr más de una vez.

begin;

alter table public.organizations
  drop constraint if exists organizations_business_vertical_check;

alter table public.organizations
  add constraint organizations_business_vertical_check
  check (business_vertical = any (array[
    'general', 'clothing', 'cosmetics', 'electronics', 'food', 'hardware', 'barbershop', 'other'
  ]::text[]));

alter table public.global_categories drop constraint if exists global_categories_verticals_check;
alter table public.global_categories add constraint global_categories_verticals_check check (
  verticals <@ array['general', 'clothing', 'cosmetics', 'electronics', 'food', 'hardware', 'barbershop', 'other']::text[]
);

insert into public.global_categories (name, slug, description, parent_id, level, aliases, icon, sort_order, is_active, verticals)
values
  ('Cortes de cabello', 'cortes-de-cabello', null, null, 0, '{Cortes,Corte,Peluquería}', null, 10, true, '{barbershop}'),
  ('Barba', 'barba', null, null, 0, '{Barbería,Afeitado}', null, 20, true, '{barbershop}'),
  ('Coloración', 'coloracion', null, null, 0, '{Color,Tintura,Mechas}', null, 30, true, '{barbershop}'),
  ('Tratamientos capilares', 'tratamientos-capilares', null, null, 0, '{Tratamientos,Alisado,Keratina}', null, 40, true, '{barbershop}')
on conflict (slug) do nothing;

-- Los productos que vende una barbería (ceras, shampoo) son cuidado del cabello.
update public.global_categories
set aliases = array(select distinct unnest(aliases || '{Productos}'::text[])),
    verticals = array(select distinct unnest(verticals || '{barbershop}'::text[])),
    updated_at = now()
where slug = 'cuidado-del-cabello'
  and not ('barbershop' = any (verticals));

commit;
