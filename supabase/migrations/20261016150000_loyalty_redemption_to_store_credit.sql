-- Canje de puntos por saldo a favor.
--
-- Hasta acá los puntos solo se podían usar en sorteos. El canje que espera el
-- cliente en casi todos los rubros es un descuento en la próxima compra: los
-- puntos se convierten en saldo a favor (customer_store_credits), que el POS
-- ya acepta como forma de pago. No hace falta tocar las funciones de venta.
--
-- Cada tienda define cuánto vale un punto al canjear y desde cuántos puntos se
-- puede canjear. Sin valor configurado, el canje está apagado.

alter table public.loyalty_settings
  add column if not exists redemption_value numeric(14,2),
  add column if not exists min_redemption_points integer;

alter table public.loyalty_settings drop constraint if exists loyalty_settings_redemption_value_positive;
alter table public.loyalty_settings add constraint loyalty_settings_redemption_value_positive
  check (redemption_value is null or redemption_value > 0);
alter table public.loyalty_settings drop constraint if exists loyalty_settings_min_redemption_positive;
alter table public.loyalty_settings add constraint loyalty_settings_min_redemption_positive
  check (min_redemption_points is null or min_redemption_points > 0);

alter table public.loyalty_ledger drop constraint if exists loyalty_ledger_source_valid;
alter table public.loyalty_ledger add constraint loyalty_ledger_source_valid check (
  source = any (array['purchase', 'promotion', 'raffle_entry', 'raffle_refund', 'adjustment', 'expiration', 'reversal', 'redemption'])
);

alter table public.customer_store_credits drop constraint if exists customer_store_credits_source_type_check;
alter table public.customer_store_credits add constraint customer_store_credits_source_type_check check (
  source_type = any (array['after_sales', 'sale', 'repair', 'order', 'order_refund', 'manual', 'loyalty'])
);

create or replace function public.redeem_loyalty_points_to_store_credit(
  p_organization_id uuid,
  p_customer_id uuid,
  p_points integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  settings public.loyalty_settings;
  existing public.loyalty_ledger;
  ledger_row public.loyalty_ledger;
  current_balance integer := 0;
  credit_amount numeric(14,2);
  credit_id uuid;
begin
  if p_organization_id is null or p_customer_id is null or p_idempotency_key is null then
    raise exception 'Faltan datos para canjear los puntos.' using errcode = 'invalid_parameter_value';
  end if;

  -- Quien cobra en el POS o atiende clientes.
  if not (
    public.has_org_permission(p_organization_id, 'pos.sales.create')
    or public.has_org_permission(p_organization_id, 'crm.customers.manage')
  ) then
    raise exception 'No tenés permiso para canjear puntos en esta organización.' using errcode = 'insufficient_privilege';
  end if;

  -- Reintento del mismo canje: se devuelve lo que ya se hizo.
  select * into existing
  from public.loyalty_ledger
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then
    select id, amount into credit_id, credit_amount
    from public.customer_store_credits
    where organization_id = p_organization_id and source_type = 'loyalty' and source_id = existing.id;
    return jsonb_build_object('points', -existing.points, 'amount', credit_amount, 'store_credit_id', credit_id, 'balance', existing.balance_after, 'replayed', true);
  end if;

  select * into settings from public.loyalty_settings where organization_id = p_organization_id;
  if not found or not settings.enabled or settings.redemption_value is null then
    raise exception 'REDEMPTION_DISABLED' using errcode = 'check_violation';
  end if;

  if coalesce(p_points, 0) <= 0 then
    raise exception 'INVALID_POINTS' using errcode = 'invalid_parameter_value';
  end if;
  if settings.min_redemption_points is not null and p_points < settings.min_redemption_points then
    raise exception 'BELOW_MIN_REDEMPTION' using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.customers c where c.id = p_customer_id and c.organization_id = p_organization_id) then
    raise exception 'El cliente no pertenece a la organización indicada.' using errcode = 'invalid_parameter_value';
  end if;

  select coalesce(balance, 0) into current_balance
  from public.loyalty_accounts
  where customer_id = p_customer_id
  for update;
  if coalesce(current_balance, 0) < p_points then
    raise exception 'INSUFFICIENT_POINTS' using errcode = 'check_violation';
  end if;

  credit_amount := round(p_points * settings.redemption_value, 2);
  if credit_amount <= 0 then
    raise exception 'INVALID_POINTS' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.loyalty_ledger (organization_id, customer_id, points, balance_after, source, description, idempotency_key, created_by)
  values (
    p_organization_id, p_customer_id, -p_points, 0, 'redemption',
    format('Canje: %s puntos por saldo a favor', p_points),
    p_idempotency_key, auth.uid()
  )
  returning * into ledger_row;

  insert into public.customer_store_credits (organization_id, customer_id, amount, reason, source_type, source_id, created_by)
  values (p_organization_id, p_customer_id, credit_amount, format('Canje de %s puntos', p_points), 'loyalty', ledger_row.id, auth.uid())
  returning id into credit_id;

  return jsonb_build_object('points', p_points, 'amount', credit_amount, 'store_credit_id', credit_id, 'balance', ledger_row.balance_after, 'replayed', false);
end;
$function$;

revoke all on function public.redeem_loyalty_points_to_store_credit(uuid, uuid, integer, text) from public, anon;
grant execute on function public.redeem_loyalty_points_to_store_credit(uuid, uuid, integer, text) to authenticated, service_role;
