-- S1, Etapa 1: protección de escritura de costos (supabase/pending-migrations/s1-product-cost/01_guard_product_cost_writes.sql).
-- Correr SOLO contra una base local o una rama de Supabase DESPUÉS de aplicar ese SQL.
-- Nunca contra el proyecto de producción. Todo queda dentro de una transacción con rollback.
-- Vale con 01, 01+02 y 01+02+03: los upserts directos que tocan el costo se prueban
-- en product_cost_read_guard.test.sql, porque con 03 fallan antes (exigen SELECT).
begin;
select plan(31);

-- ─── Datos de prueba (como postgres: sin RLS) ───────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 's1-owner@test.local'),
  ('00000000-0000-4000-8000-0000000000a2', 's1-manager@test.local'),
  ('00000000-0000-4000-8000-0000000000a3', 's1-manager-cost@test.local'),
  ('00000000-0000-4000-8000-0000000000a4', 's1-legacy@test.local'),
  ('00000000-0000-4000-8000-0000000000b1', 's1-admin-b@test.local');

insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-00000000000a', 'S1 Comercio A', 's1-comercio-a'),
  ('00000000-0000-4000-8000-00000000000b', 'S1 Comercio B', 's1-comercio-b');

insert into public.organization_members (organization_id, user_id, role, status) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'owner', 'active'),
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a2', 'manager', 'active'),
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a3', 'manager', 'active'),
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a4', 'manager', 'active'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000b1', 'admin', 'active'),
  -- El gerente de A también es gerente en B (dos organizaciones).
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000a2', 'manager', 'active');

insert into public.user_permissions (user_id, organization_id, permission, is_active) values
  -- Permiso de costos para el comercio A.
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-00000000000a', 'products.update_cost', true),
  -- Permiso legado sin comercio: no tiene que autorizar nada.
  ('00000000-0000-4000-8000-0000000000a4', null, 'products.update_cost', true);

insert into public.exchange_rates (organization_id, currency, rate, rounding) values
  ('00000000-0000-4000-8000-00000000000a', 'USD', 7000, 1);

insert into public.products (id, organization_id, sku, name, sale_price, purchase_price) values
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-00000000000a', 'S1-A-1', 'Producto A', 200, 100),
  ('00000000-0000-4000-8000-0000000000f9', '00000000-0000-4000-8000-00000000000b', 'S1-B-1', 'Producto B', 300, 150);
insert into public.products (id, organization_id, sku, name, sale_price, price_currency, foreign_sale_price, foreign_purchase_price) values
  ('00000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-00000000000a', 'S1-A-USD', 'Producto en dólares', 0, 'USD', 10, 6);
insert into public.product_variants (id, organization_id, product_id, variant_name, purchase_price, sale_price) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000f1', 'Variante A', 50, 90);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on function pg_temp.act_as(uuid) to authenticated;
-- Lee el costo guardado sin depender de los privilegios de columna (03).
create function pg_temp.cost_of(p_id uuid) returns numeric language sql security definer as $$
  select coalesce((select purchase_price from public.products where id = p_id), (select purchase_price from public.product_variants where id = p_id));
$$;
create function pg_temp.foreign_cost_of(p_id uuid) returns numeric language sql security definer as $$
  select foreign_purchase_price from public.products where id = p_id;
$$;
grant execute on function pg_temp.cost_of(uuid), pg_temp.foreign_cost_of(uuid) to authenticated;

select is(pg_temp.cost_of('00000000-0000-4000-8000-0000000000f5'), 42000::numeric, 'moneda extranjera: el costo local sale del tipo de cambio (6 × 7000)');

-- ─── Gerente sin permiso de costos ───────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a2');
select lives_ok($$ update public.products set sale_price = 210 where id = '00000000-0000-4000-8000-0000000000f1' $$,
  'un gerente edita el precio sin tocar el costo');
select lives_ok($$ update public.products set purchase_price = 1 where id = '00000000-0000-4000-8000-0000000000f1' $$,
  'un cambio de costo sin permiso no da error (no revela el valor guardado)…');
select is(pg_temp.cost_of('00000000-0000-4000-8000-0000000000f1'), 100::numeric, '…y el costo queda como estaba');
select lives_ok($$ update public.products set purchase_price = 100 where id = '00000000-0000-4000-8000-0000000000f1' $$,
  'mandar el valor exacto se comporta igual: no hay forma de adivinar el costo');
select throws_ok($$ insert into public.products (organization_id, sku, name, sale_price, purchase_price)
  values ('00000000-0000-4000-8000-00000000000a', 'S1-A-2', 'Alta con costo', 10, 5) $$,
  '42501', 'PRODUCT_COST_FORBIDDEN', 'un gerente sin permiso no da de alta con costo');
select lives_ok($$ insert into public.products (organization_id, sku, name, sale_price, purchase_price)
  values ('00000000-0000-4000-8000-00000000000a', 'S1-A-3', 'Alta sin costo', 10, 0) $$,
  'un gerente da de alta sin costo');
select lives_ok($$ update public.product_variants set purchase_price = 1 where id = '00000000-0000-4000-8000-0000000000e1' $$,
  'cambio de costo de variante sin permiso: sin error…');
select is(pg_temp.cost_of('00000000-0000-4000-8000-0000000000e1'), 50::numeric, '…y el costo de la variante queda igual');
select lives_ok($$ update public.product_variants set sale_price = 95 where id = '00000000-0000-4000-8000-0000000000e1' $$,
  'un gerente edita una variante sin tocar el costo');

