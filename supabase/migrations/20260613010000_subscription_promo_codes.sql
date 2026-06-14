create table if not exists public.subscription_promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  benefit_type text not null check (benefit_type in ('discount_percent', 'discount_fixed', 'activate_plan', 'extend_trial', 'extend_period')),
  discount_percent numeric(5,2) check (discount_percent > 0 and discount_percent <= 100),
  discount_amount numeric(14,2) check (discount_amount > 0),
  target_plan text,
  duration_days integer check (duration_days > 0),
  max_redemptions integer check (max_redemptions > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_promo_codes_dates_check check (expires_at is null or starts_at is null or expires_at > starts_at),
  constraint subscription_promo_codes_benefit_check check (
    (benefit_type = 'discount_percent' and discount_percent is not null)
    or (benefit_type = 'discount_fixed' and discount_amount is not null)
    or (benefit_type = 'activate_plan' and target_plan is not null and duration_days is not null)
    or (benefit_type in ('extend_trial', 'extend_period') and duration_days is not null)
  )
);

create table if not exists public.subscription_promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.subscription_promo_codes(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  redeemed_by uuid references auth.users(id) on delete set null,
  benefit_snapshot jsonb not null default '{}'::jsonb,
  previous_subscription jsonb,
  resulting_subscription jsonb,
  redeemed_at timestamptz not null default now(),
  unique (promo_code_id, organization_id)
);

create index if not exists subscription_promo_codes_active_idx
  on public.subscription_promo_codes (is_active, expires_at);
create index if not exists subscription_promo_redemptions_promo_idx
  on public.subscription_promo_redemptions (promo_code_id, redeemed_at desc);
create index if not exists subscription_promo_redemptions_org_idx
  on public.subscription_promo_redemptions (organization_id, redeemed_at desc);

alter table public.subscription_promo_codes enable row level security;
alter table public.subscription_promo_redemptions enable row level security;

revoke all on public.subscription_promo_codes from anon, authenticated;
revoke all on public.subscription_promo_redemptions from anon, authenticated;
