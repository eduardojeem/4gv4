begin;

alter table public.sale_payments
  add column if not exists branch_id uuid references public.branches(id) on delete restrict,
  add column if not exists channel text,
  add column if not exists provider text,
  add column if not exists institution text,
  add column if not exists terminal_id text,
  add column if not exists reconciliation_status text not null default 'pending',
  add column if not exists fee_amount numeric(14, 2) not null default 0,
  add column if not exists net_amount numeric(14, 2) generated always as (greatest(amount - fee_amount, 0)) stored,
  add column if not exists settled_at timestamptz,
  add column if not exists reconciled_at timestamptz,
  add column if not exists reconciled_by uuid references auth.users(id) on delete set null,
  add column if not exists reconciliation_notes text,
  add column if not exists updated_at timestamptz not null default now();

update public.sale_payments payment
set branch_id = sale.branch_id
from public.sales sale
where sale.id = payment.sale_id
  and payment.branch_id is null;

update public.sale_payments
set
  channel = case payment_method
    when 'cash' then 'cash'
    when 'card' then 'card_terminal'
    when 'transfer' then 'bank_transfer'
    when 'credit' then 'credit'
    else 'other'
  end,
  reconciliation_status = case
    when payment_method in ('card', 'transfer') then 'pending'
    else 'not_applicable'
  end
where channel is null
   or reconciliation_status not in ('pending', 'confirmed', 'rejected', 'refunded', 'disputed', 'not_applicable');

alter table public.sale_payments
  drop constraint if exists sale_payments_channel_check,
  drop constraint if exists sale_payments_reconciliation_status_check,
  drop constraint if exists sale_payments_fee_amount_check;

alter table public.sale_payments
  add constraint sale_payments_channel_check
    check (channel in ('cash', 'card_terminal', 'bank_transfer', 'qr', 'credit', 'other')),
  add constraint sale_payments_reconciliation_status_check
    check (reconciliation_status in ('pending', 'confirmed', 'rejected', 'refunded', 'disputed', 'not_applicable')),
  add constraint sale_payments_fee_amount_check
    check (fee_amount >= 0 and fee_amount <= amount);

create index if not exists idx_sale_payments_reconciliation_queue
  on public.sale_payments (organization_id, branch_id, reconciliation_status, created_at desc);

create unique index if not exists idx_sale_payments_provider_reference_unique
  on public.sale_payments (organization_id, lower(provider), reference)
  where provider is not null
    and reference is not null
    and payment_method in ('card', 'transfer');

create table if not exists public.sale_payment_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  sale_payment_id uuid not null references public.sale_payments(id) on delete cascade,
  previous_status text,
  new_status text not null,
  fee_amount numeric(14, 2) not null default 0,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_sale_payment_reconciliation_events_payment
  on public.sale_payment_reconciliation_events (sale_payment_id, created_at desc);

alter table public.sale_payment_reconciliation_events enable row level security;

drop policy if exists sale_payments_branch_scope on public.sale_payments;
create policy sale_payments_branch_scope
on public.sale_payments
as restrictive
for all to authenticated
using (public.user_has_branch_access(branch_id))
with check (public.user_has_branch_access(branch_id));

drop policy if exists sale_payment_reconciliation_events_branch_scope
  on public.sale_payment_reconciliation_events;
create policy sale_payment_reconciliation_events_branch_scope
on public.sale_payment_reconciliation_events
as restrictive
for all to authenticated
using (public.user_has_branch_access(branch_id))
with check (public.user_has_branch_access(branch_id));

drop policy if exists "tenant members can read payment reconciliation events"
  on public.sale_payment_reconciliation_events;
create policy "tenant members can read payment reconciliation events"
on public.sale_payment_reconciliation_events for select to authenticated
using (
  public.has_org_permission(organization_id, 'pos.cash.manage')
  or public.has_org_permission(organization_id, 'pos.sales.read')
);

drop policy if exists "cash managers can update sale payments" on public.sale_payments;
create policy "cash managers can update sale payments"
on public.sale_payments for update to authenticated
using (public.has_org_permission(organization_id, 'pos.cash.manage'))
with check (public.has_org_permission(organization_id, 'pos.cash.manage'));

grant select on public.sale_payment_reconciliation_events to authenticated;
grant all on public.sale_payment_reconciliation_events to service_role;

create or replace function public.apply_pos_payment_metadata_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_sale_id uuid,
  p_actor_id uuid,
  p_payments jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payment record;
