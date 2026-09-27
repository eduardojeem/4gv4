-- Administrative correction of internal part costs after delivery.
-- Commercial totals, payments, delivery state and inventory remain unchanged.

create or replace function public.correct_delivered_repair_internal_cost(
  p_repair_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_corrections jsonb,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_repair public.repairs%rowtype;
  existing_revision public.repair_cost_revisions%rowtype;
  membership_role text;
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
  normalized_corrections jsonb := coalesce(p_corrections, '[]'::jsonb);
  request_hash text;
  correction jsonb;
  corrected_part_id uuid;
  corrected_unit_cost numeric;
  affected_rows integer;
  previous_internal_cost numeric := 0;
  new_internal_cost numeric := 0;
  parts_subtotal numeric := 0;
  new_revision_id uuid;
  new_revision_number integer;
  previous_snapshot jsonb;
  policy_snapshot jsonb;
  result_payload jsonb;
  current_tax_breakdown jsonb := '[]'::jsonb;
  current_labor_tax_rate numeric := 10;
begin
  if jsonb_typeof(normalized_corrections) <> 'array'
     or jsonb_array_length(normalized_corrections) = 0
     or jsonb_array_length(normalized_corrections) > 100 then
    raise exception 'INVALID_REPAIR_INTERNAL_COST_CORRECTIONS';
  end if;
  if normalized_reason is null or length(normalized_reason) < 10 then
    raise exception 'REPAIR_COST_CORRECTION_REASON_REQUIRED';
  end if;
  if length(trim(coalesce(p_idempotency_key, ''))) < 8 then
    raise exception 'INVALID_REPAIR_COST_IDEMPOTENCY_KEY';
  end if;

  request_hash := md5(jsonb_build_object(
    'repair_id', p_repair_id,
    'corrections', normalized_corrections,
    'reason', normalized_reason
  )::text);
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_idempotency_key, 0));

  select * into existing_revision
  from public.repair_cost_revisions revision
  where revision.organization_id = p_organization_id
    and revision.idempotency_key = p_idempotency_key;
  if found then
    if existing_revision.intent_hash is distinct from request_hash then
      raise exception 'REPAIR_COST_IDEMPOTENCY_CONFLICT';
    end if;
    return existing_revision.result_snapshot;
  end if;

  select * into target_repair
  from public.repairs repair
  where repair.id = p_repair_id
    and repair.organization_id = p_organization_id
    and repair.branch_id = p_branch_id
  for update;
  if not found then raise exception 'REPAIR_NOT_FOUND'; end if;
  if target_repair.status <> 'entregado' then
    raise exception 'REPAIR_COST_CORRECTION_REQUIRES_DELIVERED';
  end if;

  select membership.role::text into membership_role
  from public.organization_members membership
  where membership.organization_id = p_organization_id
    and membership.user_id = p_actor_id
    and membership.status = 'active';
  if membership_role is null or membership_role not in ('owner', 'admin', 'super_admin') then
    raise exception 'REPAIR_COST_CORRECTION_FORBIDDEN';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(normalized_corrections) item
    group by item->>'part_id'
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_REPAIR_PART_CORRECTION';
  end if;

  select round(coalesce(sum(part.unit_cost * part.quantity), 0), 2)
  into previous_internal_cost
  from public.repair_parts part
  where part.repair_id = p_repair_id;

  for correction in select value from jsonb_array_elements(normalized_corrections)
  loop
    begin
      corrected_part_id := (correction->>'part_id')::uuid;
      corrected_unit_cost := round((correction->>'unit_cost')::numeric, 2);
    exception when others then
      raise exception 'INVALID_REPAIR_INTERNAL_COST_CORRECTION';
    end;
    if corrected_part_id is null or corrected_unit_cost is null or corrected_unit_cost < 0 then
      raise exception 'INVALID_REPAIR_INTERNAL_COST_CORRECTION';
    end if;

    update public.repair_parts
    set unit_cost = corrected_unit_cost
    where id = corrected_part_id
      and repair_id = p_repair_id;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then raise exception 'REPAIR_PART_NOT_FOUND'; end if;
  end loop;

  select
    round(coalesce(sum(part.unit_cost * part.quantity), 0), 2),
    round(coalesce(sum(greatest(0, part.unit_price * part.quantity - coalesce(part.discount_amount, 0))), 0), 2)
  into new_internal_cost, parts_subtotal
  from public.repair_parts part
  where part.repair_id = p_repair_id;

  select coalesce(revision.tax_breakdown, '[]'::jsonb), coalesce(revision.labor_tax_rate, 10)
  into current_tax_breakdown, current_labor_tax_rate
  from public.repair_cost_revisions revision
  where revision.id = target_repair.current_cost_revision_id;
  current_tax_breakdown := coalesce(current_tax_breakdown, '[]'::jsonb);
  current_labor_tax_rate := coalesce(current_labor_tax_rate, 10);

  select coalesce(max(revision.revision_number), 0) + 1
  into new_revision_number
  from public.repair_cost_revisions revision
  where revision.repair_id = p_repair_id;

  previous_snapshot := jsonb_build_object(
    'laborAmount', coalesce(target_repair.labor_cost, 0),
    'partsSubtotal', parts_subtotal,
    'partsInternalCost', previous_internal_cost,
    'additionalCharges', coalesce(target_repair.additional_charges, 0),
    'deductions', coalesce(target_repair.deductions, 0),
    'discountAmount', coalesce(target_repair.discount_amount, 0),
    'finalTotal', coalesce(target_repair.final_cost, target_repair.estimated_cost, 0)
  );
  policy_snapshot := jsonb_build_object(
    'internalCostCorrection', true,
    'commercialTotalChanged', false,
    'inventoryChanged', false,
    'paymentChanged', false
  );
  new_revision_id := gen_random_uuid();
  result_payload := jsonb_build_object(
    'revisionId', new_revision_id,
    'revisionNumber', new_revision_number,
    'previousInternalCost', previous_internal_cost,
    'newInternalCost', new_internal_cost,
    'difference', new_internal_cost - previous_internal_cost,
    'finalTotal', coalesce(target_repair.final_cost, target_repair.estimated_cost, 0)
  );

  insert into public.repair_cost_revisions (
    id, organization_id, branch_id, repair_id, revision_number, actor_id, actor_role,
    reason, labor_amount, labor_tax_rate, parts_subtotal, parts_internal_cost,
    additional_charges, deductions, discount_amount, subtotal_before_discount,
    final_total, paid_amount_snapshot, balance_snapshot, tax_breakdown,
    policy_snapshot, previous_snapshot, intent_hash, idempotency_key, result_snapshot
  ) values (
    new_revision_id, p_organization_id, p_branch_id, p_repair_id, new_revision_number,
    p_actor_id, membership_role, normalized_reason, coalesce(target_repair.labor_cost, 0),
    current_labor_tax_rate, parts_subtotal, new_internal_cost, coalesce(target_repair.additional_charges, 0),
    coalesce(target_repair.deductions, 0), coalesce(target_repair.discount_amount, 0),
    coalesce(target_repair.labor_cost, 0) + parts_subtotal + coalesce(target_repair.additional_charges, 0),
    coalesce(target_repair.final_cost, target_repair.estimated_cost, 0),
    greatest(coalesce(target_repair.paid_amount, 0), 0),
    greatest(coalesce(target_repair.final_cost, target_repair.estimated_cost, 0) - coalesce(target_repair.paid_amount, 0), 0),
    current_tax_breakdown, policy_snapshot, previous_snapshot, request_hash,
    p_idempotency_key, result_payload
  );

  insert into public.repair_cost_revision_parts (
    revision_id, organization_id, branch_id, repair_id, product_id, part_name,
    part_number, supplier, quantity, unit_cost_snapshot, unit_price_snapshot,
    discount_amount, tax_rate, subtotal
  )
  select new_revision_id, p_organization_id, p_branch_id, p_repair_id,
    part.product_id, part.part_name, part.part_number, part.supplier, part.quantity,
    part.unit_cost, part.unit_price, coalesce(part.discount_amount, 0),
    coalesce(part.tax_rate, 10),
    greatest(0, part.unit_price * part.quantity - coalesce(part.discount_amount, 0))
  from public.repair_parts part
  where part.repair_id = p_repair_id;

  update public.repairs
  set parts_cost = new_internal_cost,
      current_cost_revision_id = new_revision_id,
      pricing_updated_by = p_actor_id,
      pricing_updated_at = now(),
      updated_at = now()
  where id = p_repair_id
    and organization_id = p_organization_id
    and branch_id = p_branch_id;

  return result_payload;
