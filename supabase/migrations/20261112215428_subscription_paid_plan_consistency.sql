-- Preserve stable plan identities. FREE is a legacy code, not a pricing rule.
-- User policy: expiry suspends operations; billing reads and renewal remain available.
-- Definitions only: existing customers are not rewritten when this migration is applied.
begin;

create or replace function public.expire_paid_periods()
returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  update public.subscriptions s
     set status = 'suspended', payment_status = 'unpaid',
         cancel_at_period_end = false, updated_at = now()
   where s.status::text in ('active', 'past_due', 'expired', 'unpaid')
     and s.current_period_ends_at is not null
     and s.current_period_ends_at <= now()
     and exists (select 1 from public.subscription_plans p where upper(p.tier) = upper(s.plan) and p.price > 0);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Keep the existing cron entry point; it no longer changes plans or reactivates debtors.
create or replace function public.downgrade_overdue_accounts()
returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  update public.subscriptions
     set status = 'suspended', payment_status = 'unpaid',
         cancel_at_period_end = false, updated_at = now()
   where status::text in ('past_due', 'expired', 'unpaid');
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.expire_trials()
returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  update public.subscriptions
     set status = 'suspended', payment_status = 'unpaid',
         cancel_at_period_end = false, updated_at = now()
   where status::text in ('trialing', 'trial')
     and trial_ends_at is not null and trial_ends_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- A free activation requires a real, active zero-price catalog entry.
create or replace function public.apply_free_subscription_plan(p_organization_id uuid, p_plan text default 'FREE')
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.subscription_plans c join public.plans t on t.code = upper(c.tier)
    where upper(c.tier) = p_plan and c.price = 0 and c.is_active and t.is_active
  ) then
    raise exception 'El plan no tiene un precio cero verificado; requiere pago confirmado.';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then return false; end if;
  insert into public.subscriptions (
    organization_id, plan, status, payment_status, cancel_at_period_end,
    current_period_starts_at, current_period_ends_at, updated_at
  ) values (p_organization_id, p_plan, 'active', 'manual', false, null, null, now())
  on conflict (organization_id) do update
    set plan = excluded.plan, status = 'active', payment_status = 'manual',
        cancel_at_period_end = false, current_period_starts_at = null,
        current_period_ends_at = null, updated_at = now();
  update public.organizations set plan = p_plan, updated_at = now() where id = p_organization_id;
  return true;
end;
$$;

revoke all on function public.expire_paid_periods() from public, anon, authenticated;
revoke all on function public.downgrade_overdue_accounts() from public, anon, authenticated;
revoke all on function public.expire_trials() from public, anon, authenticated;
revoke all on function public.apply_free_subscription_plan(uuid,text) from public, anon, authenticated;
grant execute on function public.expire_paid_periods() to service_role;
grant execute on function public.downgrade_overdue_accounts() to service_role;
grant execute on function public.expire_trials() to service_role;
grant execute on function public.apply_free_subscription_plan(uuid,text) to service_role;
commit;
