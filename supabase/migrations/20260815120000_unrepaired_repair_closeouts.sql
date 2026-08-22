begin;

alter table public.customer_store_credits
  drop constraint if exists customer_store_credits_source_type_check;
alter table public.customer_store_credits
  add constraint customer_store_credits_source_type_check
  check (source_type in ('after_sales', 'sale', 'repair', 'manual'));

create unique index if not exists customer_store_credits_one_per_repair
  on public.customer_store_credits (organization_id, source_id)
  where source_type = 'repair' and source_id is not null;

create table if not exists public.repair_closeouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  repair_id uuid not null references public.repairs(id) on delete restrict,
  outcome text not null check (outcome in ('withdrawn', 'unrepairable')),
  charge_mode text not null check (charge_mode in ('none', 'labor', 'labor_and_consumed_parts', 'exceptional')),
  labor_charge numeric(12,2) not null default 0 check (labor_charge >= 0),
  consumed_parts_charge numeric(12,2) not null default 0 check (consumed_parts_charge >= 0),
  final_charge numeric(12,2) not null check (final_charge >= 0),
  paid_before numeric(12,2) not null check (paid_before >= 0),
  settlement_kind text not null check (settlement_kind in ('none', 'payment', 'outstanding', 'refund', 'store_credit')),
  settlement_amount numeric(12,2) not null default 0 check (settlement_amount >= 0),
  settlement_method text check (settlement_method is null or settlement_method in ('cash', 'card', 'transfer')),
  settlement_reference text,
  cash_session_id uuid references public.cash_closures(id) on delete set null,
  payment_id uuid references public.repair_payments(id) on delete set null,
  store_credit_id uuid references public.customer_store_credits(id) on delete set null,
  reason text,
  note text,
  parts_resolution jsonb not null default '[]'::jsonb check (jsonb_typeof(parts_resolution) = 'array'),
  created_by uuid references public.profiles(id) on delete set null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  created_at timestamptz not null default now(),
  unique (repair_id),
  unique (organization_id, idempotency_key)
);

create index if not exists repair_closeouts_scope_created_idx
  on public.repair_closeouts (organization_id, branch_id, created_at desc);

alter table public.repair_closeouts enable row level security;
revoke all on table public.repair_closeouts from public, anon;
revoke insert, update, delete on public.repair_closeouts from authenticated;
grant select on table public.repair_closeouts to authenticated;
grant all on table public.repair_closeouts to service_role;

drop policy if exists "tenant members can read repair closeouts" on public.repair_closeouts;
create policy "tenant members can read repair closeouts"
on public.repair_closeouts for select to authenticated
using (
  public.has_org_permission(organization_id, 'repairs.orders.read')
  or public.has_org_permission(organization_id, 'repairs.orders.update')
);

