-- Record actual ecommerce order collections instead of manually flipping a
-- payment status. This migration intentionally follows the already deployed
-- lifecycle hardening migration.

alter table public.customer_orders
  add column if not exists collected_amount numeric(12,2) not null default 0
    check (collected_amount >= 0);

alter table public.customer_order_payment_history
  add column if not exists payment_reference text,
  add column if not exists idempotency_key uuid;

create unique index if not exists customer_order_payment_history_idempotency_unique
  on public.customer_order_payment_history (organization_id, idempotency_key)
  where idempotency_key is not null;

update public.customer_orders target
set collected_amount = least(
  greatest(0, target.total - coalesce(target.store_credit_reserved, 0) - coalesce(target.store_credit_applied, 0)),
  coalesce(source.paid_amount, 0)
)
from (
  select organization_id, order_id,
    sum(coalesce(amount, 0)) filter (where to_status in ('PAID', 'PARTIAL')) as paid_amount
  from public.customer_order_payment_history
  group by organization_id, order_id
) source
where source.organization_id = target.organization_id
  and source.order_id = target.id
  and target.collected_amount = 0;

create or replace function public.record_customer_order_collection_atomic(
  p_organization_id uuid,
  p_order_id uuid,
  p_actor_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_reference text default null,
  p_note text default null,
  p_idempotency_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  order_row public.customer_orders%rowtype;
  normalized_method text := upper(coalesce(p_payment_method, ''));
  amount_due numeric(12,2);
  next_collected numeric(12,2);
  next_status text;
  existing_history public.customer_order_payment_history%rowtype;
begin
  if p_actor_id is null or not exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager', 'seller', 'cashier')
  ) then
    raise exception 'ORDER_PERMISSION_DENIED';
  end if;

  if p_idempotency_key is null then
    raise exception 'PAYMENT_IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select * into existing_history
  from public.customer_order_payment_history history
  where history.organization_id = p_organization_id
    and history.idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'order_id', existing_history.order_id,
      'unchanged', true,
      'payment_status', existing_history.to_status,
      'collected_amount', existing_history.amount
    );
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'PAYMENT_AMOUNT_INVALID';
  end if;
  if normalized_method not in ('CASH', 'CARD', 'TRANSFER', 'DIGITAL_WALLET') then
    raise exception 'ORDER_PAYMENT_METHOD_INVALID';
  end if;
  if normalized_method in ('TRANSFER', 'CARD', 'DIGITAL_WALLET')
     and nullif(trim(p_payment_reference), '') is null then
    raise exception 'PAYMENT_REFERENCE_REQUIRED';
  end if;

  select * into order_row
  from public.customer_orders
  where id = p_order_id and organization_id = p_organization_id
  for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if order_row.status = 'CANCELLED' then raise exception 'ORDER_ALREADY_CANCELLED'; end if;
  if order_row.payment_status = 'REFUNDED' then raise exception 'ORDER_PAYMENT_ALREADY_REFUNDED'; end if;

  amount_due := greatest(
    0,
    order_row.total
      - coalesce(order_row.store_credit_reserved, 0)
      - coalesce(order_row.store_credit_applied, 0)
      - coalesce(order_row.collected_amount, 0)
  );
  if p_amount > amount_due then
    raise exception 'PAYMENT_EXCEEDS_AMOUNT_DUE';
  end if;

  next_collected := coalesce(order_row.collected_amount, 0) + p_amount;
  next_status := case
    when next_collected + coalesce(order_row.store_credit_reserved, 0)
         + coalesce(order_row.store_credit_applied, 0) >= order_row.total then 'PAID'
    else 'PARTIAL'
  end;

  update public.customer_orders
  set collected_amount = next_collected,
      payment_status = next_status,
      payment_method = normalized_method,
      updated_at = now()
  where id = order_row.id and organization_id = p_organization_id;

  insert into public.customer_order_payment_history (
    organization_id, order_id, from_status, to_status, payment_method,
    amount, payment_reference, note, changed_by, idempotency_key, created_at
  ) values (
    p_organization_id, order_row.id, order_row.payment_status, next_status,
    normalized_method, p_amount, nullif(trim(p_payment_reference), ''),
    nullif(trim(p_note), ''), p_actor_id, p_idempotency_key, now()
  );

  return jsonb_build_object(
    'order_id', order_row.id,
    'unchanged', false,
    'payment_status', next_status,
    'collected_amount', next_collected,
    'amount_due', greatest(0, amount_due - p_amount)
  );
end;
$$;

revoke all on function public.record_customer_order_collection_atomic(
  uuid, uuid, uuid, numeric, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.record_customer_order_collection_atomic(
  uuid, uuid, uuid, numeric, text, text, text, uuid
) to service_role;
