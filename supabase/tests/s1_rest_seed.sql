-- S1: datos SINTÉTICOS para s1_rest_smoke.mjs (prueba por HTTP contra PostgREST).
-- Solo para una base local aislada o una rama de Supabase. Nunca en producción.
-- Idempotente: crea lo que falta y vuelve a poner precios y costos iniciales (ids fijos …0003…).
-- No borra: algunas tablas que llenan los triggers (eventos de empleo) son de solo inserción.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000003a1', 's1h-owner@test.local'),
  ('00000000-0000-4000-8000-0000000003a2', 's1h-tech@test.local'),
  ('00000000-0000-4000-8000-0000000003a3', 's1h-tech-read@test.local'),
  ('00000000-0000-4000-8000-0000000003a4', 's1h-manager@test.local'),
  ('00000000-0000-4000-8000-0000000003a5', 's1h-manager-cost@test.local'),
  ('00000000-0000-4000-8000-0000000003b1', 's1h-admin-b@test.local')
on conflict (id) do nothing;

insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-00000000030a', 'S1H Comercio A', 's1h-comercio-a'),
  ('00000000-0000-4000-8000-00000000030b', 'S1H Comercio B', 's1h-comercio-b')
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role, status) values
  ('00000000-0000-4000-8000-00000000030a', '00000000-0000-4000-8000-0000000003a1', 'owner', 'active'),
  ('00000000-0000-4000-8000-00000000030a', '00000000-0000-4000-8000-0000000003a2', 'technician', 'active'),
  ('00000000-0000-4000-8000-00000000030a', '00000000-0000-4000-8000-0000000003a3', 'technician', 'active'),
  ('00000000-0000-4000-8000-00000000030a', '00000000-0000-4000-8000-0000000003a4', 'manager', 'active'),
  ('00000000-0000-4000-8000-00000000030a', '00000000-0000-4000-8000-0000000003a5', 'manager', 'active'),
  ('00000000-0000-4000-8000-00000000030b', '00000000-0000-4000-8000-0000000003b1', 'admin', 'active')
on conflict do nothing;

delete from public.user_permissions where user_id in (
  '00000000-0000-4000-8000-0000000003a3', '00000000-0000-4000-8000-0000000003a5');
insert into public.user_permissions (user_id, organization_id, permission, is_active) values
  ('00000000-0000-4000-8000-0000000003a3', '00000000-0000-4000-8000-00000000030a', 'products.read_cost', true),
  ('00000000-0000-4000-8000-0000000003a5', '00000000-0000-4000-8000-00000000030a', 'products.update_cost', true),
  ('00000000-0000-4000-8000-0000000003a5', '00000000-0000-4000-8000-00000000030a', 'products.read_cost', true);

insert into public.products (id, organization_id, sku, name, sale_price, purchase_price, stock_quantity, min_stock) values
  ('00000000-0000-4000-8000-0000000003f1', '00000000-0000-4000-8000-00000000030a', 'S1H-A-1', 'HTTP A1', 200, 100, 5, 1),
  ('00000000-0000-4000-8000-0000000003f2', '00000000-0000-4000-8000-00000000030a', 'S1H-A-2', 'HTTP A2', 50, 20, 10, 1),
  ('00000000-0000-4000-8000-0000000003f9', '00000000-0000-4000-8000-00000000030b', 'S1H-B-1', 'HTTP B1', 300, 150, 2, 1)
on conflict (id) do update set sale_price = excluded.sale_price, purchase_price = excluded.purchase_price, stock_quantity = excluded.stock_quantity;
insert into public.product_variants (id, organization_id, product_id, variant_name, purchase_price, sale_price) values
  ('00000000-0000-4000-8000-0000000003e1', '00000000-0000-4000-8000-00000000030a', '00000000-0000-4000-8000-0000000003f1', 'Variante HTTP', 60, 210)
on conflict (id) do update set purchase_price = excluded.purchase_price, sale_price = excluded.sale_price;
commit;