end;
$$;

revoke all on function public.correct_delivered_repair_internal_cost(uuid, uuid, uuid, uuid, jsonb, text, text) from public;
revoke all on function public.correct_delivered_repair_internal_cost(uuid, uuid, uuid, uuid, jsonb, text, text) from anon;
revoke all on function public.correct_delivered_repair_internal_cost(uuid, uuid, uuid, uuid, jsonb, text, text) from authenticated;
grant execute on function public.correct_delivered_repair_internal_cost(uuid, uuid, uuid, uuid, jsonb, text, text) to service_role;

create or replace function public.correct_delivered_repair_final_price(
  p_repair_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_new_final_total numeric,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_repair public.repairs%rowtype;
  existing_revision public.repair_cost_revisions%rowtype;
  membership_role text;
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
  normalized_final_total numeric := round(coalesce(p_new_final_total, -1), 2);
  previous_final_total numeric;
  paid_snapshot numeric;
  new_balance numeric;
  new_payment_status text;
  request_hash text;
  parts_subtotal numeric := 0;
  parts_internal_cost numeric := 0;
  current_labor_tax_rate numeric := 10;
  current_tax_breakdown jsonb := '[]'::jsonb;
  current_tax_gross numeric := 0;
  new_tax_breakdown jsonb := '[]'::jsonb;
  new_revision_id uuid;
  new_revision_number integer;
  previous_snapshot jsonb;
  policy_snapshot jsonb;
  result_payload jsonb;
begin
  if normalized_final_total <= 0 then raise exception 'INVALID_REPAIR_FINAL_PRICE'; end if;
  if normalized_reason is null or length(normalized_reason) < 10 then
    raise exception 'REPAIR_FINAL_PRICE_CORRECTION_REASON_REQUIRED';
  end if;
  if length(trim(coalesce(p_idempotency_key, ''))) < 8 then
    raise exception 'INVALID_REPAIR_COST_IDEMPOTENCY_KEY';
  end if;

  request_hash := md5(jsonb_build_object(
    'repair_id', p_repair_id, 'new_final_total', normalized_final_total, 'reason', normalized_reason
  )::text);
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_idempotency_key, 0));
  select * into existing_revision
  from public.repair_cost_revisions revision
  where revision.organization_id = p_organization_id and revision.idempotency_key = p_idempotency_key;
  if found then
    if existing_revision.intent_hash is distinct from request_hash then
      raise exception 'REPAIR_COST_IDEMPOTENCY_CONFLICT';
    end if;
    return existing_revision.result_snapshot;
  end if;

  select * into target_repair
  from public.repairs repair
  where repair.id = p_repair_id
    and repair.organization_id = p_organization_id
    and repair.branch_id = p_branch_id
  for update;
  if not found then raise exception 'REPAIR_NOT_FOUND'; end if;
  if target_repair.status <> 'entregado' then raise exception 'REPAIR_FINAL_PRICE_CORRECTION_REQUIRES_DELIVERED'; end if;

  select membership.role::text into membership_role
  from public.organization_members membership
  where membership.organization_id = p_organization_id
    and membership.user_id = p_actor_id and membership.status = 'active';
  if membership_role is null or membership_role not in ('owner', 'admin', 'super_admin') then
    raise exception 'REPAIR_FINAL_PRICE_CORRECTION_FORBIDDEN';
  end if;

  previous_final_total := round(coalesce(target_repair.final_cost, target_repair.estimated_cost, 0), 2);
  paid_snapshot := round(greatest(coalesce(target_repair.paid_amount, 0), 0), 2);
  if normalized_final_total = previous_final_total then raise exception 'REPAIR_FINAL_PRICE_UNCHANGED'; end if;
  if normalized_final_total < paid_snapshot then
    raise exception 'REPAIR_FINAL_PRICE_BELOW_PAID|%' , round(paid_snapshot - normalized_final_total, 2);
  end if;
  new_balance := round(greatest(normalized_final_total - paid_snapshot, 0), 2);
  new_payment_status := case
    when normalized_final_total > 0 and paid_snapshot >= normalized_final_total then 'pagado'
    when paid_snapshot > 0 then 'parcial'
    else 'pendiente'
  end;

  select
    round(coalesce(sum(greatest(0, part.unit_price * part.quantity - coalesce(part.discount_amount, 0))), 0), 2),
    round(coalesce(sum(part.unit_cost * part.quantity), 0), 2)
  into parts_subtotal, parts_internal_cost
  from public.repair_parts part where part.repair_id = p_repair_id;

  select coalesce(revision.labor_tax_rate, 10), coalesce(revision.tax_breakdown, '[]'::jsonb)
  into current_labor_tax_rate, current_tax_breakdown
  from public.repair_cost_revisions revision where revision.id = target_repair.current_cost_revision_id;
  current_labor_tax_rate := coalesce(current_labor_tax_rate, 10);
  current_tax_breakdown := coalesce(current_tax_breakdown, '[]'::jsonb);
  select coalesce(sum((bucket->>'grossAmount')::numeric), 0)
  into current_tax_gross from jsonb_array_elements(current_tax_breakdown) bucket;

  if current_tax_gross > 0 then
    with raw_buckets as (
      select (bucket->>'rate')::numeric rate,
        round((bucket->>'grossAmount')::numeric * normalized_final_total / current_tax_gross, 2) gross_amount
      from jsonb_array_elements(current_tax_breakdown) bucket
    ), adjusted as (
      select rate, case when rate = (select max(rate) from raw_buckets)
        then gross_amount + normalized_final_total - (select sum(gross_amount) from raw_buckets)
        else gross_amount end gross_amount
      from raw_buckets
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'rate', rate, 'grossAmount', gross_amount,
      'taxableBase', round(gross_amount / (1 + rate / 100), 2),
      'taxAmount', round(gross_amount - gross_amount / (1 + rate / 100), 2)
    ) order by rate), '[]'::jsonb) into new_tax_breakdown from adjusted;
  elsif normalized_final_total > 0 then
    new_tax_breakdown := jsonb_build_array(jsonb_build_object(
      'rate', current_labor_tax_rate, 'grossAmount', normalized_final_total,
      'taxableBase', round(normalized_final_total / (1 + current_labor_tax_rate / 100), 2),
      'taxAmount', round(normalized_final_total - normalized_final_total / (1 + current_labor_tax_rate / 100), 2)
    ));
  end if;

  select coalesce(max(revision.revision_number), 0) + 1 into new_revision_number
  from public.repair_cost_revisions revision where revision.repair_id = p_repair_id;
  previous_snapshot := jsonb_build_object(
    'laborAmount', coalesce(target_repair.labor_cost, 0), 'partsSubtotal', parts_subtotal,
    'partsInternalCost', parts_internal_cost, 'additionalCharges', coalesce(target_repair.additional_charges, 0),
    'deductions', coalesce(target_repair.deductions, 0), 'discountAmount', coalesce(target_repair.discount_amount, 0),
    'finalTotal', previous_final_total, 'paidAmount', paid_snapshot
  );
  policy_snapshot := jsonb_build_object(
    'commercialPriceCorrection', true, 'internalCostChanged', false,
    'inventoryChanged', false, 'paymentEntriesChanged', false
  );
  new_revision_id := gen_random_uuid();
  result_payload := jsonb_build_object(
    'revisionId', new_revision_id, 'revisionNumber', new_revision_number,
    'previousFinalTotal', previous_final_total, 'newFinalTotal', normalized_final_total,
    'difference', normalized_final_total - previous_final_total,
    'paidAmount', paid_snapshot, 'balance', new_balance, 'paymentStatus', new_payment_status
  );

  insert into public.repair_cost_revisions (
    id, organization_id, branch_id, repair_id, revision_number, actor_id, actor_role,
    reason, labor_amount, labor_tax_rate, parts_subtotal, parts_internal_cost,
    additional_charges, deductions, discount_amount, subtotal_before_discount,
    final_total, paid_amount_snapshot, balance_snapshot, tax_breakdown,
    policy_snapshot, previous_snapshot, intent_hash, idempotency_key, result_snapshot
  ) values (
    new_revision_id, p_organization_id, p_branch_id, p_repair_id, new_revision_number,
    p_actor_id, membership_role, normalized_reason, coalesce(target_repair.labor_cost, 0),
    current_labor_tax_rate, parts_subtotal, parts_internal_cost,
    coalesce(target_repair.additional_charges, 0), coalesce(target_repair.deductions, 0),
    coalesce(target_repair.discount_amount, 0),
    coalesce(target_repair.labor_cost, 0) + parts_subtotal + coalesce(target_repair.additional_charges, 0),
    normalized_final_total, paid_snapshot, new_balance, new_tax_breakdown,
    policy_snapshot, previous_snapshot, request_hash, p_idempotency_key, result_payload
  );

  insert into public.repair_cost_revision_parts (
    revision_id, organization_id, branch_id, repair_id, product_id, part_name,
    part_number, supplier, quantity, unit_cost_snapshot, unit_price_snapshot,
    discount_amount, tax_rate, subtotal
  ) select new_revision_id, p_organization_id, p_branch_id, p_repair_id,
    part.product_id, part.part_name, part.part_number, part.supplier, part.quantity,
    part.unit_cost, part.unit_price, coalesce(part.discount_amount, 0), coalesce(part.tax_rate, 10),
    greatest(0, part.unit_price * part.quantity - coalesce(part.discount_amount, 0))
  from public.repair_parts part where part.repair_id = p_repair_id;

  update public.repairs
  set final_cost = normalized_final_total,
      estimated_cost = normalized_final_total,
      payment_status = new_payment_status,
      pricing_mode = 'manual',
      price_override_reason = normalized_reason,
      current_cost_revision_id = new_revision_id,
      pricing_updated_by = p_actor_id,
      pricing_updated_at = now(),
      updated_at = now()
  where id = p_repair_id and organization_id = p_organization_id and branch_id = p_branch_id;

  return result_payload;
end;
$$;

revoke all on function public.correct_delivered_repair_final_price(uuid, uuid, uuid, uuid, numeric, text, text) from public;
revoke all on function public.correct_delivered_repair_final_price(uuid, uuid, uuid, uuid, numeric, text, text) from anon;
revoke all on function public.correct_delivered_repair_final_price(uuid, uuid, uuid, uuid, numeric, text, text) from authenticated;
grant execute on function public.correct_delivered_repair_final_price(uuid, uuid, uuid, uuid, numeric, text, text) to service_role;
