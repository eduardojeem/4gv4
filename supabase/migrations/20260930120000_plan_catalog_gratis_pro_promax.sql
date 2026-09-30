-- Catálogo Gratis / Pro / Pro Max.
--
-- 1) La sincronización plan comercial -> plan técnico (trigger
--    sync_subscription_plans_to_plans) se alinea con la app (plan-modules.ts):
--    - conserva `repairPhotos`: antes reconstruía los límites sin esa clave, y
--      cualquier cambio en un plan dejaba a sus tiendas sin fotos;
--    - conecta a su módulo POS, inventario, reparaciones, clientes, ecommerce y
--      analítica (antes solo 8 features movían módulos);
--    - el inventario avanzado arrastra al básico.
-- 2) Carga el catálogo. Los precios no cambian; el trigger escribe `plans`.

create or replace function public.sync_technical_plan_from_subscription_plan(plan_tier text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  source_plan record;
  canonical_code text;
  technical_limits jsonb;
  technical_modules text[];
  feature_row jsonb;
  feature_module text;
  normalized_label text;
begin
  select * into source_plan
  from public.subscription_plans
  where tier = lower(plan_tier)
  limit 1;

  if source_plan is null then return; end if;

  canonical_code := case lower(source_plan.tier)
    when 'free' then 'FREE'
    when 'basic' then 'BASIC'
    when 'starter' then 'BASIC'
    when 'pro' then 'PRO'
    when 'profesional' then 'PRO'
    when 'enterprise' then 'ENTERPRISE'
    else upper(source_plan.tier)
  end;

  technical_limits := jsonb_build_object(
    'users', public.plan_limit_int(source_plan.limits, 'users', case canonical_code when 'FREE' then 2 when 'BASIC' then 5 when 'PRO' then 15 else null end),
    'branches', public.plan_limit_int(source_plan.limits, 'branches', case canonical_code when 'FREE' then 1 when 'BASIC' then 2 when 'PRO' then 5 else null end),
    'cashRegisters', public.plan_limit_int(source_plan.limits, 'cashRegisters', case canonical_code when 'FREE' then 1 when 'BASIC' then 3 when 'PRO' then 10 else null end),
    'products', public.plan_limit_int(source_plan.limits, 'products', case canonical_code when 'FREE' then 50 when 'BASIC' then 500 when 'PRO' then 5000 else null end),
    'categories', public.plan_limit_int(source_plan.limits, 'categories', null),
    'repairs', public.plan_limit_int(source_plan.limits, 'repairs', case canonical_code when 'FREE' then 10 when 'BASIC' then 100 else null end),
    -- Fotos por reparación: sin dato se mantiene la regla anterior (solo ENTERPRISE).
    'repairPhotos', coalesce(public.plan_limit_int(source_plan.limits, 'repairPhotos', case canonical_code when 'ENTERPRISE' then 6 else 0 end), 0)
  );

  technical_modules := case canonical_code
    when 'FREE' then array['inventory','pos','crm','repairs','services']
    when 'BASIC' then array['inventory','inventory_admin','pos','crm','ecommerce','repairs','services','orders','delivery']
    when 'PRO' then array['inventory','inventory_admin','pos','repairs','crm','ecommerce','services','orders','delivery','analytics','promotions','security']
    else array['inventory','inventory_admin','pos','repairs','crm','ecommerce','services','orders','delivery','analytics','promotions','security']
  end;

  for feature_row in
    select value from jsonb_array_elements(coalesce(source_plan.features, '[]'::jsonb))
  loop
    normalized_label := lower(translate(
      coalesce(feature_row->>'label', ''),
      'áéíóúÁÉÍÓÚ',
      'aeiouAEIOU'
    ));

    feature_module := case normalized_label
      when 'punto de venta (pos)' then 'pos'
      when 'inventario' then 'inventory'
      when 'inventario avanzado' then 'inventory_admin'
      when 'inventario avanzado (/admin/inventory)' then 'inventory_admin'
      when 'modulo de reparaciones' then 'repairs'
      when 'reparaciones' then 'repairs'
      when 'servicios' then 'services'
      when 'modulo de servicios' then 'services'
      when 'pedidos' then 'orders'
      when 'gestion de pedidos' then 'orders'
      when 'entregas' then 'delivery'
      when 'delivery' then 'delivery'
      when 'crm / gestion de clientes' then 'crm'
      when 'crm / clientes' then 'crm'
      when 'gestion de clientes' then 'crm'
      when 'ecommerce & marketplace' then 'ecommerce'
      when 'ecommerce / marketplace' then 'ecommerce'
      when 'analytics avanzado' then 'analytics'
      when 'creditos y cuotas' then 'credits'
      when 'creditos' then 'credits'
      when 'promociones y descuentos' then 'promotions'
      when 'seguridad y auditoria' then 'security'
      else null
    end;

    if feature_module is not null and jsonb_typeof(feature_row->'value') = 'boolean' then
      if (feature_row->>'value')::boolean then
        if not (feature_module = any(technical_modules)) then
          technical_modules := array_append(technical_modules, feature_module);
        end if;
      else
        technical_modules := array_remove(technical_modules, feature_module);
      end if;
    end if;
  end loop;

  if 'inventory_admin' = any(technical_modules) and not ('inventory' = any(technical_modules)) then
    technical_modules := array_append(technical_modules, 'inventory');
  end if;

  insert into public.plans (code, name, limits, modules, is_active)
  values (canonical_code, source_plan.name, technical_limits, technical_modules, source_plan.is_active)
  on conflict (code) do update set
    name = excluded.name,
    limits = excluded.limits,
    modules = excluded.modules,
    is_active = excluded.is_active;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catálogo. Cada UPDATE dispara el trigger, que reescribe el plan técnico.
-- ---------------------------------------------------------------------------

update public.subscription_plans set
  name = 'Gratis',
  price = 0,
  price_note = 'Siempre gratis',
  trial_days = 0,
  is_popular = false,
  limits = '{"users":"1","branches":"1","cashRegisters":"1","products":"100","repairs":"50/mes","repairPhotos":"0"}'::jsonb,
  highlights = '["Catálogo online y pedidos por WhatsApp","POS, inventario y reparaciones","Presencia en el marketplace"]'::jsonb,
  features = '[
    {"label":"Punto de Venta (POS)","value":true},
    {"label":"Inventario","value":true},
    {"label":"Inventario avanzado","value":false},
    {"label":"Gestión de usuarios","value":true},
    {"label":"Sucursales múltiples","value":false},
    {"label":"Módulo de Reparaciones","value":true},
    {"label":"Servicios","value":true},
    {"label":"Pedidos","value":false},
    {"label":"Entregas","value":false},
    {"label":"CRM / Gestión de clientes","value":true},
    {"label":"Ecommerce & Marketplace","value":true},
    {"label":"Analytics avanzado","value":false},
    {"label":"Reportes exportables (CSV/PDF)","value":false},
    {"label":"Créditos y cuotas","value":false},
    {"label":"Promociones y descuentos","value":false},
    {"label":"Seguridad y auditoría","value":false},
    {"label":"Soporte prioritario","value":false}
  ]'::jsonb,
  updated_at = now()
