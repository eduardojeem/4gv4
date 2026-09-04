begin;

alter table public.customer_store_credits
  drop constraint if exists customer_store_credits_source_type_check;
alter table public.customer_store_credits
  add constraint customer_store_credits_source_type_check
  check (source_type in ('after_sales', 'sale', 'repair', 'order', 'order_refund', 'manual'));

create unique index if not exists customer_store_credits_one_refund_per_order
  on public.customer_store_credits (organization_id, source_id)
  where source_type = 'order_refund' and source_id is not null;

create table if not exists public.customer_order_checkout_attempts (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attempt_id uuid not null,
  order_id uuid references public.customer_orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, attempt_id)
);
alter table public.customer_order_checkout_attempts enable row level security;
revoke all on table public.customer_order_checkout_attempts from public, anon, authenticated;

create or replace function public.create_public_order_idempotent_atomic(
  p_organization_id uuid, p_customer_id uuid, p_customer jsonb, p_order jsonb,
  p_items jsonb, p_promotion_id uuid, p_profile_id uuid, p_profile_name text,
  p_profile_email text, p_profile_phone text, p_store_credit_amount numeric,
  p_attempt_id uuid
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  inserted_count integer;
  result jsonb;
  existing_order_id uuid;
  existing_customer_id uuid;
begin
  insert into public.customer_order_checkout_attempts (organization_id, attempt_id)
  values (p_organization_id, p_attempt_id)
  on conflict do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    select attempt.order_id, customer_order.customer_id
      into existing_order_id, existing_customer_id
    from public.customer_order_checkout_attempts attempt
    left join public.customer_orders customer_order on customer_order.id = attempt.order_id
    where attempt.organization_id = p_organization_id and attempt.attempt_id = p_attempt_id;
    if existing_order_id is null then raise exception 'ORDER_ATTEMPT_IN_PROGRESS'; end if;
    return jsonb_build_object('order_id', existing_order_id, 'customer_id', existing_customer_id, 'replayed', true);
  end if;

  result := public.create_public_order_with_store_credit_atomic(
    p_organization_id, p_customer_id, p_customer, p_order, p_items,
    p_promotion_id, p_profile_id, p_profile_name, p_profile_email,
    p_profile_phone, p_store_credit_amount
  );
  update public.customer_order_checkout_attempts
    set order_id = nullif(result->>'order_id', '')::uuid
    where organization_id = p_organization_id and attempt_id = p_attempt_id;
  return result || jsonb_build_object('replayed', false);
end;
$$;

revoke all on function public.create_public_order_idempotent_atomic(uuid, uuid, jsonb, jsonb, jsonb, uuid, uuid, text, text, text, numeric, uuid)
  from public, anon, authenticated;
grant execute on function public.create_public_order_idempotent_atomic(uuid, uuid, jsonb, jsonb, jsonb, uuid, uuid, text, text, text, numeric, uuid)
  to service_role;

create or replace function public.refund_applied_store_credit_on_order_cancel()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'CANCELLED'
     and old.status is distinct from 'CANCELLED'
     and coalesce(old.store_credit_applied, 0) > 0
     and old.customer_id is not null then
    insert into public.customer_store_credits (
      organization_id, customer_id, amount, reason, source_type, source_id, created_by
    ) values (
      old.organization_id, old.customer_id, old.store_credit_applied,
      'Reintegro por cancelación del pedido ' || old.order_number,
      'order_refund', old.id, auth.uid()
    )
    on conflict (organization_id, source_id)
      where source_type = 'order_refund' and source_id is not null
    do nothing;
    new.store_credit_applied := 0;
  end if;
  return new;
end;
$$;

revoke all on function public.refund_applied_store_credit_on_order_cancel() from public, anon, authenticated;
drop trigger if exists refund_applied_store_credit_on_order_cancel_trigger on public.customer_orders;
create trigger refund_applied_store_credit_on_order_cancel_trigger
  before update of status on public.customer_orders
  for each row execute function public.refund_applied_store_credit_on_order_cancel();

create or replace function public.record_customer_order_payment_atomic(
  p_organization_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_to_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  order_row public.customer_orders%rowtype;
  normalized_status text := upper(coalesce(p_to_status, ''));
  paid_amount numeric(12,2);
begin
  if p_actor_id is null or not exists (
    select 1 from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager', 'seller', 'cashier')
  ) then
    raise exception 'ORDER_PERMISSION_DENIED';
  end if;
  if normalized_status not in ('PAID', 'PARTIAL', 'REFUNDED', 'FAILED') then
    raise exception 'ORDER_PAYMENT_STATUS_INVALID';
  end if;

  select * into order_row from public.customer_orders
  where id = p_order_id and organization_id = p_organization_id
  for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if order_row.payment_status = normalized_status then
    return jsonb_build_object('order_id', order_row.id, 'unchanged', true);
  end if;
  if order_row.status = 'CANCELLED' and normalized_status not in ('REFUNDED', 'FAILED') then
    raise exception 'ORDER_ALREADY_CANCELLED';
  end if;
  if order_row.payment_status = 'REFUNDED' then raise exception 'ORDER_PAYMENT_ALREADY_REFUNDED'; end if;
  if normalized_status = 'REFUNDED' and order_row.payment_status not in ('PAID', 'PARTIAL') then
    raise exception 'ORDER_PAYMENT_NOT_REFUNDABLE';
  end if;

  paid_amount := case when normalized_status = 'PAID'
    then greatest(0, order_row.total - order_row.store_credit_reserved - order_row.store_credit_applied)
    else null end;

  update public.customer_orders
  set payment_status = normalized_status, updated_at = now()
  where id = order_row.id and organization_id = p_organization_id;

  insert into public.customer_order_payment_history (
    organization_id, order_id, from_status, to_status, payment_method,
    amount, note, changed_by, created_at
  ) values (
    p_organization_id, order_row.id, order_row.payment_status, normalized_status,
    order_row.payment_method, paid_amount, nullif(trim(p_note), ''), p_actor_id, now()
  );

  return jsonb_build_object('order_id', order_row.id, 'unchanged', false, 'amount', paid_amount);
end;
$$;

revoke all on function public.record_customer_order_payment_atomic(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.record_customer_order_payment_atomic(uuid, uuid, uuid, text, text)
  to service_role;

create or replace function public.advance_customer_order_status_atomic(
  p_organization_id uuid, p_order_id uuid, p_actor_id uuid,
  p_to_status text, p_note text default null
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  order_row public.customer_orders%rowtype;
  target text := upper(coalesce(p_to_status, ''));
  expected text;
begin
  if p_actor_id is null or not exists (
    select 1 from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager', 'seller', 'cashier')
  ) then raise exception 'ORDER_PERMISSION_DENIED'; end if;

  select * into order_row from public.customer_orders
  where id = p_order_id and organization_id = p_organization_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.status = target then
    return jsonb_build_object('order_id', order_row.id, 'unchanged', true);
  end if;
  if order_row.status in ('DELIVERED', 'CANCELLED') then raise exception 'ORDER_TERMINAL'; end if;

  expected := case order_row.status
    when 'PENDING' then 'CONFIRMED'
    when 'CONFIRMED' then 'PREPARING'
    when 'PREPARING' then 'READY'
    when 'READY' then case when order_row.fulfillment_type = 'PICKUP' then 'DELIVERED' else 'SHIPPED' end
    when 'SHIPPED' then 'DELIVERED'
    else null end;
  if target is distinct from expected then raise exception 'ORDER_TRANSITION_INVALID'; end if;

  update public.customer_orders set status = target,
    delivered_at = case when target = 'DELIVERED' then now() else delivered_at end,
    updated_at = now()
  where id = order_row.id and organization_id = p_organization_id;
  insert into public.customer_order_status_history
    (organization_id, order_id, from_status, to_status, note, changed_by)
  values (p_organization_id, order_row.id, order_row.status, target, nullif(trim(p_note), ''), p_actor_id);
  return jsonb_build_object('order_id', order_row.id, 'unchanged', false);
end;
$$;

revoke all on function public.advance_customer_order_status_atomic(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.advance_customer_order_status_atomic(uuid, uuid, uuid, text, text)
  to service_role;

create or replace function public.confirm_customer_order_from_pending_atomic(
  p_organization_id uuid, p_order_id uuid, p_actor_id uuid, p_note text default null
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare current_status text;
begin
  select status into current_status from public.customer_orders
  where id = p_order_id and organization_id = p_organization_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if current_status = 'CONFIRMED' then
    return jsonb_build_object('order_id', p_order_id, 'unchanged', true);
  end if;
  if current_status <> 'PENDING' then raise exception 'ORDER_TRANSITION_INVALID'; end if;
  return public.confirm_customer_order_store_credit_atomic(
    p_organization_id, p_order_id, p_actor_id, p_note
  );
end;
$$;

revoke all on function public.confirm_customer_order_from_pending_atomic(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.confirm_customer_order_from_pending_atomic(uuid, uuid, uuid, text)
  to service_role;

commit;
