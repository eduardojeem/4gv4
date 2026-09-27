-- Al expirar (trial o período pago) y tras 7 días de gracia sin pago, en vez de
-- SUSPENDER la cuenta (bloqueo total), se baja a FREE como cortesía:
--   - Conservan POS/inventario básico dentro de los límites FREE.
--   - Lo existente NO se borra; solo no pueden crear por encima del límite FREE.
--   - Se guarda el plan anterior (previous_plan) para ofrecer reactivación.

-- Recordar el plan que tenían antes de la baja por impago.
alter table public.subscriptions
  add column if not exists previous_plan text;

-- Reemplaza la suspensión por un downgrade a FREE.
create or replace function public.downgrade_overdue_accounts()
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
    previous_plan = case when coalesce(plan, 'FREE') <> 'FREE' then plan else previous_plan end,
    plan = 'FREE',
    status = 'active',           -- FREE es un estado usable, no bloqueado
    payment_status = 'unpaid',   -- marca que fue una baja por impago (para banner/reactivación)
    updated_at = now()
  where
    status = 'past_due'
    and updated_at < now() - interval '7 days';

  get diagnostics affected = row_count;

  -- Sincronizar organizations.plan con la suscripción.
  update public.organizations o
  set plan = 'FREE'
  from public.subscriptions s
  where s.organization_id = o.id
    and s.plan = 'FREE'
    and o.plan is distinct from 'FREE';

  return affected;
end;
$$;

-- Master function: usa downgrade en vez de suspend.
create or replace function public.run_subscription_lifecycle()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  trials_expired integer;
  periods_expired integer;
  accounts_downgraded integer;
begin
  select public.expire_trials() into trials_expired;
  select public.expire_paid_periods() into periods_expired;
  select public.downgrade_overdue_accounts() into accounts_downgraded;

  return jsonb_build_object(
    'trials_expired', trials_expired,
    'periods_expired', periods_expired,
    'accounts_downgraded', accounts_downgraded,
    'ran_at', now()
  );
end;
$$;

grant execute on function public.downgrade_overdue_accounts() to service_role;

-- La función vieja de suspensión ya no se usa.
drop function if exists public.suspend_overdue_accounts();