begin
  if not exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_actor_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager', 'cashier', 'technician', 'seller')
  ) then
    raise exception 'POS_PERMISSION_DENIED';
  end if;

  if not exists (
    select 1 from public.sales sale
    where sale.id = p_sale_id
      and sale.organization_id = p_organization_id
      and sale.branch_id = p_branch_id
  ) then
    raise exception 'SALE_NOT_IN_POS_SCOPE';
  end if;

  for payment in
    select
      entry.ordinality - 1 as payment_index,
      lower(trim(entry.value->>'payment_method')) as payment_method,
      nullif(left(trim(entry.value->>'provider'), 120), '') as provider,
      nullif(left(trim(entry.value->>'institution'), 120), '') as institution,
      nullif(left(trim(entry.value->>'terminal_id'), 80), '') as terminal_id,
      case lower(trim(entry.value->>'channel'))
        when 'qr' then 'qr'
        when 'bank_transfer' then 'bank_transfer'
        when 'card_terminal' then 'card_terminal'
        else null
      end as requested_channel
    from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) with ordinality entry(value, ordinality)
  loop
    update public.sale_payments stored
    set
      branch_id = p_branch_id,
      channel = coalesce(payment.requested_channel, case payment.payment_method
        when 'cash' then 'cash'
        when 'card' then 'card_terminal'
        when 'transfer' then 'bank_transfer'
        when 'credit' then 'credit'
        else 'other'
      end),
      provider = coalesce(payment.provider, case payment.payment_method when 'card' then 'Terminal POS' else null end),
      institution = payment.institution,
      terminal_id = payment.terminal_id,
      reconciliation_status = case
        when payment.payment_method in ('card', 'transfer') then 'pending'
        else 'not_applicable'
      end,
      updated_at = now()
    where stored.organization_id = p_organization_id
      and stored.sale_id = p_sale_id
      and stored.payment_index = payment.payment_index;
  end loop;
end;
$$;

create or replace function public.reconcile_sale_payment_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_payment_id uuid,
  p_status text,
  p_fee_amount numeric default 0,
  p_provider text default null,
  p_institution text default null,
  p_channel text default null,
  p_terminal_id text default null,
  p_notes text default null,
  p_settled_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_payment public.sale_payments%rowtype;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_org_permission(p_organization_id, 'pos.cash.manage') then
    raise exception 'Insufficient cash permissions';
  end if;
  if not public.user_has_branch_access(p_branch_id) then
    raise exception 'Insufficient branch permissions';
  end if;
  if p_status not in ('pending', 'confirmed', 'rejected', 'refunded', 'disputed') then
    raise exception 'INVALID_RECONCILIATION_STATUS';
  end if;

  select * into target_payment
  from public.sale_payments payment
  where payment.id = p_payment_id
    and payment.organization_id = p_organization_id
    and payment.branch_id = p_branch_id
    and payment.payment_method in ('card', 'transfer')
  for update;

  if not found then
    raise exception 'ELECTRONIC_PAYMENT_NOT_FOUND';
  end if;
  if coalesce(p_fee_amount, 0) < 0 or coalesce(p_fee_amount, 0) > target_payment.amount then
    raise exception 'INVALID_PAYMENT_FEE';
  end if;
  if p_channel is not null and p_channel not in ('card_terminal', 'bank_transfer', 'qr', 'other') then
    raise exception 'INVALID_PAYMENT_CHANNEL';
  end if;
  if target_payment.payment_method = 'card'
     and p_channel is not null
     and p_channel not in ('card_terminal', 'other') then
    raise exception 'INVALID_PAYMENT_CHANNEL';
  end if;
  if target_payment.payment_method = 'transfer'
     and p_channel is not null
     and p_channel not in ('bank_transfer', 'qr', 'other') then
    raise exception 'INVALID_PAYMENT_CHANNEL';
  end if;

  update public.sale_payments
  set
    reconciliation_status = p_status,
    fee_amount = coalesce(p_fee_amount, 0),
    provider = nullif(left(trim(p_provider), 120), ''),
    institution = nullif(left(trim(p_institution), 120), ''),
    channel = coalesce(p_channel, channel),
    terminal_id = nullif(left(trim(p_terminal_id), 80), ''),
    reconciliation_notes = nullif(left(trim(p_notes), 1000), ''),
    settled_at = case when p_status = 'confirmed' then coalesce(p_settled_at, now()) else p_settled_at end,
    reconciled_at = now(),
    reconciled_by = actor_id,
    updated_at = now()
  where id = target_payment.id;

  insert into public.sale_payment_reconciliation_events (
    organization_id, branch_id, sale_payment_id, previous_status,
    new_status, fee_amount, notes, created_by
  ) values (
    p_organization_id, p_branch_id, target_payment.id, target_payment.reconciliation_status,
    p_status, coalesce(p_fee_amount, 0), nullif(left(trim(p_notes), 1000), ''), actor_id
  );

  return (
    select to_jsonb(updated_payment)
    from public.sale_payments updated_payment
    where updated_payment.id = target_payment.id
  );
end;
$$;

revoke all on function public.apply_pos_payment_metadata_atomic(uuid, uuid, uuid, uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.apply_pos_payment_metadata_atomic(uuid, uuid, uuid, uuid, jsonb)
to service_role;

revoke all on function public.reconcile_sale_payment_atomic(
  uuid, uuid, uuid, text, numeric, text, text, text, text, text, timestamptz
) from public, anon;
grant execute on function public.reconcile_sale_payment_atomic(
  uuid, uuid, uuid, text, numeric, text, text, text, text, text, timestamptz
) to authenticated;

commit;
