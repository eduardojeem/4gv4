-- Habilita el módulo de Reparaciones en los planes Free y Basic (con límite mensual),
-- alineando el enforcement técnico con lo que el marketing ya promete.
--
-- Antes: technical modules para FREE = inventory,pos,crm  y BASIC = inventory,pos,crm,ecommerce
--        (sin 'repairs'), pero subscription_plans marketea "Reparaciones 10/mes" y "100/mes".
-- Después: FREE y BASIC incluyen 'repairs' y un límite numérico mensual en plans.limits.

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
begin
  select *
  into source_plan
  from public.subscription_plans
  where tier = lower(plan_tier)
  limit 1;

  if source_plan is null then
    return;
  end if;

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
    'users', public.plan_limit_int(source_plan.limits, 'users',
      case canonical_code when 'FREE' then 2 when 'BASIC' then 5 when 'PRO' then 15 else null end),
    'branches', public.plan_limit_int(source_plan.limits, 'branches',
      case canonical_code when 'FREE' then 1 when 'BASIC' then 2 when 'PRO' then 5 else null end),
    'cashRegisters', public.plan_limit_int(source_plan.limits, 'cashRegisters',
      case canonical_code when 'FREE' then 1 when 'BASIC' then 3 when 'PRO' then 10 else null end),
    'products', public.plan_limit_int(source_plan.limits, 'products',
      case canonical_code when 'FREE' then 50 when 'BASIC' then 500 when 'PRO' then 5000 else null end),
    'categories', public.plan_limit_int(source_plan.limits, 'categories', null),
    -- Reparaciones: límite mensual. Se parsea de "10/mes" -> 10, "100/mes" -> 100, "Ilimitadas" -> null.
    'repairs', public.plan_limit_int(source_plan.limits, 'repairs',
      case canonical_code when 'FREE' then 10 when 'BASIC' then 100 else null end)
  );

  technical_modules := case canonical_code
    when 'FREE' then array['inventory','pos','crm','repairs']
    when 'BASIC' then array['inventory','pos','crm','ecommerce','repairs']
    when 'PRO' then array['inventory','pos','repairs','crm','ecommerce','whatsapp','analytics']
    else array['inventory','pos','repairs','crm','ecommerce','delivery','whatsapp','analytics']
  end;

  insert into public.plans (code, name, limits, modules, is_active)
  values (canonical_code, source_plan.name, technical_limits, technical_modules, source_plan.is_active)
  on conflict (code) do update set
    name = excluded.name,
    limits = excluded.limits,
    modules = excluded.modules,
    is_active = excluded.is_active;
end;
$$;

-- Re-sincronizar los planes técnicos existentes con la nueva definición.
do $$
declare
  plan_row record;
begin
  for plan_row in select tier from public.subscription_plans loop
    perform public.sync_technical_plan_from_subscription_plan(plan_row.tier);
  end loop;
end $$;
