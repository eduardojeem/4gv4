-- S1, Etapa 2: lectura de costos (supabase/pending-migrations/s1-product-cost/02 y 03).
-- Correr SOLO contra una base local o una rama de Supabase DESPUÉS de aplicar 01, 02 y 03.
-- Nunca contra el proyecto de producción. Todo queda dentro de una transacción con rollback.
begin;
select plan(58);

-- ─── Datos de prueba (como postgres: sin RLS) ───────────────────────────────
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000002a1', 's1r-owner@test.local'),
  ('00000000-0000-4000-8000-0000000002a2', 's1r-tech@test.local'),
  ('00000000-0000-4000-8000-0000000002a3', 's1r-tech-read@test.local'),
  ('00000000-0000-4000-8000-0000000002a4', 's1r-manager-update@test.local'),
  ('00000000-0000-4000-8000-0000000002a5', 's1r-legacy@test.local'),
  ('00000000-0000-4000-8000-0000000002a6', 's1r-admin@test.local'),
  ('00000000-0000-4000-8000-0000000002b1', 's1r-admin-b@test.local');

insert into public.organizations (id, name, slug) values
  ('00000000-0000-4000-8000-00000000020a', 'S1R Comercio A', 's1r-comercio-a'),
  ('00000000-0000-4000-8000-00000000020b', 'S1R Comercio B', 's1r-comercio-b');

insert into public.organization_members (organization_id, user_id, role, status) values
  ('00000000-0000-4000-8000-00000000020a', '00000000-0000-4000-8000-0000000002a1', 'owner', 'active'),
  ('00000000-0000-4000-8000-00000000020a', '00000000-0000-4000-8000-0000000002a2', 'technician', 'active'),
  ('00000000-0000-4000-8000-00000000020a', '00000000-0000-4000-8000-0000000002a3', 'technician', 'active'),
  ('00000000-0000-4000-8000-00000000020a', '00000000-0000-4000-8000-0000000002a4', 'manager', 'active'),
  ('00000000-0000-4000-8000-00000000020a', '00000000-0000-4000-8000-0000000002a5', 'technician', 'active'),
  ('00000000-0000-4000-8000-00000000020a', '00000000-0000-4000-8000-0000000002a6', 'admin', 'active'),
  ('00000000-0000-4000-8000-00000000020b', '00000000-0000-4000-8000-0000000002b1', 'admin', 'active');

insert into public.user_permissions (user_id, organization_id, permission, is_active) values
  ('00000000-0000-4000-8000-0000000002a3', '00000000-0000-4000-8000-00000000020a', 'products.read_cost', true),
  ('00000000-0000-4000-8000-0000000002a4', '00000000-0000-4000-8000-00000000020a', 'products.update_cost', true),
  -- Permiso legado sin comercio: no tiene que mostrar nada.
  ('00000000-0000-4000-8000-0000000002a5', null, 'products.read_cost', true);

insert into public.categories (id, name, organization_id) values
  ('00000000-0000-4000-8000-0000000002c1', 'S1R Categoría A', '00000000-0000-4000-8000-00000000020a');

insert into public.products (id, organization_id, sku, name, sale_price, purchase_price, stock_quantity, min_stock, category_id) values
  ('00000000-0000-4000-8000-0000000002f1', '00000000-0000-4000-8000-00000000020a', 'S1R-A-1', 'Producto A1', 200, 100, 5, 1, '00000000-0000-4000-8000-0000000002c1'),
  ('00000000-0000-4000-8000-0000000002f2', '00000000-0000-4000-8000-00000000020a', 'S1R-A-2', 'Producto A2', 50, 20, 10, 1, '00000000-0000-4000-8000-0000000002c1'),
  ('00000000-0000-4000-8000-0000000002f9', '00000000-0000-4000-8000-00000000020b', 'S1R-B-1', 'Producto B1', 300, 150, 2, 1, null);
insert into public.product_variants (id, organization_id, product_id, variant_name, purchase_price, sale_price) values
  ('00000000-0000-4000-8000-0000000002e1', '00000000-0000-4000-8000-00000000020a', '00000000-0000-4000-8000-0000000002f1', 'Variante A1', 60, 210);

insert into public.branches (id, organization_id, code, name, slug, is_active) values
  ('00000000-0000-4000-8000-0000000002b9', '00000000-0000-4000-8000-00000000020a', 'S1R-SUC', 'S1R Sucursal A', 's1r-sucursal-a', true);
insert into public.sales (id, organization_id, branch_id, code, total_amount, subtotal_amount, payment_method, status, created_at) values
  ('00000000-0000-4000-8000-0000000002d1', '00000000-0000-4000-8000-00000000020a', '00000000-0000-4000-8000-0000000002b9', 'S1R-V-1', 400, 400, 'cash', 'completed', now() - interval '1 hour');
