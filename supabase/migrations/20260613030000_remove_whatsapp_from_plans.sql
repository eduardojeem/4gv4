-- Quita WhatsApp de los planes (módulo técnico + feature comercial + highlight),
-- porque la integración no está lista y no se debe vender.
-- Mantiene el resto del estado vigente (repairs en free/basic, analytics en pro+).

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
    'repairs', public.plan_limit_int(source_plan.limits, 'repairs',
      case canonical_code when 'FREE' then 10 when 'BASIC' then 100 else null end)
  );

  -- Sin 'whatsapp' en ningún plan.
  technical_modules := case canonical_code
    when 'FREE' then array['inventory','pos','crm','repairs']
    when 'BASIC' then array['inventory','pos','crm','ecommerce','repairs']
    when 'PRO' then array['inventory','pos','repairs','crm','ecommerce','analytics']
    else array['inventory','pos','repairs','crm','ecommerce','delivery','analytics']
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

-- Re-sincronizar los planes técnicos.
do $$
declare
  plan_row record;
begin
  for plan_row in select tier from public.subscription_plans loop
    perform public.sync_technical_plan_from_subscription_plan(plan_row.tier);
  end loop;
end $$;

-- Quitar el ítem "WhatsApp" del comparativo comercial (features jsonb) en todos los planes.
update public.subscription_plans
set features = (
  select coalesce(jsonb_agg(elem), '[]'::jsonb)
  from jsonb_array_elements(features) elem
  where elem->>'label' <> 'WhatsApp'
)
where features @> '[{"label": "WhatsApp"}]'::jsonb;

-- Quitar "WhatsApp integrado" de los highlights (plan Pro).
update public.subscription_plans
set highlights = (
  select coalesce(jsonb_agg(h), '[]'::jsonb)
  from jsonb_array_elements(highlights) h
  where h <> '"WhatsApp integrado"'::jsonb
)
where highlights @> '["WhatsApp integrado"]'::jsonb;
