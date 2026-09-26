-- Consolidate the legacy installment-rate presets into the richer,
-- organization-scoped product_credit_defaults setting.
--
-- Existing product_credit_defaults plans always win. Legacy rates are only
-- appended when that installment count is still missing.

with legacy_rates as (
  select
    os.organization_id,
    legacy.key::integer as installment_count,
    legacy.value::numeric as rate
  from public.organization_settings os
  cross join lateral jsonb_each_text(
    case
      when jsonb_typeof(os.modules #> '{admin_settings,defaultInstallmentRates}') = 'object'
        then os.modules #> '{admin_settings,defaultInstallmentRates}'
      else '{}'::jsonb
    end
  ) as legacy(key, value)
  where legacy.key ~ '^[0-9]+$'
    and legacy.value ~ '^[0-9]+([.][0-9]+)?$'
    and legacy.key::integer between 1 and 60
    and legacy.value::numeric between 0 and 300
), missing_by_organization as (
  select
    ws.organization_id,
    jsonb_agg(
      jsonb_build_object('count', legacy.installment_count, 'rate', legacy.rate)
      order by legacy.installment_count
    ) as missing_plans
  from public.website_settings ws
  join legacy_rates legacy on legacy.organization_id = ws.organization_id
  where ws.key = 'product_credit_defaults'
    and not exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(ws.value->'plans') = 'array' then ws.value->'plans'
          else '[]'::jsonb
        end
      ) as existing_plan
      where case
        when existing_plan->>'count' ~ '^[0-9]+$'
          then (existing_plan->>'count')::integer
        else null
      end = legacy.installment_count
    )
  group by ws.organization_id
)
update public.website_settings ws
set
  value = jsonb_set(
    ws.value,
    '{plans}',
    case
      when jsonb_typeof(ws.value->'plans') = 'array' then ws.value->'plans'
      else '[]'::jsonb
    end || missing.missing_plans,
    true
  ),
  updated_at = now()
from missing_by_organization missing
where ws.organization_id = missing.organization_id
  and ws.key = 'product_credit_defaults';

-- Organizations that never initialized website settings still receive one
-- complete record built from their legacy rates.
with legacy_rates as (
  select
    os.organization_id,
    legacy.key::integer as installment_count,
    legacy.value::numeric as rate
  from public.organization_settings os
  cross join lateral jsonb_each_text(
    case
      when jsonb_typeof(os.modules #> '{admin_settings,defaultInstallmentRates}') = 'object'
        then os.modules #> '{admin_settings,defaultInstallmentRates}'
      else '{}'::jsonb
    end
  ) as legacy(key, value)
  where legacy.key ~ '^[0-9]+$'
    and legacy.value ~ '^[0-9]+([.][0-9]+)?$'
    and legacy.key::integer between 1 and 60
    and legacy.value::numeric between 0 and 300
), grouped_legacy as (
  select
    organization_id,
    jsonb_agg(
      jsonb_build_object('count', installment_count, 'rate', rate)
      order by installment_count
    ) as plans
  from legacy_rates
  group by organization_id
)
insert into public.website_settings (organization_id, key, value, updated_at)
select
  organization_id,
  'product_credit_defaults',
  jsonb_build_object(
    'enabled', true,
    'calculationBase', 'sale',
    'respectOffer', true,
    'costMarkupPercent', 0,
    'frequency', 'monthly',
    'downPaymentPercent', 0,
    'publicByDefault', true,
    'plans', plans
  ),
  now()
from grouped_legacy
ON CONFLICT (organization_id, key) DO NOTHING;
