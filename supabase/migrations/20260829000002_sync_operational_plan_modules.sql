-- Keep operational modules aligned between the commercial plan editor and
-- the technical entitlement table used by UI and API gates.
--
-- Contract:
--   services             -> every plan
--   orders and delivery  -> Basic and higher

create or replace function public.sync_technical_plan_from_subscription_plan(plan_tier text)
returns void
language plpgsql
security definer
set search_path = public
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
    'repairs', public.plan_limit_int(source_plan.limits, 'repairs', case canonical_code when 'FREE' then 10 when 'BASIC' then 100 else null end)
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
      when 'creditos y cuotas' then 'credits'
      when 'creditos' then 'credits'
      when 'promociones y descuentos' then 'promotions'
      when 'seguridad y auditoria' then 'security'
      when 'inventario avanzado' then 'inventory_admin'
      when 'inventario avanzado (/admin/inventory)' then 'inventory_admin'
      when 'servicios' then 'services'
      when 'modulo de servicios' then 'services'
      when 'pedidos' then 'orders'
      when 'gestion de pedidos' then 'orders'
      when 'entregas' then 'delivery'
      when 'delivery' then 'delivery'
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

  insert into public.plans (code, name, limits, modules, is_active)
  values (canonical_code, source_plan.name, technical_limits, technical_modules, source_plan.is_active)
  on conflict (code) do update set
    name = excluded.name,
    limits = excluded.limits,
    modules = excluded.modules,
    is_active = excluded.is_active;
end;
$$;

revoke all on function public.sync_technical_plan_from_subscription_plan(text) from public, anon, authenticated;
grant execute on function public.sync_technical_plan_from_subscription_plan(text) to service_role;

update public.subscription_plans
set features = coalesce(features, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'label', 'Servicios',
  'value', true
))
where not exists (
  select 1
  from jsonb_array_elements(coalesce(features, '[]'::jsonb)) feature
  where lower(translate(feature->>'label', 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) in ('servicios', 'modulo de servicios')
);

update public.subscription_plans
set features = coalesce(features, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'label', 'Pedidos',
  'value', lower(tier) <> 'free'
))
where not exists (
  select 1
  from jsonb_array_elements(coalesce(features, '[]'::jsonb)) feature
  where lower(translate(feature->>'label', 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) in ('pedidos', 'gestion de pedidos')
);

update public.subscription_plans
set features = coalesce(features, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'label', 'Entregas',
  'value', lower(tier) <> 'free'
))
where not exists (
  select 1
  from jsonb_array_elements(coalesce(features, '[]'::jsonb)) feature
  where lower(translate(feature->>'label', 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) in ('entregas', 'delivery')
);

-- Enforce the requested distribution even if one of these labels already
-- existed with a stale value before this migration.
update public.subscription_plans plan
set features = (
  select jsonb_agg(
    case lower(translate(feature->>'label', 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'))
      when 'servicios' then jsonb_set(feature, '{value}', 'true'::jsonb)
      when 'modulo de servicios' then jsonb_set(feature, '{value}', 'true'::jsonb)
      when 'pedidos' then jsonb_set(feature, '{value}', to_jsonb(lower(plan.tier) <> 'free'))
      when 'gestion de pedidos' then jsonb_set(feature, '{value}', to_jsonb(lower(plan.tier) <> 'free'))
      when 'entregas' then jsonb_set(feature, '{value}', to_jsonb(lower(plan.tier) <> 'free'))
      when 'delivery' then jsonb_set(feature, '{value}', to_jsonb(lower(plan.tier) <> 'free'))
      else feature
    end
    order by ordinal
  )
  from jsonb_array_elements(coalesce(plan.features, '[]'::jsonb)) with ordinality items(feature, ordinal)
);

do $$
declare plan_row record;
begin
  for plan_row in select tier from public.subscription_plans loop
    perform public.sync_technical_plan_from_subscription_plan(plan_row.tier);
  end loop;
end $$;
