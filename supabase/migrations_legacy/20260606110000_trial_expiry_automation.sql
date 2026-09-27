-- Trial expiry automation
-- Transitions subscriptions from 'trialing' to 'past_due' when trial_ends_at has passed.

-- 1. Function that expires trials and returns the number of rows affected
create or replace function public.expire_trials()
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
    updated_at = now()
  where
    status = 'trialing'
    and trial_ends_at is not null
    and trial_ends_at < now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- 2. Add trial_days column to subscription_plans so duration is configurable per plan
alter table public.subscription_plans
  add column if not exists trial_days integer not null default 14;

-- Set existing plans to 14 days (current default)
update public.subscription_plans set trial_days = 14 where trial_days = 14;

-- 3. Schedule pg_cron job to run every hour (requires pg_cron extension)
-- Supabase projects have pg_cron available in the cron schema.
-- If pg_cron is not enabled, enable it from the Supabase dashboard → Extensions.
do $$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    -- Remove existing job if present
    perform cron.unschedule('expire-trials')
    where exists (select 1 from cron.job where jobname = 'expire-trials');

    -- Schedule: run every hour
    perform cron.schedule(
      'expire-trials',
      '0 * * * *',
      'select public.expire_trials()'
    );
  end if;
end;
$$;

-- Grant execute to service_role so the cron job can call it
grant execute on function public.expire_trials() to service_role;