where tier = 'free';

update public.subscription_plans set
  name = 'Pro',
  trial_days = 7,
  is_popular = false,
  limits = '{"users":"5","branches":"2","cashRegisters":"3","products":"500","repairs":"300/mes","repairPhotos":"3"}'::jsonb,
  highlights = '["Carrito y pedidos online","Créditos, cuotas y promociones","3 fotos por reparación"]'::jsonb,
  features = '[
    {"label":"Punto de Venta (POS)","value":true},
    {"label":"Inventario","value":true},
    {"label":"Inventario avanzado","value":true},
    {"label":"Gestión de usuarios","value":true},
    {"label":"Sucursales múltiples","value":true},
    {"label":"Módulo de Reparaciones","value":true},
    {"label":"Servicios","value":true},
    {"label":"Pedidos","value":true},
    {"label":"Entregas","value":true},
    {"label":"CRM / Gestión de clientes","value":true},
    {"label":"Ecommerce & Marketplace","value":true},
    {"label":"Analytics avanzado","value":false},
    {"label":"Reportes exportables (CSV/PDF)","value":true},
    {"label":"Créditos y cuotas","value":true},
    {"label":"Promociones y descuentos","value":true},
    {"label":"Seguridad y auditoría","value":false},
    {"label":"Soporte prioritario","value":false}
  ]'::jsonb,
  updated_at = now()
where tier = 'basic';

-- Pro Max queda como destacado; el trigger normalize_popular_subscription_plan
-- mantiene un solo plan destacado.
update public.subscription_plans set
  name = 'Pro Max',
  trial_days = 7,
  is_popular = true,
  limits = '{"users":"15","branches":"5","cashRegisters":"10","products":"10.000","repairs":"Ilimitadas","repairPhotos":"6"}'::jsonb,
  highlights = '["Analítica y visitas web","Seguridad y auditoría","6 fotos por reparación y soporte prioritario"]'::jsonb,
  features = '[
    {"label":"Punto de Venta (POS)","value":true},
    {"label":"Inventario","value":true},
    {"label":"Inventario avanzado","value":true},
    {"label":"Gestión de usuarios","value":true},
    {"label":"Sucursales múltiples","value":true},
    {"label":"Módulo de Reparaciones","value":true},
    {"label":"Servicios","value":true},
    {"label":"Pedidos","value":true},
    {"label":"Entregas","value":true},
    {"label":"CRM / Gestión de clientes","value":true},
    {"label":"Ecommerce & Marketplace","value":true},
    {"label":"Analytics avanzado","value":true},
    {"label":"Reportes exportables (CSV/PDF)","value":true},
    {"label":"Créditos y cuotas","value":true},
    {"label":"Promociones y descuentos","value":true},
    {"label":"Seguridad y auditoría","value":true},
    {"label":"Soporte prioritario","value":true}
  ]'::jsonb,
  updated_at = now()
where tier = 'pro';

-- ULTRA sigue inactivo (acuerdos a medida); se resincroniza para que su plan
-- técnico también tenga `repairPhotos`.
update public.subscription_plans set is_popular = false, updated_at = now() where tier = 'enterprise';
select public.sync_technical_plan_from_subscription_plan('enterprise');
