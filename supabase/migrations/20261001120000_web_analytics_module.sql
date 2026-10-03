-- Visitas web como módulo propio (`web_analytics`).
--
-- Hasta ahora /admin/visitas colgaba del módulo `analytics`, así que no se
-- podía vender la analítica de la tienda online sin la analítica de ventas.
-- Con un módulo aparte cada plan decide por separado:
--   Gratis: no · Pro: sí (vende online y quiere saber quién entra) ·
--   Pro Max: sí · ULTRA: sí.
--
-- 1) El CHECK de organizations.enabled_modules acepta el módulo nuevo.
-- 2) El trigger plan comercial -> plan técnico conecta la etiqueta
--    "Visitas web" y lo incluye por defecto en BASIC, PRO y ENTERPRISE
--    (igual que plan-modules.ts).
-- 3) Cada plan comercial suma la fila "Visitas web"; el UPDATE dispara el
--    trigger, que reescribe plans.modules.
-- 4) Nadie pierde acceso: las organizaciones con lista propia de módulos
--    reciben web_analytics si su plan lo incluye, y las pruebas vigentes de
--    analytics se copian a web_analytics.

-- 1) ------------------------------------------------------------------------
alter table public.organizations drop constraint if exists organizations_enabled_modules_check;
alter table public.organizations add constraint organizations_enabled_modules_check check (
  enabled_modules is null or enabled_modules <@ array[
    'inventory', 'inventory_admin', 'pos', 'crm', 'orders', 'ecommerce', 'repairs', 'services',
    'credits', 'delivery', 'analytics', 'web_analytics', 'promotions', 'security',
    'finances', 'reports'
  ]::text[]
);

-- 2) ------------------------------------------------------------------------
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
    when 'BASIC' then array['inventory','inventory_admin','pos','crm','ecommerce','repairs','services','orders','delivery','web_analytics']
    when 'PRO' then array['inventory','inventory_admin','pos','repairs','crm','ecommerce','services','orders','delivery','analytics','web_analytics','promotions','security']
    else array['inventory','inventory_admin','pos','repairs','crm','ecommerce','services','orders','delivery','analytics','web_analytics','promotions','security']
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
      when 'visitas web' then 'web_analytics'
      when 'visitas de la tienda online' then 'web_analytics'
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

-- 3) ------------------------------------------------------------------------
-- Reemplaza (o agrega) la fila "Visitas web" sin tocar el resto de la lista.
update public.subscription_plans sp set
  features = coalesce((
    select jsonb_agg(item)
    from jsonb_array_elements(coalesce(sp.features, '[]'::jsonb)) as item
    where lower(coalesce(item->>'label', '')) not in ('visitas web', 'visitas de la tienda online')
  ), '[]'::jsonb) || jsonb_build_array(jsonb_build_object('label', 'Visitas web', 'value', sp.tier <> 'free')),
  updated_at = now()
where sp.tier in ('free', 'basic', 'pro', 'enterprise');

-- 4) ------------------------------------------------------------------------
-- Organizaciones con lista propia de módulos (enabled_modules no nulo): sin
-- esto el módulo nuevo les quedaba apagado aunque su plan lo incluya, y las de
-- Pro Max perdían las visitas que ya veían. Con enabled_modules nulo no hace
-- falta nada: nulo es «todos los del plan».
update public.organizations o set
  enabled_modules = array_append(o.enabled_modules, 'web_analytics')
from public.plans p
where o.enabled_modules is not null
  and not ('web_analytics' = any(o.enabled_modules))
  and p.code = case upper(coalesce(
        (select s.plan from public.subscriptions s where s.organization_id = o.id limit 1),
        o.plan
      ))
      when 'STARTER' then 'BASIC'
      when 'PROFESIONAL' then 'PRO'
      else upper(coalesce(
        (select s.plan from public.subscriptions s where s.organization_id = o.id limit 1),
        o.plan
      ))
    end
  and 'web_analytics' = any(p.modules);

-- Quien estaba probando analytics también veía las visitas: la prueba sigue
-- con la misma fecha de vencimiento.
insert into public.organization_module_trials (organization_id, module, started_at, expires_at, created_by)
select organization_id, 'web_analytics', started_at, expires_at, created_by
from public.organization_module_trials
where module = 'analytics' and expires_at > now()
on conflict (organization_id, module) do nothing;
