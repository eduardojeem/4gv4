-- Keep the POS sale, electronic metadata and repair payment guard in one transaction.

begin;

create or replace function public.process_pos_sale_atomic_v3(
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
  p_delivery_outcome text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sale_result jsonb;
  resolved_sale_id uuid;
  existing_sale_id uuid;
begin
  if coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  -- Serialize retries before checking repair payment state. The v2 function uses
  -- the same transaction lock, so a retry remains idempotent.
  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':pos:' || trim(p_idempotency_key), 0)
  );

  select sale.id
  into existing_sale_id
  from public.sales sale
  where sale.organization_id = p_organization_id
    and sale.idempotency_key = trim(p_idempotency_key);

  if existing_sale_id is null
     and jsonb_typeof(coalesce(p_repair_ids, '[]'::jsonb)) = 'array' then
    -- Lock selected repair rows so two cashiers cannot charge the same repair.
    perform repair.id
    from jsonb_array_elements_text(coalesce(p_repair_ids, '[]'::jsonb)) requested(value)
    join public.repairs repair
      on requested.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     and repair.id = requested.value::uuid
    where repair.organization_id = p_organization_id
      and repair.branch_id = p_branch_id
    order by repair.id
    for update of repair;

    if exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_repair_ids, '[]'::jsonb)) requested(value)
      join public.repairs repair
        on requested.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and repair.id = requested.value::uuid
      where repair.organization_id = p_organization_id
        and repair.branch_id = p_branch_id
        and lower(coalesce(repair.payment_status, '')) in ('pagado', 'paid')
    ) then
      raise exception 'REPAIR_ALREADY_PAID';
    end if;
  end if;

  sale_result := public.process_pos_sale_atomic_v2(
    p_organization_id => p_organization_id,
    p_branch_id => p_branch_id,
    p_actor_id => p_actor_id,
    p_session_id => p_session_id,
    p_idempotency_key => p_idempotency_key,
    p_code => p_code,
    p_customer_id => p_customer_id,
    p_items => p_items,
    p_payments => p_payments,
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

  resolved_sale_id := (sale_result->>'sale_id')::uuid;
  if resolved_sale_id is null then
    raise exception 'INVALID_ATOMIC_SALE_RESPONSE';
  end if;

  perform public.apply_pos_payment_metadata_atomic(
    p_organization_id,
    p_branch_id,
    resolved_sale_id,
    p_actor_id,
    p_payments
  );

  return sale_result;
end;
$$;

revoke all on function public.process_pos_sale_atomic_v3(
  uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text,
  numeric, boolean, jsonb, jsonb, boolean, text
) from public, anon, authenticated;

grant execute on function public.process_pos_sale_atomic_v3(
  uuid, uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, numeric, text,
  numeric, boolean, jsonb, jsonb, boolean, text
) to service_role;

commit;
