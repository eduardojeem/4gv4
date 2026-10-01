-- Rubros en las categorías globales.
--
-- La taxonomía del marketplace era solo de tecnología: las categorías de las
-- tiendas de ropa, cosmética, comida o ferretería no tenían a qué vincularse
-- y el kit de inicio solo vinculaba las de electrónica. Ahora cada categoría
-- global dice en qué rubros aplica (vacío = en todos) y se suman ramas para
-- los otros rubros, con los nombres del kit de inicio
-- (src/lib/organization/starter-kit.ts, STARTER_CATEGORIES) para que una
-- tienda nueva quede agrupada en el marketplace desde el primer producto.
--
-- Los rubros son los de BUSINESS_VERTICALS (src/lib/organization/business-profile.ts).
-- Es idempotente: las categorías nuevas no se duplican (slug único).

alter table public.global_categories
  add column if not exists verticals text[] not null default '{}';

alter table public.global_categories drop constraint if exists global_categories_verticals_check;
alter table public.global_categories add constraint global_categories_verticals_check check (
  verticals <@ array['general', 'clothing', 'cosmetics', 'electronics', 'food', 'hardware', 'other']::text[]
);

-- Las que ya existían son de tecnología. Herramientas sirve también a ferretería.
update public.global_categories
set verticals = '{electronics}', updated_at = now()
where verticals = '{}';

update public.global_categories
set verticals = '{electronics,hardware}', updated_at = now()
where slug = 'herramientas';

-- Ramas nuevas. Los alias son los nombres cortos del kit de inicio y los que
-- más usan las tiendas («Mujer», «Accesorios»...): el rubro evita confundir
-- «Accesorios» de ropa con «Accesorios» de celulares.
insert into public.global_categories (name, slug, description, parent_id, level, aliases, icon, sort_order, is_active, verticals)
values
  ('Ropa de mujer', 'ropa-de-mujer', null, null, 0, '{Mujer,Dama,Damas}', null, 10, true, '{clothing}'),
  ('Ropa de hombre', 'ropa-de-hombre', null, null, 0, '{Hombre,Caballero,Caballeros}', null, 20, true, '{clothing}'),
  ('Ropa de niños', 'ropa-de-ninos', null, null, 0, '{Niños,Niñas,Infantil,Kids}', null, 30, true, '{clothing}'),
  ('Calzados', 'calzados', null, null, 0, '{Calzado,Zapatos,Zapatillas}', null, 40, true, '{clothing}'),
  ('Accesorios de moda', 'accesorios-de-moda', null, null, 0, '{Accesorios,Bijouterie,Carteras}', null, 50, true, '{clothing}'),

  ('Maquillaje', 'maquillaje', null, null, 0, '{Makeup}', null, 10, true, '{cosmetics}'),
  ('Cuidado de la piel', 'cuidado-de-la-piel', null, null, 0, '{Skincare,Cuidado facial}', null, 20, true, '{cosmetics}'),
  ('Cuidado del cabello', 'cuidado-del-cabello', null, null, 0, '{Cabello,Pelo,Haircare}', null, 30, true, '{cosmetics}'),
  ('Perfumes', 'perfumes', null, null, 0, '{Perfumería,Fragancias}', null, 40, true, '{cosmetics}'),
  ('Accesorios de belleza', 'accesorios-de-belleza', null, null, 0, '{Accesorios}', null, 50, true, '{cosmetics}'),

  ('Comidas', 'comidas', null, null, 0, '{Platos,Menú}', null, 10, true, '{food}'),
  ('Bebidas', 'bebidas', null, null, 0, '{Refrescos,Jugos}', null, 20, true, '{food}'),
  ('Postres', 'postres', null, null, 0, '{Dulces}', null, 30, true, '{food}'),
  ('Combos', 'combos', null, null, 0, '{Promos}', null, 40, true, '{food}'),

  ('Electricidad', 'electricidad', null, null, 0, '{Material eléctrico}', null, 20, true, '{hardware}'),
  ('Plomería', 'plomeria', null, null, 0, '{Sanitarios,Grifería}', null, 30, true, '{hardware}'),
  ('Pinturas', 'pinturas', null, null, 0, '{Pintura}', null, 40, true, '{hardware}'),
  ('Construcción', 'construccion', null, null, 0, '{Materiales de construcción}', null, 50, true, '{hardware}')
on conflict (slug) do nothing;
