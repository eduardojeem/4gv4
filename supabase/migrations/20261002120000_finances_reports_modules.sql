-- Finanzas y Reportes exportables como módulos del plan.
--
-- Finanzas (/admin/finances: gastos, nómina, rentabilidad) no tenía ningún
-- control de plan: la veía hasta el plan Gratis. "Reportes exportables" era
-- una fila informativa: exportar dependía de que el plan no fuera FREE, y
-- tildarla o destildarla en el panel no cambiaba nada.
--
--   finances: Gratis no · Pro sí · Pro Max sí · ULTRA sí
--   reports:  Gratis no · Pro sí · Pro Max sí · ULTRA sí (como hasta ahora)
--
-- 1) El CHECK de organizations.enabled_modules acepta los módulos nuevos.
-- 2) El trigger conecta las etiquetas y los incluye por defecto en BASIC, PRO
--    y ENTERPRISE (igual que plan-modules.ts).
-- 3) Cada plan suma la fila "Finanzas y rentabilidad"; "Reportes exportables"
--    conserva el valor que ya tenía (se agrega si faltaba).
-- 4) Las organizaciones con lista propia de módulos reciben los nuevos si su
--    plan los incluye.

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
    when 'BASIC' then array['inventory','inventory_admin','pos','crm','ecommerce','repairs','services','orders','delivery','web_analytics','finances','reports']
    when 'PRO' then array['inventory','inventory_admin','pos','repairs','crm','ecommerce','services','orders','delivery','analytics','web_analytics','promotions','security','finances','reports']
    else array['inventory','inventory_admin','pos','repairs','crm','ecommerce','services','orders','delivery','analytics','web_analytics','promotions','security','finances','reports']
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
      when 'finanzas y rentabilidad' then 'finances'
      when 'finanzas' then 'finances'
      when 'reportes exportables (csv/pdf)' then 'reports'
      when 'reportes exportables' then 'reports'
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
-- Reemplaza (o agrega) "Finanzas y rentabilidad"; agrega "Reportes
-- exportables" solo si faltaba, para respetar lo que cada plan ya tenía.
update public.subscription_plans sp set
  features = coalesce((
    select jsonb_agg(item)
    from jsonb_array_elements(coalesce(sp.features, '[]'::jsonb)) as item
    where lower(coalesce(item->>'label', '')) not in ('finanzas y rentabilidad', 'finanzas')
  ), '[]'::jsonb)
  || jsonb_build_array(jsonb_build_object('label', 'Finanzas y rentabilidad', 'value', sp.tier <> 'free'))
  || case
       when exists (
         select 1 from jsonb_array_elements(coalesce(sp.features, '[]'::jsonb)) as item
         where lower(coalesce(item->>'label', '')) like 'reportes exportables%'
       ) then '[]'::jsonb
       else jsonb_build_array(jsonb_build_object('label', 'Reportes exportables (CSV/PDF)', 'value', sp.tier <> 'free'))
     end,
  updated_at = now()
where sp.tier in ('free', 'basic', 'pro', 'enterprise');

-- 4) ------------------------------------------------------------------------
-- Con enabled_modules nulo no hace falta nada: nulo es «todos los del plan».
with org_plan as (
  select o.id,
    case upper(coalesce((select s.plan from public.subscriptions s where s.organization_id = o.id limit 1), o.plan))
      when 'STARTER' then 'BASIC'
      when 'PROFESIONAL' then 'PRO'
      else upper(coalesce((select s.plan from public.subscriptions s where s.organization_id = o.id limit 1), o.plan))
    end as code
  from public.organizations o
  where o.enabled_modules is not null
)
update public.organizations o set
  enabled_modules = (
    select array_agg(distinct module)
    from unnest(
      o.enabled_modules
      || case when 'finances' = any(p.modules) then array['finances'] else array[]::text[] end
      || case when 'reports' = any(p.modules) then array['reports'] else array[]::text[] end
    ) as module
  )
from org_plan op
join public.plans p on p.code = op.code
where o.id = op.id
  and (('finances' = any(p.modules) and not ('finances' = any(o.enabled_modules)))
    or ('reports' = any(p.modules) and not ('reports' = any(o.enabled_modules))));
