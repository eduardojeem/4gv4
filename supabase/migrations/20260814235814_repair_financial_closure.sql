begin;

alter table public.repairs
  add column if not exists delivery_idempotency_key text;

create unique index if not exists repairs_delivery_idempotency_org_key
  on public.repairs (organization_id, delivery_idempotency_key)
  where delivery_idempotency_key is not null;

create table if not exists public.repair_payments (
  id uuid primary key default gen_random_uuid(),
  repair_id uuid not null references public.repairs(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer', 'credit', 'mixed')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 120),
  source text not null check (source in ('repairs', 'delivery', 'pos', 'migration')),
  reference text,
  notes text,
  cash_session_id uuid references public.cash_closures(id) on delete set null,
  credit_id uuid references public.customer_credits(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index if not exists repair_payments_repair_created_idx
  on public.repair_payments (repair_id, created_at desc);
create index if not exists repair_payments_org_branch_created_idx
  on public.repair_payments (organization_id, branch_id, created_at desc);

alter table public.repair_payments enable row level security;

revoke all on table public.repair_payments from public, anon;
revoke insert, update, delete on public.repair_payments from anon, authenticated;
grant select on table public.repair_payments to authenticated;
grant all on table public.repair_payments to service_role;

drop policy if exists "tenant members can read repair payments" on public.repair_payments;
create policy "tenant members can read repair payments"
on public.repair_payments
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'repairs.orders.read')
  or public.has_org_permission(organization_id, 'repairs.orders.update')
);

comment on table public.repair_payments is
  'Immutable ledger of payments applied to repairs. repairs.paid_amount is the compatible summary.';

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
  p_source text default 'repairs'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_repair public.repairs%rowtype;
  existing_payment public.repair_payments%rowtype;
  resolved_total numeric(12, 2);
  resolved_parts_price numeric(12, 2);
  resolved_paid numeric(12, 2);
  resolved_amount numeric(12, 2);
  resolved_balance numeric(12, 2);
  resolved_payment_status text;
  created_payment_id uuid;
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

  if p_source not in ('repairs', 'delivery', 'pos') then
    raise exception 'REPAIR_PAYMENT_SOURCE_INVALID';
  end if;

  select payment.*
  into existing_payment
  from public.repair_payments payment
  where payment.organization_id = p_organization_id
    and payment.idempotency_key = trim(p_idempotency_key)
  limit 1;

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

  if existing_payment.id is not null then
    if existing_payment.repair_id <> p_repair_id then
      raise exception 'REPAIR_IDEMPOTENCY_CONFLICT';
    end if;
    resolved_total := greatest(0, coalesce(target_repair.final_cost, target_repair.estimated_cost, 0));
    resolved_paid := greatest(0, coalesce(target_repair.paid_amount, 0));
    return jsonb_build_object(
      'repair_id', target_repair.id,
      'payment_id', existing_payment.id,
      'idempotent', true,
      'total', resolved_total,
      'paid_amount', resolved_paid,
      'balance', greatest(0, resolved_total - resolved_paid),
      'payment_status', target_repair.payment_status,
      'delivered', target_repair.status = 'entregado'
    );
  end if;

  if p_deliver and target_repair.status = 'entregado' then
    if target_repair.delivery_idempotency_key = trim(p_idempotency_key) then
      resolved_total := greatest(0, coalesce(target_repair.final_cost, target_repair.estimated_cost, 0));
      resolved_paid := greatest(0, coalesce(target_repair.paid_amount, 0));
      return jsonb_build_object(
        'repair_id', target_repair.id,
        'payment_id', null,
        'idempotent', true,
        'total', resolved_total,
        'paid_amount', resolved_paid,
        'balance', greatest(0, resolved_total - resolved_paid),
        'payment_status', target_repair.payment_status,
        'delivered', true
      );
    end if;
    raise exception 'REPAIR_ALREADY_DELIVERED';
  end if;

  if p_deliver and target_repair.status <> 'listo' then
    raise exception 'REPAIR_DELIVERY_INVALID_STATE';
  end if;

  if not p_deliver and target_repair.status = 'cancelado' then
    raise exception 'REPAIR_PAYMENT_INVALID_STATE';
  end if;

  if p_deliver and p_delivery_outcome not in ('repaired', 'withdrawn', 'unrepairable') then
    raise exception 'REPAIR_DELIVERY_OUTCOME_INVALID';
  end if;

  select coalesce(sum(coalesce(part.unit_price, part.unit_cost, 0) * greatest(part.quantity, 0)), 0)
  into resolved_parts_price
  from public.repair_parts part
  where part.repair_id = target_repair.id;

  if coalesce(target_repair.pricing_mode, 'automatic') = 'automatic' then
    resolved_total := greatest(
      0,
      coalesce(target_repair.labor_cost, 0)
        + resolved_parts_price
        - coalesce(target_repair.discount_amount, 0)
    );
  else
    if target_repair.final_cost is null then
      raise exception 'REPAIR_FINAL_COST_REQUIRED';
    end if;
    resolved_total := greatest(0, target_repair.final_cost);
  end if;

  resolved_paid := greatest(0, coalesce(target_repair.paid_amount, 0));
  resolved_amount := greatest(0, coalesce(p_payment_amount, 0));

  if p_payment_method is null and resolved_amount > 0 then
    raise exception 'REPAIR_PAYMENT_METHOD_REQUIRED';
  end if;
  if p_payment_method is not null and p_payment_method not in ('cash', 'card', 'transfer', 'credit') then
    raise exception 'REPAIR_PAYMENT_METHOD_INVALID';
  end if;
  if p_payment_method is not null and resolved_amount <= 0 then
    raise exception 'REPAIR_PAYMENT_AMOUNT_INVALID';
  end if;
  if resolved_amount > greatest(0, resolved_total - resolved_paid) then
    raise exception 'REPAIR_PAYMENT_EXCEEDS_BALANCE';
  end if;
  if p_payment_method = 'credit' and resolved_amount <> greatest(0, resolved_total - resolved_paid) then
    raise exception 'REPAIR_CREDIT_MUST_COVER_BALANCE';
  end if;
  if not p_deliver and resolved_amount <= 0 then
    raise exception 'REPAIR_PAYMENT_AMOUNT_INVALID';
  end if;

  resolved_paid := resolved_paid + resolved_amount;
  resolved_balance := greatest(0, resolved_total - resolved_paid);
  resolved_payment_status := case
    when resolved_balance <= 0 then 'pagado'
    when resolved_paid > 0 then 'parcial'
    else 'pendiente'
  end;

  if p_deliver and resolved_balance > 0 and not p_allow_outstanding_balance then
    raise exception 'REPAIR_OUTSTANDING_CONFIRMATION_REQUIRED';
  end if;

  if resolved_amount > 0 and p_payment_method <> 'credit' then
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
  end if;

  if resolved_amount > 0 then
    insert into public.repair_payments (
      repair_id, organization_id, branch_id, amount, payment_method,
      idempotency_key, source, reference, notes, cash_session_id,
      credit_id, sale_id, created_by, created_at
    ) values (
      target_repair.id, p_organization_id, p_branch_id, resolved_amount,
      p_payment_method, trim(p_idempotency_key), p_source,
      nullif(trim(coalesce(p_payment_reference, '')), ''),
      nullif(trim(coalesce(p_payment_note, '')), ''),
      p_cash_session_id, p_credit_id, p_sale_id, p_actor_id, operation_time
    ) returning id into created_payment_id;

    if p_payment_method <> 'credit' then
      insert into public.cash_movements (
        session_id, type, amount, reason, payment_method, created_by,
        created_at, organization_id, branch_id
      ) values (
        p_cash_session_id, 'cash_in', resolved_amount,
        'Cobro reparación ' || coalesce(target_repair.ticket_number, target_repair.id::text),
        p_payment_method, p_actor_id, operation_time, p_organization_id, p_branch_id
      );
    end if;
  end if;

  update public.repairs
  set final_cost = resolved_total,
      estimated_cost = resolved_total,
      paid_amount = resolved_paid,
      payment_status = resolved_payment_status,
      status = case when p_deliver then 'entregado' else status end,
      picked_up_at = case when p_deliver then operation_time else picked_up_at end,
      delivered_at = case when p_deliver then operation_time else delivered_at end,
      completed_at = case when p_deliver then coalesce(completed_at, operation_time) else completed_at end,
      delivery_outcome = case when p_deliver then p_delivery_outcome else delivery_outcome end,
      solution = case
        when p_deliver and nullif(trim(coalesce(p_delivery_note, '')), '') is not null
          then trim(p_delivery_note)
        else solution
      end,
      warranty_expires_at = case
        when p_deliver and coalesce(warranty_months, 0) > 0
          then operation_time + make_interval(months => warranty_months)
        when p_deliver then null
        else warranty_expires_at
      end,
      delivery_idempotency_key = case
        when p_deliver then trim(p_idempotency_key)
        else delivery_idempotency_key
      end,
      updated_at = operation_time
  where id = target_repair.id
    and organization_id = p_organization_id
    and branch_id = p_branch_id;

  if resolved_amount > 0 then
    insert into public.repair_notes (
      repair_id, author_id, author_name, note_text, is_internal, created_at
    ) values (
      target_repair.id, p_actor_id, 'Sistema',
      case when p_payment_method = 'credit' then 'Cobro a crédito: ' else 'Pago registrado: ' end
        || resolved_amount::text || ' | Método: ' || p_payment_method,
      true, operation_time
    );
  end if;

  return jsonb_build_object(
    'repair_id', target_repair.id,
    'payment_id', created_payment_id,
    'idempotent', false,
    'total', resolved_total,
    'paid_amount', resolved_paid,
    'balance', resolved_balance,
    'payment_status', resolved_payment_status,
    'delivered', p_deliver
  );
end;
$$;

revoke all on function public.close_repair_and_register_payment(
  uuid, uuid, uuid, uuid, boolean, text, text, boolean, text, numeric,
  text, text, text, uuid, uuid, uuid, text
) from public;
revoke all on function public.close_repair_and_register_payment(
  uuid, uuid, uuid, uuid, boolean, text, text, boolean, text, numeric,
  text, text, text, uuid, uuid, uuid, text
) from anon, authenticated;
grant execute on function public.close_repair_and_register_payment(
  uuid, uuid, uuid, uuid, boolean, text, text, boolean, text, numeric,
  text, text, text, uuid, uuid, uuid, text
) to service_role;

create or replace function public.capture_pos_repair_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_sale_id uuid;
  resolved_sale public.sales%rowtype;
  resolved_method text;
  payment_delta numeric(12, 2);
begin
  if new.status = 'entregado' and old.status is distinct from 'entregado' then
    if old.status <> 'listo' then
      raise exception 'REPAIR_DELIVERY_INVALID_STATE';
    end if;
    if new.delivery_outcome not in ('repaired', 'withdrawn', 'unrepairable') then
      raise exception 'REPAIR_DELIVERY_OUTCOME_INVALID';
    end if;
    new.warranty_expires_at := case
      when coalesce(new.warranty_months, 0) > 0
        then coalesce(new.delivered_at, now()) + make_interval(months => new.warranty_months)
      else null
    end;
  end if;

  payment_delta := greatest(0, coalesce(new.paid_amount, 0) - coalesce(old.paid_amount, 0));
  if payment_delta <= 0 then
    return new;
  end if;

  begin
    resolved_sale_id := substring(
      new.problem_description
      from 'Venta relacionada #([0-9a-fA-F-]{36})'
    )::uuid;
  exception when others then
    resolved_sale_id := null;
  end;

  if resolved_sale_id is null then
    return new;
  end if;

  select sale.*
  into resolved_sale
  from public.sales sale
  where sale.id = resolved_sale_id
    and sale.organization_id = new.organization_id;

  if not found then
    raise exception 'REPAIR_POS_SALE_NOT_FOUND';
  end if;

  resolved_method := case lower(coalesce(resolved_sale.payment_method, ''))
    when 'cash' then 'cash'
    when 'efectivo' then 'cash'
    when 'card' then 'card'
    when 'tarjeta' then 'card'
    when 'transfer' then 'transfer'
    when 'transferencia' then 'transfer'
    when 'credit' then 'credit'
    when 'credito' then 'credit'
    when 'crédito' then 'credit'
    else 'mixed'
  end;

  insert into public.repair_payments (
    repair_id, organization_id, branch_id, amount, payment_method,
    idempotency_key, source, sale_id, created_by, created_at
  ) values (
    new.id, new.organization_id, new.branch_id, payment_delta, resolved_method,
    'pos:' || resolved_sale_id::text || ':' || new.id::text,
    'pos', resolved_sale_id, resolved_sale.created_by, now()
  ) on conflict (organization_id, idempotency_key) do nothing;

  return new;
end;
$$;

revoke all on function public.capture_pos_repair_payment() from public, anon, authenticated;
grant execute on function public.capture_pos_repair_payment() to service_role;

drop trigger if exists capture_pos_repair_payment_trigger on public.repairs;
create trigger capture_pos_repair_payment_trigger
before update of paid_amount, status on public.repairs
for each row
execute function public.capture_pos_repair_payment();

commit;
