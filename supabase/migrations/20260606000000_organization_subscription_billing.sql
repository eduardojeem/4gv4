-- Organization-facing subscriptions and billing support.
-- Reuses the existing plans/subscriptions tables instead of creating a duplicate subscription source.

do $$ begin
  alter type public.subscription_status add value if not exists 'suspended';
  alter type public.subscription_status add value if not exists 'cancelled';
  alter type public.subscription_status add value if not exists 'expired';
exception
  when undefined_object then null;
end $$;

alter table if exists public.plans
  drop column if exists slug,
  drop column if exists price_monthly,
  drop column if exists currency,
  drop column if exists features,
  drop column if exists updated_at;

create or replace function public.plan_limit_int(plan_limits jsonb, limit_key text, fallback integer)
returns integer
language sql
immutable
as $$
  select case
    when plan_limits ? limit_key then
      case
        when jsonb_typeof(plan_limits -> limit_key) = 'number' then (plan_limits ->> limit_key)::integer
        when jsonb_typeof(plan_limits -> limit_key) = 'string'
          and lower(plan_limits ->> limit_key) not like 'ilimit%'
          and regexp_replace(plan_limits ->> limit_key, '[^0-9]', '', 'g') <> ''
        then regexp_replace(plan_limits ->> limit_key, '[^0-9]', '', 'g')::integer
        else null
      end
    else fallback
  end;
$$;

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
    'categories', public.plan_limit_int(source_plan.limits, 'categories', null)
  );

  technical_modules := case canonical_code
    when 'FREE' then array['inventory','pos','crm']
    when 'BASIC' then array['inventory','pos','crm','ecommerce']
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

create or replace function public.sync_technical_plan_from_subscription_plan_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_technical_plan_from_subscription_plan(new.tier);
  return new;
end;
$$;

drop trigger if exists sync_subscription_plans_to_plans on public.subscription_plans;
create trigger sync_subscription_plans_to_plans
after insert or update of tier, name, limits, is_active on public.subscription_plans
for each row execute function public.sync_technical_plan_from_subscription_plan_trigger();

do $$
declare
  plan_row record;
begin
  for plan_row in select tier from public.subscription_plans loop
    perform public.sync_technical_plan_from_subscription_plan(plan_row.tier);
  end loop;
end $$;

alter table if exists public.subscriptions
  add column if not exists started_at timestamptz,
  add column if not exists payment_status text,
  add column if not exists last_payment_method text,
  add column if not exists external_reference text;

do $$
declare
  default_org_id uuid;
begin
  select id into default_org_id from public.organizations where slug = 'default' limit 1;

  if to_regclass('public.cash_registers') is not null then
    alter table public.cash_registers
      add column if not exists organization_id uuid references public.organizations(id) on delete restrict;
    create index if not exists idx_cash_registers_organization_id on public.cash_registers(organization_id);

    if default_org_id is not null then
      update public.cash_registers
      set organization_id = default_org_id
      where organization_id is null;
    end if;
  end if;
end $$;

update public.subscriptions
set
  started_at = coalesce(started_at, created_at),
  payment_status = coalesce(payment_status, case when status = 'active' then 'paid' else 'manual' end),
  provider = coalesce(provider, 'manual')
where started_at is null or payment_status is null or provider is null;

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_id text references public.plans(code) on delete set null,
  amount numeric not null default 0,
  currency text not null default 'PYG',
  status text not null default 'pending' check (status in ('paid', 'pending', 'failed', 'refunded')),
  payment_method text,
  provider text not null default 'manual',
  provider_payment_id text,
  external_reference text,
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  business_name text,
  ruc text,
  billing_email text,
  fiscal_address text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscription_payments_org_created
  on public.subscription_payments(organization_id, created_at desc);

alter table public.subscription_payments enable row level security;
alter table public.billing_profiles enable row level security;

drop policy if exists "org admins can read subscriptions" on public.subscriptions;
create policy "org admins can read subscriptions" on public.subscriptions
for select using (public.get_org_role(organization_id) in ('owner', 'admin'));

drop policy if exists "org admins can read subscription payments" on public.subscription_payments;
create policy "org admins can read subscription payments" on public.subscription_payments
for select using (public.get_org_role(organization_id) in ('owner', 'admin'));

drop policy if exists "org admins can read billing profiles" on public.billing_profiles;
create policy "org admins can read billing profiles" on public.billing_profiles
for select using (public.get_org_role(organization_id) in ('owner', 'admin'));

drop policy if exists "org admins can update billing profiles" on public.billing_profiles;
create policy "org admins can update billing profiles" on public.billing_profiles
for all using (public.get_org_role(organization_id) in ('owner', 'admin'))
with check (public.get_org_role(organization_id) in ('owner', 'admin'));
