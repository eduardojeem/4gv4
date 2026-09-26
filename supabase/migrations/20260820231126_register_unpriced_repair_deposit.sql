create or replace function public.register_unpriced_repair_deposit(
  p_repair_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_payment_method text,
  p_payment_amount numeric,
  p_payment_reference text,
  p_payment_note text,
  p_idempotency_key text,
  p_cash_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_repair public.repairs%rowtype;
  existing_payment public.repair_payments%rowtype;
  created_payment_id uuid;
  resolved_paid numeric(12, 2);
  operation_time timestamptz := now();
begin
  if p_actor_id is null or not exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager', 'cashier', 'technician', 'seller')
  ) then
    raise exception 'REPAIR_FINANCIAL_PERMISSION_DENIED';
  end if;

  if p_idempotency_key is null
     or char_length(trim(p_idempotency_key)) < 8
     or char_length(trim(p_idempotency_key)) > 120 then
    raise exception 'REPAIR_IDEMPOTENCY_KEY_REQUIRED';
  end if;

  if p_payment_method not in ('cash', 'card', 'transfer')
     or coalesce(p_payment_amount, 0) <= 0 then
    raise exception 'REPAIR_PAYMENT_AMOUNT_INVALID';
  end if;

  if p_payment_method in ('card', 'transfer')
     and nullif(trim(coalesce(p_payment_reference, '')), '') is null then
    raise exception 'REPAIR_PAYMENT_REFERENCE_REQUIRED';
  end if;

  select repair.*
  into target_repair
  from public.repairs repair
  where repair.id = p_repair_id
    and repair.organization_id = p_organization_id
    and repair.branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'REPAIR_NOT_FOUND';
  end if;

  select payment.*
  into existing_payment
  from public.repair_payments payment
  where payment.organization_id = p_organization_id
    and payment.idempotency_key = trim(p_idempotency_key)
  limit 1;

  if existing_payment.id is not null then
    if existing_payment.repair_id <> p_repair_id
       or existing_payment.amount is distinct from p_payment_amount
       or existing_payment.payment_method is distinct from p_payment_method
       or existing_payment.reference is distinct from nullif(trim(coalesce(p_payment_reference, '')), '') then
      raise exception 'REPAIR_IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'repair_id', target_repair.id,
      'payment_id', existing_payment.id,
      'paid_amount', greatest(0, coalesce(target_repair.paid_amount, 0)),
      'idempotent', true
    );
  end if;

  if target_repair.status = 'cancelado' then
    raise exception 'REPAIR_PAYMENT_INVALID_STATE';
  end if;

  if target_repair.final_cost is not null
     or coalesce(target_repair.estimated_cost, 0) > 0
     or coalesce(target_repair.labor_cost, 0) > 0
     or exists (
       select 1
       from public.repair_parts part
       where part.repair_id = target_repair.id
         and coalesce(part.unit_price, part.unit_cost, 0) * greatest(part.quantity, 0) > 0
     ) then
    raise exception 'REPAIR_PRICE_ALREADY_DEFINED';
  end if;

  if p_cash_session_id is null or not exists (
    select 1
    from public.cash_closures closure
    where closure.id = p_cash_session_id
      and closure.organization_id = p_organization_id
      and closure.branch_id = p_branch_id
      and closure.date is null
  ) then
    raise exception 'REPAIR_CASH_REGISTER_NOT_OPEN';
  end if;

  insert into public.repair_payments (
    repair_id, organization_id, branch_id, amount, payment_method,
    idempotency_key, source, reference, notes, cash_session_id,
    created_by, created_at
  ) values (
    target_repair.id, p_organization_id, p_branch_id, p_payment_amount,
    p_payment_method, trim(p_idempotency_key), 'repairs',
    nullif(trim(coalesce(p_payment_reference, '')), ''),
    nullif(trim(coalesce(p_payment_note, '')), ''),
    p_cash_session_id, p_actor_id, operation_time
  ) returning id into created_payment_id;

  insert into public.cash_movements (
    session_id, type, amount, reason, payment_method, created_by,
    created_at, organization_id, branch_id
  ) values (
    p_cash_session_id, 'cash_in', p_payment_amount,
    'Anticipo reparación ' || coalesce(target_repair.ticket_number, target_repair.id::text),
    p_payment_method, p_actor_id, operation_time, p_organization_id, p_branch_id
  );

  resolved_paid := greatest(0, coalesce(target_repair.paid_amount, 0)) + p_payment_amount;

  update public.repairs
  set paid_amount = resolved_paid,
      payment_status = 'parcial',
      updated_at = operation_time
  where id = target_repair.id;

  return jsonb_build_object(
    'repair_id', target_repair.id,
    'payment_id', created_payment_id,
    'paid_amount', resolved_paid,
    'idempotent', false
  );
end;
$$;

revoke all on function public.register_unpriced_repair_deposit(
  uuid, uuid, uuid, uuid, text, numeric, text, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.register_unpriced_repair_deposit(
  uuid, uuid, uuid, uuid, text, numeric, text, text, text, uuid
) to service_role;