-- Moneda extranjera
select lives_ok($$ update public.products set foreign_sale_price = 11 where id = '00000000-0000-4000-8000-0000000000f5' $$,
  'moneda extranjera: el gerente cambia el precio en dólares');
select is(pg_temp.cost_of('00000000-0000-4000-8000-0000000000f5'), 42000::numeric, 'el costo local se recalcula igual (no lo pisa)');
select lives_ok($$ update public.products set foreign_purchase_price = 1 where id = '00000000-0000-4000-8000-0000000000f5' $$,
  'cambio del costo en dólares sin permiso: sin error…');
select ok(pg_temp.foreign_cost_of('00000000-0000-4000-8000-0000000000f5') = 6 and pg_temp.cost_of('00000000-0000-4000-8000-0000000000f5') = 42000,
  '…y los dos costos quedan como estaban');
select throws_ok($$ update public.products set price_currency = null where id = '00000000-0000-4000-8000-0000000000f5' $$,
  '42501', 'PRODUCT_COST_FORBIDDEN', 'quitar la moneda (borraría el costo extranjero) se rechaza');
select throws_ok($$ insert into public.products (organization_id, sku, name, sale_price, price_currency, foreign_sale_price, foreign_purchase_price)
  values ('00000000-0000-4000-8000-00000000000a', 'S1-A-USD2', 'Alta en dólares con costo', 0, 'USD', 5, 2) $$,
  '42501', 'PRODUCT_COST_FORBIDDEN', 'alta en dólares con costo sin permiso se rechaza');

-- Oráculo entre organizaciones: el id de un producto de B con la organización propia.
select throws_ok($$ insert into public.products (id, organization_id, sku, name, sale_price, purchase_price)
  values ('00000000-0000-4000-8000-0000000000f9', '00000000-0000-4000-8000-00000000000a', 'X', 'x', 1, 149) on conflict (id) do nothing $$,
  '42501', 'PRODUCT_COST_FORBIDDEN', 'id ajeno con un costo errado: rechazado como alta nueva');
select throws_ok($$ insert into public.products (id, organization_id, sku, name, sale_price, purchase_price)
  values ('00000000-0000-4000-8000-0000000000f9', '00000000-0000-4000-8000-00000000000a', 'X', 'x', 1, 150) on conflict (id) do nothing $$,
  '42501', 'PRODUCT_COST_FORBIDDEN', 'id ajeno con el costo exacto: la misma respuesta (no hay oráculo)');
select is(pg_temp.cost_of('00000000-0000-4000-8000-0000000000f9'), 150::numeric, 'el producto de B no cambió');

-- El mismo gerente también es gerente en B: tampoco tiene permiso allá.
select lives_ok($$ update public.products set purchase_price = 1 where id = '00000000-0000-4000-8000-0000000000f9' $$,
  'dos organizaciones: en B tampoco cambia el costo…');
select is(pg_temp.cost_of('00000000-0000-4000-8000-0000000000f9'), 150::numeric, '…queda igual');

-- ─── Permiso legado (organization_id NULL) ──────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a4');
select lives_ok($$ update public.products set purchase_price = 2 where id = '00000000-0000-4000-8000-0000000000f1' $$,
  'permiso legado: sin error…');
select is(pg_temp.cost_of('00000000-0000-4000-8000-0000000000f1'), 100::numeric, '…pero no cambia el costo (no autoriza)');

-- ─── Gerente con products.update_cost en A ──────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000000a3');
select lives_ok($$ update public.products set purchase_price = 120 where id = '00000000-0000-4000-8000-0000000000f1' $$,
  'con products.update_cost del comercio se cambia el costo');
select lives_ok($$ update public.product_variants set purchase_price = 60 where id = '00000000-0000-4000-8000-0000000000e1' $$,
  'con products.update_cost del comercio se cambia el costo de una variante');
select ok(pg_temp.cost_of('00000000-0000-4000-8000-0000000000f1') = 120 and pg_temp.cost_of('00000000-0000-4000-8000-0000000000e1') = 60,
  'los cambios autorizados quedaron guardados');

-- ─── Administrador de otro comercio ─────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000000b1');
select lives_ok($$ update public.products set purchase_price = 999 where id = '00000000-0000-4000-8000-0000000000f1' $$,
  'el update de otro comercio no falla: la RLS no le muestra la fila');
select is(pg_temp.cost_of('00000000-0000-4000-8000-0000000000f1'), 120::numeric, 'el costo de A no lo tocó B');

-- ─── Rol de servicio / servidor (sin auth.uid) ──────────────────────────────
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
select lives_ok($$ update public.products set purchase_price = 140 where id = '00000000-0000-4000-8000-0000000000f1' $$,
  'sin auth.uid (servidor) la protección no interviene');

-- ─── La función de permisos no expone nada a anon ───────────────────────────
select ok(not has_function_privilege('anon', 'public.has_product_cost_access(uuid, text)', 'EXECUTE'),
  'anon no puede ejecutar has_product_cost_access');
select ok(not has_function_privilege('authenticated', 'public.guard_product_cost_writes()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.guard_product_variant_cost_writes()', 'EXECUTE'),
  'las funciones del trigger no se ofrecen a clientes (y el trigger sigue actuando: pruebas de arriba)');

select * from finish();
rollback;
