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
    when 'FREE' then array['inventory','pos','crm','repairs']
    when 'BASIC' then array['inventory','pos','crm','ecommerce','repairs']
    when 'PRO' then array['inventory','pos','repairs','crm','ecommerce','analytics','promotions','security']
    else array['inventory','pos','repairs','crm','ecommerce','delivery','analytics','promotions','security']
  end;

  for feature_row in select value from jsonb_array_elements(coalesce(source_plan.features, '[]'::jsonb))
  loop
    feature_module := case lower(feature_row->>'label')
      when 'promociones y descuentos' then 'promotions'
      when 'seguridad y auditoría' then 'security'
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

  insert into public.plans (code, name, limits, modules, is_active)
  values (canonical_code, source_plan.name, technical_limits, technical_modules, source_plan.is_active)
  on conflict (code) do update set
    name = excluded.name,
    limits = excluded.limits,
    modules = excluded.modules,
    is_active = excluded.is_active;
end;
$$;

drop trigger if exists sync_subscription_plans_to_plans on public.subscription_plans;
create trigger sync_subscription_plans_to_plans
after insert or update of tier, name, limits, features, is_active on public.subscription_plans
for each row execute function public.sync_technical_plan_from_subscription_plan_trigger();

update public.subscription_plans
set features = coalesce(features, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'label', 'Promociones y descuentos',
  'value', lower(tier) in ('pro', 'profesional', 'enterprise')
))
where not exists (
  select 1
  from jsonb_array_elements(coalesce(features, '[]'::jsonb)) feature
  where lower(feature->>'label') = 'promociones y descuentos'
);

update public.subscription_plans
set features = coalesce(features, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'label', 'Seguridad y auditoría',
  'value', lower(tier) in ('pro', 'profesional', 'enterprise')
))
where not exists (
  select 1
  from jsonb_array_elements(coalesce(features, '[]'::jsonb)) feature
  where lower(feature->>'label') in ('seguridad y auditoría', 'seguridad y auditoria')
);

do $$
declare plan_row record;
begin
  for plan_row in select tier from public.subscription_plans loop
    perform public.sync_technical_plan_from_subscription_plan(plan_row.tier);
  end loop;
end $$;