create or replace function public.close_unrepaired_repair(
  p_repair_id uuid,
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_outcome text,
  p_charge jsonb,
  p_parts jsonb,
  p_settlement jsonb,
  p_reason text default null,
  p_note text default null,
  p_cash_session_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_repair public.repairs%rowtype;
  existing_closeout public.repair_closeouts%rowtype;
  part_record record;
  resolution jsonb;
  operation_time timestamptz := now();
  resolved_mode text;
  resolved_kind text;
  resolved_method text;
  labor_charge numeric(12,2) := 0;
  consumed_parts_charge numeric(12,2) := 0;
  consumed_parts_cost numeric(12,2) := 0;
  final_charge numeric(12,2) := 0;
  paid_before numeric(12,2) := 0;
  difference numeric(12,2) := 0;
  settlement_amount numeric(12,2) := 0;
  net_paid numeric(12,2) := 0;
  resolved_payment_status text;
  created_payment_id uuid;
  created_credit_id uuid;
  previous_stock integer;
  resolved_parts jsonb := '[]'::jsonb;
  expected_count integer;
  supplied_count integer;
begin
  if p_actor_id is null or not exists (
    select 1 from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager', 'cashier', 'technician', 'seller')
  ) then raise exception 'REPAIR_FINANCIAL_PERMISSION_DENIED'; end if;

  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) not between 8 and 120 then
    raise exception 'REPAIR_IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_outcome not in ('withdrawn', 'unrepairable') then raise exception 'REPAIR_DELIVERY_OUTCOME_INVALID'; end if;
  if jsonb_typeof(coalesce(p_charge, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_parts, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_settlement, '{}'::jsonb)) <> 'object' then
    raise exception 'REPAIR_CLOSEOUT_INVALID';
  end if;

  select closeout.* into existing_closeout
  from public.repair_closeouts closeout
  where closeout.organization_id = p_organization_id
    and closeout.idempotency_key = trim(p_idempotency_key);
  if existing_closeout.id is not null then
    if existing_closeout.repair_id <> p_repair_id or existing_closeout.outcome <> p_outcome then
      raise exception 'REPAIR_CLOSEOUT_CONFLICT';
    end if;
    return jsonb_build_object('repair_id', p_repair_id, 'closeout_id', existing_closeout.id,
      'payment_id', existing_closeout.payment_id, 'store_credit_id', existing_closeout.store_credit_id,
      'idempotent', true, 'final_charge', existing_closeout.final_charge,
      'settlement_amount', existing_closeout.settlement_amount);
  end if;

  select repair.* into target_repair from public.repairs repair
  where repair.id = p_repair_id and repair.organization_id = p_organization_id and repair.branch_id = p_branch_id
  for update;
  if not found then raise exception 'REPAIR_NOT_FOUND'; end if;
  select closeout.* into existing_closeout
  from public.repair_closeouts closeout
  where closeout.organization_id = p_organization_id
    and closeout.idempotency_key = trim(p_idempotency_key);
  if existing_closeout.id is not null then
    if existing_closeout.repair_id <> p_repair_id or existing_closeout.outcome <> p_outcome then
      raise exception 'REPAIR_CLOSEOUT_CONFLICT';
    end if;
    return jsonb_build_object('repair_id', p_repair_id, 'closeout_id', existing_closeout.id,
      'payment_id', existing_closeout.payment_id, 'store_credit_id', existing_closeout.store_credit_id,
      'idempotent', true, 'final_charge', existing_closeout.final_charge,
      'settlement_amount', existing_closeout.settlement_amount);
  end if;
  if target_repair.status = 'entregado' then raise exception 'REPAIR_ALREADY_DELIVERED'; end if;
  if target_repair.status <> 'listo' then raise exception 'REPAIR_DELIVERY_INVALID_STATE'; end if;

  perform 1 from public.repair_payments payment
  where payment.repair_id = p_repair_id and payment.organization_id = p_organization_id and payment.branch_id = p_branch_id
  order by payment.id for update;
  select coalesce(sum(payment.amount), 0) into paid_before
  from public.repair_payments payment
  where payment.repair_id = p_repair_id and payment.organization_id = p_organization_id and payment.branch_id = p_branch_id;
  paid_before := greatest(paid_before, greatest(0, coalesce(target_repair.paid_amount, 0)));

  perform 1 from public.repair_parts part where part.repair_id = p_repair_id order by part.id for update;
  select count(*) into expected_count from public.repair_parts part where part.repair_id = p_repair_id;
  select count(*), count(distinct value->>'repairPartId') into supplied_count, previous_stock
  from jsonb_array_elements(p_parts);
  if supplied_count <> expected_count or previous_stock <> expected_count then
    raise exception 'REPAIR_PART_RESOLUTION_REQUIRED';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_parts) item
    left join public.repair_parts part on part.id = nullif(item.value->>'repairPartId', '')::uuid and part.repair_id = p_repair_id
    where part.id is null or item.value->>'disposition' not in ('consumed', 'restocked')
  ) then raise exception 'REPAIR_PART_RESOLUTION_REQUIRED'; end if;

  for part_record in
    select part.*, item.value->>'disposition' as disposition
    from public.repair_parts part
    join jsonb_array_elements(p_parts) item on (item.value->>'repairPartId')::uuid = part.id
    where part.repair_id = p_repair_id order by part.id
  loop
    consumed_parts_charge := consumed_parts_charge + case when part_record.disposition = 'consumed'
      then greatest(part_record.quantity, 0) * greatest(coalesce(part_record.unit_price, part_record.unit_cost, 0), 0) else 0 end;
    consumed_parts_cost := consumed_parts_cost + case when part_record.disposition = 'consumed'
      then greatest(part_record.quantity, 0) * greatest(coalesce(part_record.unit_cost, 0), 0) else 0 end;
    resolved_parts := resolved_parts || jsonb_build_array(jsonb_build_object(
      'repairPartId', part_record.id, 'productId', part_record.product_id,
      'name', part_record.part_name, 'quantity', part_record.quantity,
      'unitPrice', coalesce(part_record.unit_price, part_record.unit_cost, 0), 'disposition', part_record.disposition));
  end loop;

  resolved_mode := p_charge->>'mode';
  if resolved_mode = 'none' then final_charge := 0;
  elsif resolved_mode = 'labor' then
    labor_charge := greatest(0, coalesce(nullif(p_charge->>'laborAmount', '')::numeric, 0)); final_charge := labor_charge;
  elsif resolved_mode = 'labor_and_consumed_parts' then
    labor_charge := greatest(0, coalesce(nullif(p_charge->>'laborAmount', '')::numeric, 0)); final_charge := labor_charge + consumed_parts_charge;
  elsif resolved_mode = 'exceptional' then
    if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'REPAIR_EXCEPTION_REASON_REQUIRED'; end if;
    final_charge := greatest(0, coalesce(nullif(p_charge->>'amount', '')::numeric, 0));
  else raise exception 'REPAIR_CHARGE_MODE_INVALID'; end if;

  difference := final_charge - paid_before;
  resolved_kind := p_settlement->>'kind';
  resolved_method := nullif(p_settlement->>'method', '');
  settlement_amount := abs(difference);
  if difference > 0 and resolved_kind not in ('payment', 'outstanding') then raise exception 'REPAIR_SETTLEMENT_MISMATCH'; end if;
  if difference = 0 and resolved_kind <> 'none' then raise exception 'REPAIR_SETTLEMENT_MISMATCH'; end if;
  if difference < 0 and resolved_kind not in ('refund', 'store_credit') then raise exception 'REPAIR_SETTLEMENT_MISMATCH'; end if;
  if resolved_kind = 'payment' then
    if resolved_method not in ('cash', 'card', 'transfer')
       or coalesce(nullif(p_settlement->>'amount', '')::numeric, -1) <> settlement_amount then
      raise exception 'REPAIR_SETTLEMENT_MISMATCH';
    end if;
  end if;
  if resolved_kind = 'refund' and resolved_method not in ('cash', 'transfer') then raise exception 'REPAIR_SETTLEMENT_MISMATCH'; end if;
  if resolved_method = 'transfer' and nullif(trim(coalesce(p_settlement->>'reference', '')), '') is null then
    raise exception 'REPAIR_TRANSFER_REFERENCE_REQUIRED';
  end if;
  if resolved_kind in ('payment', 'refund') and resolved_method in ('cash', 'card') then
    if p_cash_session_id is null or not exists (
      select 1 from public.cash_closures closure where closure.id = p_cash_session_id
        and closure.organization_id = p_organization_id and closure.branch_id = p_branch_id and closure.date is null
    ) then raise exception 'REPAIR_CASH_REGISTER_NOT_OPEN'; end if;
  end if;

  for part_record in
    select part.*, item.value->>'disposition' as disposition
    from public.repair_parts part
    join jsonb_array_elements(p_parts) item on (item.value->>'repairPartId')::uuid = part.id
    where part.repair_id = p_repair_id and item.value->>'disposition' = 'restocked' and part.product_id is not null
    order by part.product_id, part.id
  loop
    select inventory.stock_quantity into previous_stock from public.branch_inventory inventory
    where inventory.branch_id = p_branch_id and inventory.product_id = part_record.product_id for update;
    if not found then raise exception 'REPAIR_INVENTORY_ROW_MISSING|%', part_record.product_id; end if;
    update public.branch_inventory set stock_quantity = previous_stock + part_record.quantity, updated_at = operation_time
    where branch_id = p_branch_id and product_id = part_record.product_id;
    insert into public.product_movements (
      product_id, movement_type, quantity, previous_stock, new_stock, unit_cost, total_cost,
      reference_id, reference_type, notes, user_id, branch_id, organization_id, created_at
    ) values (
      part_record.product_id, 'return', part_record.quantity, previous_stock, previous_stock + part_record.quantity,
      part_record.unit_cost, part_record.unit_cost * part_record.quantity, p_repair_id, 'repair_closeout',
      'Repuesto reutilizable devuelto al cerrar reparación sin reparar', p_actor_id, p_branch_id, p_organization_id, operation_time
    );
  end loop;

  if resolved_kind = 'payment' then
    insert into public.repair_payments (
      repair_id, organization_id, branch_id, amount, payment_method, idempotency_key, source,
      reference, notes, cash_session_id, created_by, created_at
    ) values (
      p_repair_id, p_organization_id, p_branch_id, settlement_amount, resolved_method,
      trim(p_idempotency_key) || ':payment', 'delivery', nullif(trim(coalesce(p_settlement->>'reference', '')), ''),
      'Cierre de reparación sin reparar', p_cash_session_id, p_actor_id, operation_time
    ) returning id into created_payment_id;
    if resolved_method <> 'transfer' or p_cash_session_id is not null then
      insert into public.cash_movements (session_id, type, amount, reason, payment_method, created_by, created_at, organization_id, branch_id)
      values (p_cash_session_id, 'cash_in', settlement_amount, 'Cobro cierre reparación ' || coalesce(target_repair.ticket_number, p_repair_id::text),
        resolved_method, p_actor_id, operation_time, p_organization_id, p_branch_id);
    end if;
  elsif resolved_kind = 'refund' then
    if p_cash_session_id is not null then
      insert into public.cash_movements (session_id, type, amount, reason, payment_method, created_by, created_at, organization_id, branch_id)
      values (p_cash_session_id, 'cash_out', settlement_amount, 'Devolución cierre reparación ' || coalesce(target_repair.ticket_number, p_repair_id::text),
        resolved_method, p_actor_id, operation_time, p_organization_id, p_branch_id);
    end if;
  elsif resolved_kind = 'store_credit' then
    insert into public.customer_store_credits (organization_id, customer_id, amount, reason, source_type, source_id, created_by, created_at)
    values (p_organization_id, target_repair.customer_id, settlement_amount,
      'Saldo a favor por cierre de reparación ' || coalesce(target_repair.ticket_number, p_repair_id::text),
      'repair', p_repair_id, p_actor_id, operation_time)
    returning id into created_credit_id;
  end if;

  net_paid := case when difference > 0 and resolved_kind = 'outstanding' then paid_before else final_charge end;
  resolved_payment_status := case when final_charge <= net_paid then 'pagado' when net_paid > 0 then 'parcial' else 'pendiente' end;
  update public.repairs set final_cost = final_charge, estimated_cost = final_charge,
    labor_cost = labor_charge, parts_cost = consumed_parts_cost, paid_amount = net_paid,
    payment_status = resolved_payment_status, status = 'entregado', picked_up_at = operation_time,
    delivered_at = operation_time, completed_at = coalesce(completed_at, operation_time),
    delivery_outcome = p_outcome, solution = coalesce(nullif(trim(coalesce(p_note, '')), ''), solution),
    warranty_expires_at = null, delivery_idempotency_key = trim(p_idempotency_key), updated_at = operation_time
  where id = p_repair_id and organization_id = p_organization_id and branch_id = p_branch_id;

  insert into public.repair_closeouts (
    organization_id, branch_id, repair_id, outcome, charge_mode, labor_charge, consumed_parts_charge,
    final_charge, paid_before, settlement_kind, settlement_amount, settlement_method, settlement_reference,
    cash_session_id, payment_id, store_credit_id, reason, note, parts_resolution, created_by, idempotency_key, created_at
  ) values (
    p_organization_id, p_branch_id, p_repair_id, p_outcome, resolved_mode, labor_charge, consumed_parts_charge,
    final_charge, paid_before, resolved_kind, settlement_amount, resolved_method,
    nullif(trim(coalesce(p_settlement->>'reference', '')), ''), p_cash_session_id, created_payment_id,
    created_credit_id, nullif(trim(coalesce(p_reason, '')), ''), nullif(trim(coalesce(p_note, '')), ''),
    resolved_parts, p_actor_id, trim(p_idempotency_key), operation_time
  ) returning id into existing_closeout.id;

  return jsonb_build_object('repair_id', p_repair_id, 'closeout_id', existing_closeout.id,
    'payment_id', created_payment_id, 'store_credit_id', created_credit_id, 'idempotent', false,
    'final_charge', final_charge, 'paid_before', paid_before, 'settlement_amount', settlement_amount,
    'payment_status', resolved_payment_status);
end;
$$;

revoke all on function public.close_unrepaired_repair(uuid,uuid,uuid,uuid,text,jsonb,jsonb,jsonb,text,text,uuid,text) from public;
revoke all on function public.close_unrepaired_repair(uuid,uuid,uuid,uuid,text,jsonb,jsonb,jsonb,text,text,uuid,text) from anon, authenticated;
grant execute on function public.close_unrepaired_repair(uuid,uuid,uuid,uuid,text,jsonb,jsonb,jsonb,text,text,uuid,text) to service_role;

commit;
