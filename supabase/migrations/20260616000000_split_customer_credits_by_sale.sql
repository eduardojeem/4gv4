begin;

alter table public.customer_credits
  add column if not exists credit_code text,
  add column if not exists credit_type text not null default 'product_financing',
  add column if not exists origin_type text not null default 'sale',
  add column if not exists label text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.customer_credits
  drop constraint if exists customer_credits_credit_type_check;

alter table public.customer_credits
  add constraint customer_credits_credit_type_check
  check (
    credit_type = any (
      array[
        'product_financing',
        'service_financing',
        'repair_financing',
        'cash_loan',
        'carry_over_balance',
        'refinancing',
        'manual'
      ]
    )
  );

alter table public.customer_credits
  drop constraint if exists customer_credits_origin_type_check;

alter table public.customer_credits
  add constraint customer_credits_origin_type_check
  check (
    origin_type = any (
      array[
        'sale',
        'repair',
        'manual',
        'migration',
        'refinancing'
      ]
    )
  );

update public.customer_credits cc
set
  credit_code = coalesce(
    cc.credit_code,
    'CR-' || upper(substr(replace(cc.id::text, '-', ''), 1, 8))
  ),
  credit_type = case
    when cc.sale_id is not null then 'product_financing'
    else 'manual'
  end,
  origin_type = case
    when cc.sale_id is not null then 'sale'
    else 'manual'
  end,
  label = coalesce(
    nullif(cc.label, ''),
    case
      when s.code is not null then 'Venta ' || s.code
      else 'Credito manual'
    end
  )
from public.sales s
where cc.sale_id = s.id;

update public.customer_credits
set
  credit_code = coalesce(
    credit_code,
    'CR-' || upper(substr(replace(id::text, '-', ''), 1, 8))
  ),
  credit_type = coalesce(credit_type, 'manual'),
  origin_type = coalesce(origin_type, 'manual'),
  label = coalesce(nullif(label, ''), 'Credito manual')
where true;

create unique index if not exists idx_customer_credits_org_sale_unique
  on public.customer_credits (organization_id, sale_id)
  where sale_id is not null;

create unique index if not exists idx_customer_credits_org_code_unique
  on public.customer_credits (organization_id, credit_code)
  where credit_code is not null;

create index if not exists idx_customer_credits_org_customer_status
  on public.customer_credits (organization_id, customer_id, status);

create index if not exists idx_customer_credits_org_type
  on public.customer_credits (organization_id, credit_type, origin_type);

drop view if exists public.credit_details;

create view public.credit_details
with (security_invoker = true) as
select
  cc.id,
  cc.customer_id,
  cc.sale_id,
  cc.principal,
  cc.interest_rate,
  cc.term_months,
  cc.start_date,
  cc.status,
  cc.created_at,
  cc.updated_at,
  c.name as customer_name,
  cc.organization_id,
  c.customer_code,
  cc.credit_code,
  cc.credit_type,
  cc.origin_type,
  cc.label,
  s.code as sale_code
from public.customer_credits cc
join public.customers c on c.id = cc.customer_id
left join public.sales s on s.id = cc.sale_id;

grant select on public.credit_details to authenticated;

commit;
