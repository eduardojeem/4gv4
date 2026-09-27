-- Full subscription lifecycle automation
-- Covers: paid period expiry + grace period suspension after non-payment

-- 1. Expire active paid subscriptions whose period ended without a new payment
create or replace function public.expire_paid_periods()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.subscriptions
  set
    status = 'past_due',
    payment_status = 'unpaid',
    updated_at = now()
  where
    status = 'active'
    and current_period_ends_at is not null
    and current_period_ends_at < now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- 2. Suspend accounts that have been past_due for more than 7 days (grace period)
create or replace function public.suspend_overdue_accounts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.subscriptions
  set
    status = 'suspended',
    updated_at = now()
  where
    status = 'past_due'
    and updated_at < now() - interval '7 days';

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- 3. Master function that runs all expiry checks in order
create or replace function public.run_subscription_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  trials_expired integer;
  periods_expired integer;
  accounts_suspended integer;
begin
  select public.expire_trials() into trials_expired;
  select public.expire_paid_periods() into periods_expired;
  select public.suspend_overdue_accounts() into accounts_suspended;

  return jsonb_build_object(
    'trials_expired', trials_expired,
    'periods_expired', periods_expired,
    'accounts_suspended', accounts_suspended,
    'ran_at', now()
  );
end;
$$;

-- 4. Grant execute to service_role
grant execute on function public.expire_paid_periods() to service_role;
grant execute on function public.suspend_overdue_accounts() to service_role;
grant execute on function public.run_subscription_lifecycle() to service_role;

-- 5. Update cron: replace the old expire-trials job with the master lifecycle job
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Remove old individual job
    perform cron.unschedule('expire-trials')
    where exists (select 1 from cron.job where jobname = 'expire-trials');

    -- Remove if already scheduled
    perform cron.unschedule('subscription-lifecycle')
    where exists (select 1 from cron.job where jobname = 'subscription-lifecycle');

    -- Schedule master job every hour
    perform cron.schedule(
      'subscription-lifecycle',
      '0 * * * *',
      'select public.run_subscription_lifecycle()'
    );
  end if;
end;
$$;