insert into public.sale_items (sale_id, organization_id, product_id, quantity, unit_price, subtotal) values
  ('00000000-0000-4000-8000-0000000002d1', '00000000-0000-4000-8000-00000000020a', '00000000-0000-4000-8000-0000000002f1', 2, 200, 400);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on function pg_temp.act_as(uuid) to authenticated;

-- ─── Privilegios de columna (metadatos) ─────────────────────────────────────
select is((select count(*)::int from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'products'
    and c.column_name not in ('purchase_price', 'foreign_purchase_price')
    and not has_column_privilege('authenticated', 'public.products', c.column_name, 'SELECT')), 0,
  'authenticated lee toda columna de products salvo el costo (una columna nueva sin GRANT falla acá)');
select is((select count(*)::int from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'product_variants'
    and c.column_name <> 'purchase_price'
    and not has_column_privilege('authenticated', 'public.product_variants', c.column_name, 'SELECT')), 0,
  'authenticated lee toda columna de product_variants salvo el costo');
select ok(not has_column_privilege('authenticated', 'public.products', 'purchase_price', 'SELECT')
  and not has_column_privilege('authenticated', 'public.products', 'foreign_purchase_price', 'SELECT')
  and not has_column_privilege('anon', 'public.products', 'purchase_price', 'SELECT')
  and not has_column_privilege('authenticated', 'public.product_variants', 'purchase_price', 'SELECT'),
  'ni anon ni authenticated tienen SELECT sobre las columnas de costo');
select ok(not has_table_privilege('authenticated', 'public.products', 'TRUNCATE')
  and not has_table_privilege('anon', 'public.product_variants', 'TRUNCATE'),
  'sin TRUNCATE para clientes (no pasa por la RLS)');
select ok(not has_function_privilege('anon', 'public.get_product_costs(uuid[], uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_variant_costs(uuid[], uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.can_read_product_cost(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.search_products(text, uuid, uuid, character varying, character varying, integer, integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.generate_inventory_report(date, date, uuid)', 'EXECUTE'),
  'anon no ejecuta las funciones de costo ni las RPC de reportes');

-- ─── Técnico sin permiso de costos ──────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000002a2');
select throws_ok($$ select purchase_price from public.products $$, '42501', null, 'técnico: SELECT purchase_price rechazado');
select throws_ok($$ select * from public.products $$, '42501', null, 'técnico: SELECT * rechazado');
select throws_ok($$ select foreign_purchase_price from public.products $$, '42501', null, 'técnico: SELECT foreign_purchase_price rechazado');
select throws_ok($$ select purchase_price from public.product_variants $$, '42501', null, 'técnico: SELECT purchase_price de variantes rechazado');
select is((select count(*)::int from public.products), 2, 'técnico: ve las 2 filas de su comercio con columnas permitidas');
select throws_ok($$ select id from public.products where purchase_price > 50 $$, '42501', null, 'técnico: filtrar por costo también se rechaza (sin oráculo)');
select throws_ok($$ select id from public.products order by purchase_price $$, '42501', null, 'técnico: ordenar por costo se rechaza');
select is((select count(*)::int from public.get_product_costs(array['00000000-0000-4000-8000-0000000002f1','00000000-0000-4000-8000-0000000002f2','00000000-0000-4000-8000-0000000002f9']::uuid[])), 0, 'técnico: get_product_costs no devuelve nada');
select is((select count(*)::int from public.get_variant_costs(array['00000000-0000-4000-8000-0000000002e1']::uuid[])), 0, 'técnico: get_variant_costs no devuelve nada');
select ok((select bool_and(purchase_price is null) from public.products_safe), 'técnico: products_safe con costo NULL');
select ok((select bool_and(purchase_price is null and profit_margin_percentage is null and total_stock_value is null) from public.products_detailed), 'técnico: products_detailed sin costo ni margen');
select ok((select bool_and(margin is null and margin_percentage is null) from public.products_full), 'técnico: products_full sin margen');
select ok((select total_cost_value is null and total_margin is null and total_products = 2 from public.product_stats), 'técnico: product_stats sin valores de costo');
select ok((select total_inventory_value is null and avg_purchase_price is null and avg_profit_margin is null from public.products_dashboard_stats), 'técnico: products_dashboard_stats sin valores de costo');
select ok((select bool_and(purchase_price is null and profit_margin is null and total_value is null) and count(*) = 2 from public.search_products()), 'técnico: search_products sin costo, margen ni valor');
select ok((select bool_and(stock_value is null) and count(*) = 2 from public.generate_inventory_report()), 'técnico: generate_inventory_report sin valor al costo');
select ok((select avg_margin_percentage is null from public.get_category_stats() where category_id = '00000000-0000-4000-8000-0000000002c1'), 'técnico: get_category_stats sin margen');
select throws_ok($$ select public.dashboard_pos_summary_s1('00000000-0000-4000-8000-00000000020a', null, now() - interval '1 day', now()) $$,
  '42501', null, 'técnico: dashboard_pos_summary sigue exigiendo analytics.read');
