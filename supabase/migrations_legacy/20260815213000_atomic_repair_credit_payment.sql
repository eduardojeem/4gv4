-- Make repair financing part of the same transaction as the immutable payment.
-- The existing 17-argument overload remains for database compatibility; all
-- application calls use this extended overload, including non-credit methods.

alter table public.customer_credits
  add column if not exists branch_id uuid references public.branches(id) on delete set null;

create index if not exists idx_customer_credits_org_branch
  on public.customer_credits (organization_id, branch_id);

create or replace function public.close_repair_and_register_payment(
  p_repair_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_deliver boolean default false,
  p_delivery_outcome text default null,
  p_delivery_note text default null,
  p_allow_outstanding_balance boolean default false,
  p_payment_method text default null,
  p_payment_amount numeric default null,
  p_payment_reference text default null,
  p_payment_note text default null,
  p_idempotency_key text default null,
  p_cash_session_id uuid default null,
  p_credit_id uuid default null,
  p_sale_id uuid default null,
  p_source text default 'repairs',
  p_credit_interest_rate numeric default null,
  p_credit_installment_count integer default null,
  p_credit_frequency text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_result jsonb;
  target_customer_id uuid;
  target_ticket_number text;
  existing_payment public.repair_payments%rowtype;
  existing_credit_rate numeric(8, 2);
  existing_credit_count integer;
  existing_credit_frequency text;
  customer_credit_limit numeric(12, 2);
  current_credit_balance numeric(12, 2);
  available_credit numeric(12, 2);
  credit_rate numeric(8, 2);
  credit_count integer;
  credit_frequency text;
  financed_total numeric(12, 2);
  installment_base numeric(12, 2);
  principal_base numeric(12, 2);
  installment_due timestamptz;
  installment_index integer;
  resolved_credit_id uuid;
begin
  if p_payment_method in ('card', 'transfer')
     and nullif(trim(coalesce(p_payment_reference, '')), '') is null then
    raise exception 'REPAIR_PAYMENT_REFERENCE_REQUIRED';
  end if;

  if p_payment_method <> 'credit' then
    operation_result := public.close_repair_and_register_payment(
      p_repair_id, p_organization_id, p_branch_id, p_actor_id, p_deliver,
      p_delivery_outcome, p_delivery_note, p_allow_outstanding_balance,
      p_payment_method, p_payment_amount, p_payment_reference, p_payment_note,
      p_idempotency_key, p_cash_session_id, p_credit_id, p_sale_id, p_source
    );
    return operation_result || jsonb_build_object('credit_id', null, 'credit_total', null);
  end if;

  if p_credit_id is not null
     or p_credit_interest_rate is null
     or p_credit_interest_rate < 0
     or p_credit_interest_rate > 1000
     or p_credit_installment_count is null
     or p_credit_installment_count < 1
     or p_credit_installment_count > 60
     or p_credit_frequency not in ('weekly', 'biweekly', 'monthly') then
    raise exception 'REPAIR_CREDIT_TERMS_INVALID';
  end if;

  credit_rate := round(p_credit_interest_rate, 2);
  credit_count := p_credit_installment_count;
  credit_frequency := p_credit_frequency;

  -- Serialize retries and concurrent payments for the same repair before any
  -- credit record can be created.
  select repair.customer_id, repair.ticket_number
  into target_customer_id, target_ticket_number
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
    select
      credit.principal,
      credit.interest_rate,
      credit.term_months,
      credit.metadata->>'frequency'
    into financed_total, existing_credit_rate, existing_credit_count, existing_credit_frequency
    from public.customer_credits credit
    where credit.id = existing_payment.credit_id
      and credit.organization_id = p_organization_id;

    if not found
       or existing_credit_rate is distinct from credit_rate
       or existing_credit_count is distinct from credit_count
       or existing_credit_frequency is distinct from credit_frequency then
      raise exception 'REPAIR_IDEMPOTENCY_CONFLICT';
    end if;

    operation_result := public.close_repair_and_register_payment(
      p_repair_id, p_organization_id, p_branch_id, p_actor_id, p_deliver,
      p_delivery_outcome, p_delivery_note, p_allow_outstanding_balance,
      p_payment_method, p_payment_amount, p_payment_reference, p_payment_note,
      p_idempotency_key, p_cash_session_id, existing_payment.credit_id,
      p_sale_id, p_source
    );
    return operation_result || jsonb_build_object(
      'credit_id', existing_payment.credit_id,
      'credit_total', financed_total
    );
  end if;

  if target_customer_id is null then
    raise exception 'REPAIR_CREDIT_CUSTOMER_REQUIRED';
  end if;

  -- The customer lock also serializes other financing flows that follow the
  -- same locking contract, preventing concurrent credit-limit oversubscription.
  select greatest(0, coalesce(customer.credit_limit, 0))
  into customer_credit_limit
  from public.customers customer
  where customer.id = target_customer_id
    and customer.organization_id = p_organization_id
  for update;

  if not found or customer_credit_limit <= 0 then
    raise exception 'REPAIR_CREDIT_LIMIT_DISABLED';
  end if;

  select coalesce(sum(greatest(
    0,
    coalesce(installment.amount, 0) - coalesce(installment.amount_paid, 0)
  )), 0)
  into current_credit_balance
  from public.customer_credits credit
  join public.credit_installments installment on installment.credit_id = credit.id
  where credit.organization_id = p_organization_id
    and credit.customer_id = target_customer_id
    and installment.status in ('pending', 'late');

  financed_total := round(p_payment_amount * (1 + credit_rate / 100), 2);
  available_credit := customer_credit_limit - current_credit_balance;

  if available_credit < financed_total then
    raise exception 'REPAIR_CREDIT_LIMIT_EXCEEDED|%', greatest(0, available_credit);
  end if;

  insert into public.customer_credits (
    customer_id, organization_id, branch_id, sale_id, principal, interest_rate,
    term_months, start_date, status, credit_code, credit_type, origin_type,
    label, metadata
  ) values (
    target_customer_id, p_organization_id, p_branch_id, null, financed_total,
    credit_rate, credit_count, now(), 'active',
    'CR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    'repair_financing', 'repair',
    'Reparación ' || coalesce(target_ticket_number, upper(substr(p_repair_id::text, 1, 8))),
    jsonb_build_object(
      'repair_id', p_repair_id,
      'idempotency_key', trim(p_idempotency_key),
      'frequency', credit_frequency
    )
  ) returning id into resolved_credit_id;

  installment_base := trunc((financed_total / credit_count) * 100) / 100;
  principal_base := trunc((p_payment_amount / credit_count) * 100) / 100;

  for installment_index in 1..credit_count loop
    installment_due := case credit_frequency
      when 'weekly' then now() + make_interval(days => 7 * installment_index)
      when 'biweekly' then now() + make_interval(days => 14 * installment_index)
      else now() + make_interval(months => installment_index)
    end;

    insert into public.credit_installments (
      credit_id, sale_id, installment_number, due_date, amount,
      principal_component, interest_component, status
    ) values (
      resolved_credit_id, null, installment_index, installment_due,
      case when installment_index = credit_count
        then financed_total - installment_base * (credit_count - 1)
        else installment_base end,
      case when installment_index = credit_count
        then p_payment_amount - principal_base * (credit_count - 1)
        else principal_base end,
      case when installment_index = credit_count
        then (financed_total - p_payment_amount)
          - (installment_base - principal_base) * (credit_count - 1)
        else installment_base - principal_base end,
      'pending'
    );
  end loop;

  -- Calling the established closure function inside this function keeps all
  -- writes in the current PostgreSQL transaction. Any error rolls back credit,
  -- installments, payment ledger, and repair summary together.
  operation_result := public.close_repair_and_register_payment(
    p_repair_id, p_organization_id, p_branch_id, p_actor_id, p_deliver,
    p_delivery_outcome, p_delivery_note, p_allow_outstanding_balance,
    p_payment_method, p_payment_amount, p_payment_reference, p_payment_note,
    p_idempotency_key, p_cash_session_id, resolved_credit_id, p_sale_id, p_source
  );

  return operation_result || jsonb_build_object(
    'credit_id', resolved_credit_id,
    'credit_total', financed_total
  );
end;
$$;

revoke all on function public.close_repair_and_register_payment(
  uuid, uuid, uuid, uuid, boolean, text, text, boolean, text, numeric,
  text, text, text, uuid, uuid, uuid, text, numeric, integer, text
) from public;
revoke all on function public.close_repair_and_register_payment(
  uuid, uuid, uuid, uuid, boolean, text, text, boolean, text, numeric,
  text, text, text, uuid, uuid, uuid, text, numeric, integer, text
) from anon, authenticated;
grant execute on function public.close_repair_and_register_payment(
  uuid, uuid, uuid, uuid, boolean, text, text, boolean, text, numeric,
  text, text, text, uuid, uuid, uuid, text, numeric, integer, text
) to service_role;
