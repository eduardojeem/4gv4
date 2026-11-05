-- Venta POS a crédito con cuotas por monto.
--
-- Hasta ahora el POS solo armaba cuotas iguales a partir de un recargo %.
-- Esta versión acepta, además, la lista de montos de cada cuota
-- (p_credit.installment_amounts): "10 cuotas de Gs. 150.000" o montos
-- cargados a mano. El recargo se deriva de la suma de las cuotas.
--
-- No reescribe la venta: llama a process_pos_sale_atomic_v5 con recargo 0 y
-- sin cobro de primera cuota, y dentro de la MISMA transacción reemplaza los
-- montos de las cuotas recién creadas (las fechas son las del calendario
-- normal). Si algo falla, no queda nada: ni venta ni crédito.
--
-- Sin installment_amounts se comporta como la v5; solo agrega al crédito la
-- marca policy_override cuando un dueño o administrador vendió fuera de la
-- política de crédito de la organización.

begin;

create or replace function public.process_pos_sale_atomic_v6(
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_session_id uuid,
  p_idempotency_key text,
  p_code text,
  p_customer_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_price_mode text default 'retail',
  p_order_discount_rate numeric default 0,
  p_notes text default null,
  p_tax_rate numeric default 0,
  p_prices_include_tax boolean default true,
  p_credit jsonb default null,
  p_repair_ids jsonb default '[]'::jsonb,
  p_mark_repairs_delivered boolean default false,
  p_delivery_outcome text default null,
  p_store_credit_amount numeric default 0
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  amounts jsonb := case when p_credit is null then null else p_credit->'installment_amounts' end;
  digits integer;
  unit numeric;
  plan_count integer;
  scheduled_total numeric := 0;
  principal_total numeric;
  interest_total numeric;
  interest_assigned numeric := 0;
  derived_rate numeric;
  installment_amount numeric;
  installment_interest numeric;
  base_credit jsonb;
  result jsonb;
  created_credit_id uuid;
  created_sale_id uuid;
  credit_row public.customer_credits%rowtype;
  customer_limit numeric;
  other_debt numeric;
  entry record;
begin
  if amounts is null or amounts = 'null'::jsonb then
    result := public.process_pos_sale_atomic_v5(
      p_organization_id, p_branch_id, p_actor_id, p_session_id, p_idempotency_key, p_code, p_customer_id,
      p_items, p_payments, p_price_mode, p_order_discount_rate, p_notes, p_tax_rate, p_prices_include_tax,
      p_credit, p_repair_ids, p_mark_repairs_delivered, p_delivery_outcome, p_store_credit_amount);
    -- Un dueño o administrador vendió fuera de la política: queda registrado.
    if not coalesce((result->>'idempotent')::boolean, false)
      and coalesce((p_credit->>'policy_override')::boolean, false)
      and nullif(result->>'credit_id', '') is not null then
      update public.customer_credits
      set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('policy_override', true, 'policy_override_by', p_actor_id)
      where id = (result->>'credit_id')::uuid and organization_id = p_organization_id;
    end if;
    return result;
  end if;

  digits := least(2, greatest(0, coalesce((p_credit->>'fraction_digits')::integer, 0)));
  unit := power(10::numeric, -digits);

  if jsonb_typeof(amounts) <> 'array' then raise exception 'INVALID_CREDIT_SCHEDULE'; end if;
  plan_count := jsonb_array_length(amounts);
  if plan_count not between 1 and 60
    or plan_count is distinct from (p_credit->>'installment_count')::integer then
    raise exception 'INVALID_CREDIT_SCHEDULE';
  end if;

  for entry in select value, ordinality from jsonb_array_elements(amounts) with ordinality loop
    if jsonb_typeof(entry.value) <> 'number' then raise exception 'INVALID_CREDIT_SCHEDULE'; end if;
    installment_amount := (entry.value #>> '{}')::numeric;
    if installment_amount < unit or installment_amount <> round(installment_amount, digits)
      or installment_amount > 1000000000 then
      raise exception 'INVALID_CREDIT_SCHEDULE';
    end if;
    scheduled_total := scheduled_total + installment_amount;
  end loop;

  -- La venta y el crédito se crean con el calendario normal, sin recargo y sin
  -- cobrar la primera cuota: los montos y el cobro se aplican después.
  base_credit := (p_credit - 'installment_amounts' - 'first_payment')
    || jsonb_build_object('interest_rate', 0);

  result := public.process_pos_sale_atomic_v5(
    p_organization_id, p_branch_id, p_actor_id, p_session_id, p_idempotency_key, p_code, p_customer_id,
    p_items, p_payments, p_price_mode, p_order_discount_rate, p_notes, p_tax_rate, p_prices_include_tax,
    base_credit, p_repair_ids, p_mark_repairs_delivered, p_delivery_outcome, p_store_credit_amount);

  -- Reintento de una venta ya registrada: el crédito ya tiene sus montos.
  if coalesce((result->>'idempotent')::boolean, false) then return result; end if;

  created_credit_id := nullif(result->>'credit_id', '')::uuid;
  created_sale_id := (result->>'sale_id')::uuid;
  if created_credit_id is null then raise exception 'INVALID_CREDIT_SCHEDULE'; end if;

  select * into credit_row from public.customer_credits
  where id = created_credit_id and organization_id = p_organization_id
  for update;
  if not found or credit_row.term_months <> plan_count then raise exception 'INVALID_CREDIT_SCHEDULE'; end if;

  -- Con recargo 0, el total del crédito es el capital financiado.
  principal_total := credit_row.principal;
  if scheduled_total < principal_total then
    raise exception 'CREDIT_SCHEDULE_BELOW_PRINCIPAL|%|%', principal_total, scheduled_total;
  end if;
  interest_total := scheduled_total - principal_total;
  derived_rate := round(interest_total * 100 / principal_total, 4);
  if derived_rate > 100 then
    raise exception 'CREDIT_SCHEDULE_RATE_TOO_HIGH|%', derived_rate;
  end if;

  -- Mensaje claro con el disponible; el trigger diferido lo controla igual.
  select coalesce(credit_limit, 0) into customer_limit
  from public.customers where id = credit_row.customer_id and organization_id = p_organization_id
  for update;
  other_debt := public.customer_credit_outstanding(p_organization_id, credit_row.customer_id) - principal_total;
  if customer_limit - other_debt < scheduled_total then
    raise exception 'CREDIT_LIMIT_EXCEEDED|%', greatest(0, customer_limit - other_debt);
  end if;

  -- El recargo se reparte en proporción al monto de cada cuota; la última
  -- se queda con el sobrante del redondeo.
  for entry in select value, ordinality from jsonb_array_elements(amounts) with ordinality loop
    installment_amount := (entry.value #>> '{}')::numeric;
    if entry.ordinality < plan_count then
      installment_interest := trunc(installment_amount * interest_total / scheduled_total, digits);
    else
      installment_interest := interest_total - interest_assigned;
    end if;
    if installment_interest < 0 or installment_interest > installment_amount then
      raise exception 'INVALID_CREDIT_SCHEDULE';
    end if;
    interest_assigned := interest_assigned + installment_interest;

    update public.credit_installments
    set amount = installment_amount,
        principal_component = installment_amount - installment_interest,
        interest_component = installment_interest
    where credit_id = created_credit_id and installment_number = entry.ordinality;
    if not found then raise exception 'INVALID_CREDIT_SCHEDULE'; end if;
  end loop;

  update public.customer_credits
  set principal = scheduled_total,
      interest_rate = derived_rate,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'schedule_mode', coalesce(nullif(p_credit->>'schedule_mode', ''), 'custom'),
        'financed_principal', principal_total)
      || case when coalesce((p_credit->>'policy_override')::boolean, false)
        then jsonb_build_object('policy_override', true, 'policy_override_by', p_actor_id)
        else '{}'::jsonb end
  where id = created_credit_id;

  if p_credit->'first_payment' is not null and p_credit->'first_payment' <> 'null'::jsonb then
    perform public.collect_pos_first_installment(
      p_organization_id, p_branch_id, p_actor_id, p_session_id, created_credit_id, p_credit->'first_payment');
  end if;

  return result || jsonb_build_object(
    'credit_schedule', public.pos_credit_checkout_summary(p_organization_id, created_sale_id));
end;
$$;

revoke all on function public.process_pos_sale_atomic_v6(uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text, numeric, boolean, jsonb, jsonb, boolean, text, numeric) from public, anon, authenticated;
grant execute on function public.process_pos_sale_atomic_v6(uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text, numeric, boolean, jsonb, jsonb, boolean, text, numeric) to service_role;

commit;