select ok(not public.can_read_product_cost('00000000-0000-4000-8000-00000000020a'), 'técnico: can_read_product_cost falso');

-- ─── Permiso legado (organization_id NULL) ──────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000002a5');
select is((select count(*)::int from public.get_product_costs(array['00000000-0000-4000-8000-0000000002f1','00000000-0000-4000-8000-0000000002f2','00000000-0000-4000-8000-0000000002f9']::uuid[])), 0, 'legado: read_cost sin comercio no muestra costos');
select ok(not public.app_can_view_cost('00000000-0000-4000-8000-00000000020a'), 'legado: app_can_view_cost(org) falso');

-- ─── Técnico con products.read_cost en A ────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000002a3');
select throws_ok($$ select purchase_price from public.products $$, '42501', null, 'con read_cost: la columna sigue cerrada (se lee por RPC)');
select is((select count(*)::int from public.get_product_costs(array['00000000-0000-4000-8000-0000000002f1','00000000-0000-4000-8000-0000000002f2','00000000-0000-4000-8000-0000000002f9']::uuid[])), 2, 'con read_cost: get_product_costs devuelve los 2 de A');
select is((select purchase_price from public.get_variant_costs(array['00000000-0000-4000-8000-0000000002e1']::uuid[]) where variant_id = '00000000-0000-4000-8000-0000000002e1'), 60::numeric, 'con read_cost: costo de la variante');
select is((select purchase_price from public.products_safe where id = '00000000-0000-4000-8000-0000000002f1'), 100::numeric, 'con read_cost: products_safe muestra el costo');
select is((select profit_margin from public.search_products() where id = '00000000-0000-4000-8000-0000000002f1'), 100.00::numeric, 'con read_cost: search_products calcula el margen');

-- ─── Gerente con update_cost pero sin read_cost ─────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000002a4');
select is((select count(*)::int from public.get_product_costs(array['00000000-0000-4000-8000-0000000002f1','00000000-0000-4000-8000-0000000002f2','00000000-0000-4000-8000-0000000002f9']::uuid[])), 0, 'update_cost solo: no lee costos (igual que la API)');
select lives_ok($$ update public.products set purchase_price = 110 where id = '00000000-0000-4000-8000-0000000002f1' $$,
  'update_cost: cambia el costo sin poder leerlo (UPDATE sin RETURNING)');
select throws_ok($$ update public.products set purchase_price = 111 where id = '00000000-0000-4000-8000-0000000002f1' returning purchase_price $$,
  '42501', null, 'RETURNING purchase_price rechazado');
select lives_ok($$ update public.products set sale_price = 205 where id = '00000000-0000-4000-8000-0000000002f1' returning id, sale_price $$,
  'RETURNING de columnas permitidas funciona');
select ok((select (j->>'costHidden')::boolean and j->'totalCost' = 'null'::jsonb and j->'itemsWithoutCost' = 'null'::jsonb
    and j->'repairStats'->'netProfit' = 'null'::jsonb and j->'repairStats'->'deliveredPartsCost' = 'null'::jsonb
    and jsonb_typeof(j->'totalSales') = 'number'
  from (select public.dashboard_pos_summary_s1('00000000-0000-4000-8000-00000000020a', null, now() - interval '1 day', now()) j) s),
  'gerente (analytics.read sin read_cost): resumen POS con costo y ganancia ocultos, ventas visibles');

-- ─── Dueño de A ─────────────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000002a1');
select throws_ok($$ select * from public.products $$, '42501', null, 'dueño: SELECT * también se rechaza (la web usa columnas explícitas)');
select is((select purchase_price from public.get_product_costs(array['00000000-0000-4000-8000-0000000002f1']::uuid[])), 110::numeric, 'dueño: ve el costo por RPC');
select is((select count(*)::int from public.get_product_costs(array['00000000-0000-4000-8000-0000000002f9']::uuid[])), 0, 'dueño de A: no ve el costo de B aunque pida el id');
select ok((select total_cost_value = 5 * 110 + 10 * 20 from public.product_stats), 'dueño: product_stats con valor al costo');
select ok((select stock_value is not null from public.generate_inventory_report() where product_id = '00000000-0000-4000-8000-0000000002f1'), 'dueño: inventario valorizado');
select ok((select avg_margin_percentage is not null from public.get_category_stats() where category_id = '00000000-0000-4000-8000-0000000002c1'), 'dueño: margen por categoría');
select ok((select not (j->>'costHidden')::boolean and (j->>'totalCost')::numeric = 220
  from (select public.dashboard_pos_summary_s1('00000000-0000-4000-8000-00000000020a', null, now() - interval '1 day', now()) j) s),
  'dueño: resumen POS con costo de mercadería (2 × 110)');
