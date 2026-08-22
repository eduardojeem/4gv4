begin;

create or replace function public.process_pos_sale_atomic_v4(
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
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  created_sale_id uuid;
  sale public.sales%rowtype;
  available_balance numeric := 0;
  requested_store_credit numeric := round(greatest(0, coalesce(p_store_credit_amount, 0)), 2);
  effective_payments jsonb := coalesce(p_payments, '[]'::jsonb);
  existing_debit numeric;
begin
  if requested_store_credit > 0 then
    if p_customer_id is null then
      raise exception 'STORE_CREDIT_CUSTOMER_REQUIRED';
    end if;

    -- Every redemption for this customer uses the same row lock. This makes
    -- the balance check and ledger insert safe across simultaneous registers.
    perform 1
    from public.customers customer
    where customer.id = p_customer_id
      and customer.organization_id = p_organization_id
    for update;

    if not found then
      raise exception 'CUSTOMER_NOT_IN_ORGANIZATION';
    end if;

    select coalesce(sum(credit.amount), 0)
    into available_balance
    from public.customer_store_credits credit
    where credit.organization_id = p_organization_id
      and credit.customer_id = p_customer_id;

    if requested_store_credit > available_balance then
      raise exception 'STORE_CREDIT_EXCEEDS_BALANCE|%', greatest(0, available_balance);
    end if;

    -- v3 validates that payment tenders equal the server-calculated sale total.
    -- The synthetic entry participates only in that validation and is removed
    -- together with its cash movement before this transaction commits.
    effective_payments := effective_payments || jsonb_build_array(jsonb_build_object(
      'payment_method', 'cash',
      'amount', requested_store_credit,
      'reference', null,
      'card_last4', null,
      'payment_index', 9999
    ));
  end if;

  result := public.process_pos_sale_atomic_v3(
    p_organization_id => p_organization_id,
    p_branch_id => p_branch_id,
    p_actor_id => p_actor_id,
    p_session_id => p_session_id,
    p_idempotency_key => p_idempotency_key,
    p_code => p_code,
    p_customer_id => p_customer_id,
    p_items => p_items,
    p_payments => effective_payments,
    p_price_mode => p_price_mode,
    p_order_discount_rate => p_order_discount_rate,
    p_notes => p_notes,
    p_tax_rate => p_tax_rate,
    p_prices_include_tax => p_prices_include_tax,
    p_credit => p_credit,
    p_repair_ids => p_repair_ids,
    p_mark_repairs_delivered => p_mark_repairs_delivered,
    p_delivery_outcome => p_delivery_outcome
  );

  created_sale_id := (result->>'sale_id')::uuid;
  if requested_store_credit <= 0 then
    return result;
  end if;

  select * into sale
  from public.sales
  where id = created_sale_id
    and organization_id = p_organization_id;

  if not found or sale.customer_id is distinct from p_customer_id then
    raise exception 'STORE_CREDIT_SALE_CUSTOMER_MISMATCH';
  end if;
  if requested_store_credit > sale.total_amount then
    raise exception 'STORE_CREDIT_EXCEEDS_SALE_TOTAL';
  end if;

  select abs(credit.amount) into existing_debit
  from public.customer_store_credits credit
  where credit.organization_id = p_organization_id
    and credit.source_type = 'sale'
    and credit.source_id = created_sale_id;

  if existing_debit is not null then
    if existing_debit <> requested_store_credit then
      raise exception 'STORE_CREDIT_IDEMPOTENCY_MISMATCH';
    end if;
    return result || jsonb_build_object('store_credit_applied', existing_debit);
  end if;

  -- The synthetic entry is always last, so v3 assigns this ordinal index.
  delete from public.cash_movements
  where organization_id = p_organization_id
    and sale_id = created_sale_id
    and payment_index = jsonb_array_length(effective_payments) - 1;

  delete from public.sale_payments
  where organization_id = p_organization_id
    and sale_id = created_sale_id
    and payment_index = jsonb_array_length(effective_payments) - 1;

  insert into public.customer_store_credits (
    organization_id, customer_id, amount, reason, source_type, source_id, created_by
  ) values (
    p_organization_id, p_customer_id, -requested_store_credit,
    'Aplicado en venta ' || coalesce(sale.code, created_sale_id::text),
    'sale', created_sale_id, p_actor_id
  );

  update public.sales
  set payment_method = case
    when jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) = 0 then 'store_credit'
    when jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) = 1 then 'mixed'
    else payment_method
  end
  where id = created_sale_id and organization_id = p_organization_id;

  return result || jsonb_build_object('store_credit_applied', requested_store_credit);
end;
$$;

revoke all on function public.process_pos_sale_atomic_v4(uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text, numeric, boolean, jsonb, jsonb, boolean, text, numeric) from public;
grant execute on function public.process_pos_sale_atomic_v4(uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text, numeric, boolean, jsonb, jsonb, boolean, text, numeric) to authenticated;

commit;