-- ON CONFLICT DO UPDATE lee la fila existente: exige SELECT sobre las columnas que
-- toca. Ningún cliente hace upsert de products; save_product_with_variants es
-- SECURITY DEFINER y no se ve afectada (ver la prueba del rol de servicio abajo).
select throws_ok($$ insert into public.products (id, organization_id, sku, name, sale_price, purchase_price)
  values ('00000000-0000-4000-8000-0000000002f1', '00000000-0000-4000-8000-00000000020a', 'S1R-A-1', 'Producto A1', 205, 115)
  on conflict (id) do update set purchase_price = excluded.purchase_price $$,
  '42501', null, 'dueño: un upsert directo que toca el costo se rechaza (cambio de comportamiento documentado)');
select throws_ok($$ update public.products set purchase_price = 1 where id = '00000000-0000-4000-8000-0000000002f1' and purchase_price = 110 $$,
  '42501', null, 'dueño: WHERE sobre el costo exige SELECT y se rechaza (la web no lo usa)');
select throws_ok($$ truncate public.products $$, '42501', null, 'dueño: TRUNCATE rechazado');

-- ─── Administrador de A ─────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000002a6');
select is((select count(*)::int from public.get_product_costs(array['00000000-0000-4000-8000-0000000002f1','00000000-0000-4000-8000-0000000002f2','00000000-0000-4000-8000-0000000002f9']::uuid[])), 2, 'administrador: ve los costos de su comercio');

-- ─── Administrador de B ─────────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-8000-0000000002b1');
select is((select count(*)::int from public.get_product_costs(array['00000000-0000-4000-8000-0000000002f1', '00000000-0000-4000-8000-0000000002f9']::uuid[])), 1, 'admin de B: solo el costo de B');
select is((select count(*)::int from public.products where id = '00000000-0000-4000-8000-0000000002f1'), 0, 'admin de B: no ve productos de A');
select ok((select bool_and(organization_id = '00000000-0000-4000-8000-00000000020b') from public.products_safe), 'admin de B: products_safe solo con filas de B');
select is((select count(*)::int from public.get_product_costs(array['00000000-0000-4000-8000-0000000002f1','00000000-0000-4000-8000-0000000002f2','00000000-0000-4000-8000-0000000002f9']::uuid[], '00000000-0000-4000-8000-00000000020a')), 0, 'admin de B: pedir la organización A no devuelve nada');
select throws_ok($$ select public.dashboard_pos_summary_s1('00000000-0000-4000-8000-00000000020a', null, now() - interval '1 day', now()) $$,
  '42501', null, 'admin de B: no ve el resumen POS de A');

select pg_temp.act_as('00000000-0000-4000-8000-0000000002a2');
select is((select count(*)::int from public.get_product_costs(array['00000000-0000-4000-8000-0000000002f1']::uuid[])), 0, 'técnico: tampoco por id');

-- ─── Rol de servicio (las APIs) y funciones SECURITY DEFINER ────────────────
reset role;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
select is((select purchase_price from public.products where id = '00000000-0000-4000-8000-0000000002f1'), 110::numeric,
  'service_role (APIs con createAdminSupabase) sigue leyendo el costo');
select lives_ok($$ select public.save_product_with_variants(
    jsonb_build_object('id', '00000000-0000-4000-8000-0000000002f2', 'organization_id', '00000000-0000-4000-8000-00000000020a',
      'name', 'Producto A2', 'sku', 'S1R-A-2', 'sale_price', 55, 'purchase_price', 20, 'has_variants', false,
      'warranty_months', 0, 'return_window_days', 0, 'exchange_window_days', 0, 'stock_quantity', 10, 'min_stock', 1),
    '[]'::jsonb, null, '00000000-0000-4000-8000-0000000002a1') $$,
  'save_product_with_variants (definer, upsert) guarda con la 03 aplicada');
reset role;
select is((select purchase_price from public.products where id = '00000000-0000-4000-8000-0000000002f2'), 20::numeric,
  'el guardado conservó el costo existente');

select pg_temp.act_as('00000000-0000-4000-8000-0000000002a1');
select throws_ok($check$ select public.get_product_costs(null, '00000000-0000-4000-8000-00000000020a') $check$,'22023',null,'unbounded IDs rejected');
select throws_ok($check$ select public.get_variant_costs(array_fill('00000000-0000-4000-8000-0000000002e1'::uuid,array[2001]), '00000000-0000-4000-8000-00000000020a') $check$,'22023',null,'oversized variant request rejected');
select * from finish();
rollback;
