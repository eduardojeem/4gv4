-- Tenant-safe expense ledger, recurring obligations, immutable audit history,
-- and atomic cash-backed payments.

begin;

create extension if not exists pgcrypto;

-- Composite foreign keys below make organization/branch mismatches impossible.
create unique index if not exists finance_branches_organization_id_id_unique
  on public.branches (organization_id, id);

create unique index if not exists finance_cash_closures_scope_id_unique
  on public.cash_closures (organization_id, branch_id, id);

create or replace function public.current_organization_id()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  request_headers jsonb := '{}'::jsonb;
  requested_organization_id uuid;
  membership_count integer;
  sole_organization_id uuid;
begin
  if actor_id is null then
    return null;
  end if;

  begin
    request_headers := coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb,
      '{}'::jsonb
    );
    requested_organization_id := nullif(
      request_headers ->> 'x-organization-id',
      ''
    )::uuid;
  exception
    when invalid_text_representation or invalid_parameter_value then
      requested_organization_id := null;
  end;

  if requested_organization_id is not null and exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = requested_organization_id
      and membership.user_id = actor_id
      and membership.status = 'active'
  ) then
    return requested_organization_id;
  end if;

  select
    count(distinct membership.organization_id),
    (array_agg(membership.organization_id order by membership.created_at))[1]
  into membership_count, sole_organization_id
  from public.organization_members membership
  where membership.user_id = actor_id
    and membership.status = 'active';

  if membership_count = 1 then
    return sole_organization_id;
  end if;

  return null;
end;
$$;

revoke all on function public.current_organization_id()
from public, anon, authenticated;
grant execute on function public.current_organization_id() to authenticated;

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  category_type text not null default 'operating_expense'
    check (category_type in ('operating_expense', 'direct_cost', 'payroll', 'other')),
  scope text not null default 'organization'
    check (scope = 'organization'),
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, id),
  check (code = lower(trim(code)) and code ~ '^[a-z0-9_]+$'),
  check (char_length(trim(name)) between 1 and 120)
);

create table if not exists public.finance_expense_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  creation_idempotency_key text not null,
  category_id uuid not null,
  concept text not null,
  amount numeric(14, 2) not null check (amount > 0),
  vendor text,
  notes text,
  frequency text not null
    check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  starts_on date not null,
  ends_on date,
  due_days_after_accounting integer not null default 0
    check (due_days_after_accounting between 0 and 366),
  status text not null default 'active'
    check (status in ('active', 'paused', 'ended')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, branch_id, id),
  unique (organization_id, branch_id, creation_idempotency_key),
  constraint finance_expense_templates_branch_scope_fkey
    foreign key (organization_id, branch_id)
    references public.branches (organization_id, id) on delete restrict,
  constraint finance_expense_templates_category_scope_fkey
    foreign key (organization_id, category_id)
    references public.finance_categories (organization_id, id) on delete restrict,
  check (char_length(trim(concept)) between 1 and 200),
  check (char_length(trim(creation_idempotency_key)) between 1 and 128),
  check (vendor is null or char_length(trim(vendor)) between 1 and 200),
  check (notes is null or char_length(notes) <= 2000),
  check (ends_on is null or ends_on >= starts_on)
);

create table if not exists public.finance_obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  category_id uuid not null,
  template_id uuid,
  recurrence_period date,
  concept text not null,
  amount numeric(14, 2) not null check (amount > 0),
  paid_amount numeric(14, 2) not null default 0
    check (paid_amount >= 0 and paid_amount <= amount),
  currency text not null,
  vendor text,
  accounting_date date not null,
  due_date date,
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'partially_paid', 'paid', 'overdue', 'voided')),
  notes text,
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, branch_id, id),
  unique (organization_id, template_id, recurrence_period),
  constraint finance_obligations_branch_scope_fkey
    foreign key (organization_id, branch_id)
    references public.branches (organization_id, id) on delete restrict,
  constraint finance_obligations_category_scope_fkey
    foreign key (organization_id, category_id)
    references public.finance_categories (organization_id, id) on delete restrict,
  constraint finance_obligations_template_scope_fkey
    foreign key (organization_id, branch_id, template_id)
    references public.finance_expense_templates (organization_id, branch_id, id) on delete restrict,
  check ((template_id is null and recurrence_period is null)
    or (template_id is not null and recurrence_period is not null)),
  check (char_length(trim(concept)) between 1 and 200),
  check (char_length(currency) = 3 and currency = upper(currency)),
  check (vendor is null or char_length(trim(vendor)) between 1 and 200),
  check (notes is null or char_length(notes) <= 2000),
  check (due_date is null or due_date >= accounting_date),
  check (
    status <> 'voided'
    or (
      paid_amount = 0
      and voided_at is not null
      and char_length(trim(void_reason)) between 1 and 1000
    )
  )
);

create table if not exists public.finance_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  obligation_id uuid not null,
  idempotency_key text not null,
  direction text not null default 'payment'
    check (direction in ('payment', 'reversal')),
  reverses_payment_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  payment_method text not null
    check (payment_method in ('cash', 'bank_transfer', 'other')),
  payment_date date not null,
  cash_session_id uuid,
  reference text,
  receipt_storage_path text,
  receipt_original_name text,
  receipt_mime_type text,
  receipt_size_bytes bigint,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, branch_id, id),
  unique (organization_id, obligation_id, idempotency_key),
  constraint finance_payments_obligation_scope_fkey
    foreign key (organization_id, branch_id, obligation_id)
    references public.finance_obligations (organization_id, branch_id, id) on delete restrict,
  constraint finance_payments_reversal_scope_fkey
    foreign key (organization_id, branch_id, reverses_payment_id)
    references public.finance_payments (organization_id, branch_id, id) on delete restrict,
  constraint finance_payments_cash_session_scope_fkey
    foreign key (organization_id, branch_id, cash_session_id)
    references public.cash_closures (organization_id, branch_id, id) on delete restrict,
  check ((direction = 'payment' and reverses_payment_id is null)
    or (direction = 'reversal' and reverses_payment_id is not null)),
  check ((payment_method = 'cash' and cash_session_id is not null)
    or (payment_method <> 'cash' and cash_session_id is null)),
  check (char_length(trim(idempotency_key)) between 1 and 128),
  check (reference is null or char_length(trim(reference)) between 1 and 200),
  check (notes is null or char_length(notes) <= 2000),
  check (
    receipt_storage_path is null
    or (
      receipt_storage_path not like '%://%'
      and receipt_storage_path not like '/%'
      and receipt_storage_path like organization_id::text || '/%'
    )
  ),
  check (receipt_original_name is null or char_length(trim(receipt_original_name)) between 1 and 255),
  check (receipt_mime_type is null or receipt_mime_type in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
  )),
  check (receipt_size_bytes is null or receipt_size_bytes between 1 and 10485760),
  check (
    (
      receipt_storage_path is null and receipt_original_name is null
      and receipt_mime_type is null and receipt_size_bytes is null
    )
    or (
      receipt_storage_path is not null
      and receipt_original_name is not null
      and receipt_mime_type is not null
      and receipt_size_bytes is not null
    )
  )
);

create unique index if not exists finance_payments_one_reversal_per_payment
  on public.finance_payments (organization_id, branch_id, reverses_payment_id)
  where direction = 'reversal';
create index if not exists finance_payments_reversal_lookup_idx
  on public.finance_payments (organization_id, branch_id, reverses_payment_id);

create table if not exists public.finance_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_id uuid references auth.users(id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  occurred_at timestamptz not null default now(),
  constraint finance_audit_events_branch_scope_fkey
    foreign key (organization_id, branch_id)
    references public.branches (organization_id, id) on delete cascade,
  check (entity_type in (
    'finance_categories',
    'finance_expense_templates',
    'finance_obligations',
    'finance_payments'
  )),
  check (old_values is not null or new_values is not null)
);

alter table public.cash_movements
  add column if not exists finance_payment_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_record
    where constraint_record.conname = 'cash_movements_finance_payment_scope_fkey'
      and constraint_record.conrelid = 'public.cash_movements'::regclass
  ) then
    alter table public.cash_movements
      add constraint cash_movements_finance_payment_scope_fkey
      foreign key (organization_id, branch_id, finance_payment_id)
      references public.finance_payments (organization_id, branch_id, id)
      on delete restrict;
  end if;
end;
$$;

create unique index if not exists cash_movements_finance_payment_unique
  on public.cash_movements (organization_id, finance_payment_id)
  where finance_payment_id is not null;

create index if not exists finance_categories_organization_active_idx
  on public.finance_categories (organization_id, is_active, name);
create index if not exists finance_categories_created_by_idx
  on public.finance_categories (created_by) where created_by is not null;
create index if not exists finance_categories_updated_by_idx
  on public.finance_categories (updated_by) where updated_by is not null;
create index if not exists finance_expense_templates_scope_status_idx
  on public.finance_expense_templates (organization_id, branch_id, status, starts_on);
create index if not exists finance_expense_templates_category_idx
  on public.finance_expense_templates (organization_id, category_id);
create index if not exists finance_templates_created_by_idx
  on public.finance_expense_templates (created_by) where created_by is not null;
create index if not exists finance_templates_updated_by_idx
  on public.finance_expense_templates (updated_by) where updated_by is not null;
create index if not exists finance_templates_generation_idx
  on public.finance_expense_templates (starts_on, ends_on, organization_id, branch_id)
  where status = 'active';
create index if not exists finance_obligations_scope_due_status_idx
  on public.finance_obligations (organization_id, branch_id, due_date, status);
create index if not exists finance_obligations_organization_status_due_idx
  on public.finance_obligations (organization_id, status, due_date);
create index if not exists finance_obligations_category_accounting_idx
  on public.finance_obligations (organization_id, category_id, accounting_date);
create index if not exists finance_obligations_outstanding_due_idx
  on public.finance_obligations (organization_id, branch_id, due_date)
  where status in ('pending', 'partially_paid', 'overdue');
create index if not exists finance_obligations_voided_by_idx
  on public.finance_obligations (voided_by) where voided_by is not null;
create index if not exists finance_obligations_created_by_idx
  on public.finance_obligations (created_by) where created_by is not null;
create index if not exists finance_obligations_updated_by_idx
  on public.finance_obligations (updated_by) where updated_by is not null;
create index if not exists finance_payments_obligation_created_idx
  on public.finance_payments (organization_id, obligation_id, created_at);
create index if not exists finance_payments_scope_date_idx
  on public.finance_payments (organization_id, branch_id, payment_date);
create index if not exists finance_payments_cash_session_idx
  on public.finance_payments (cash_session_id)
  where cash_session_id is not null;
create index if not exists finance_payments_created_by_idx
  on public.finance_payments (created_by) where created_by is not null;
create index if not exists finance_audit_events_organization_occurred_idx
  on public.finance_audit_events (organization_id, occurred_at desc);
create index if not exists finance_audit_events_entity_idx
  on public.finance_audit_events (organization_id, entity_type, entity_id, occurred_at desc);
create index if not exists finance_audit_events_actor_idx
  on public.finance_audit_events (actor_id) where actor_id is not null;
create index if not exists finance_audit_events_branch_idx
  on public.finance_audit_events (organization_id, branch_id)
  where branch_id is not null;

create or replace function public.set_finance_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.protect_finance_template_idempotency_key()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.creation_idempotency_key is distinct from old.creation_idempotency_key then
    raise exception 'FINANCE_TEMPLATE_IDEMPOTENCY_KEY_IMMUTABLE';
  end if;
  return new;
end;
$$;

create or replace function public.validate_finance_obligation_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  stored_paid_amount numeric(14, 2);
  financial_identity_changed boolean := false;
  created_by_fk_nulling boolean := false;
  voided_by_fk_nulling boolean := false;
begin
  if tg_op = 'UPDATE' then
    created_by_fk_nulling := old.created_by is not null
      and new.created_by is null
      and not exists (
        select 1 from auth.users actor where actor.id = old.created_by
      );
    voided_by_fk_nulling := old.voided_by is not null
      and new.voided_by is null
      and not exists (
        select 1 from auth.users actor where actor.id = old.voided_by
      );
    financial_identity_changed :=
      new.id is distinct from old.id
      or new.organization_id is distinct from old.organization_id
      or new.branch_id is distinct from old.branch_id
      or new.category_id is distinct from old.category_id
      or new.template_id is distinct from old.template_id
      or new.recurrence_period is distinct from old.recurrence_period
      or new.concept is distinct from old.concept
      or new.amount is distinct from old.amount
      or new.currency is distinct from old.currency
      or new.vendor is distinct from old.vendor
      or new.accounting_date is distinct from old.accounting_date
      or new.due_date is distinct from old.due_date
      or new.notes is distinct from old.notes
      or new.created_at is distinct from old.created_at;

    if old.status = 'voided'
       and (
         new.status is distinct from old.status
         or financial_identity_changed
         or new.void_reason is distinct from old.void_reason
         or new.voided_at is distinct from old.voided_at
       ) then
      raise exception 'FINANCE_VOIDED_OBLIGATION_IS_TERMINAL';
    end if;

    if old.status = 'voided'
       and new.voided_by is distinct from old.voided_by
       and not voided_by_fk_nulling then
      raise exception 'FINANCE_VOIDED_OBLIGATION_ACTOR_IMMUTABLE';
    end if;
  end if;

  if new.currency is null then
    select settings.currency
    into new.currency
    from public.organization_settings settings
    where settings.organization_id = new.organization_id;

    new.currency := coalesce(new.currency, 'PYG');
  end if;

  if tg_op = 'INSERT' then
    if new.paid_amount <> 0 then
      raise exception 'FINANCE_INITIAL_PAID_AMOUNT_MUST_BE_ZERO';
    end if;
  elsif financial_identity_changed and exists (
    select 1
    from public.finance_payments payment
    where payment.organization_id = old.organization_id
      and payment.obligation_id = old.id
  ) then
    raise exception 'FINANCE_EVER_PAID_OBLIGATION_IMMUTABLE';
  end if;

  if tg_op = 'UPDATE' and exists (
    select 1
    from public.finance_payments payment
    where payment.organization_id = old.organization_id
      and payment.obligation_id = old.id
  ) then
    if new.created_by is distinct from old.created_by
       and not created_by_fk_nulling then
      raise exception 'FINANCE_EVER_PAID_OBLIGATION_ACTOR_IMMUTABLE';
    end if;
    if new.voided_by is distinct from old.voided_by
       and not voided_by_fk_nulling
       and not (
         old.status <> 'voided'
         and new.status = 'voided'
         and old.voided_by is null
         and new.voided_by is not null
       ) then
      raise exception 'FINANCE_EVER_PAID_OBLIGATION_ACTOR_IMMUTABLE';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.paid_amount is distinct from old.paid_amount then
    select coalesce(sum(
      case payment.direction
        when 'payment' then payment.amount
        else -payment.amount
      end
    ), 0)
    into stored_paid_amount
    from public.finance_payments payment
    where payment.organization_id = new.organization_id
      and payment.obligation_id = new.id;

    if new.paid_amount is distinct from stored_paid_amount then
      raise exception 'FINANCE_PAID_AMOUNT_MUST_MATCH_LEDGER';
    end if;
  end if;

  if new.status = 'paid' and new.paid_amount <> new.amount then
    raise exception 'FINANCE_PAID_STATUS_REQUIRES_FULL_PAYMENT';
  end if;
  if new.status = 'partially_paid'
     and not (new.paid_amount > 0 and new.paid_amount < new.amount) then
    raise exception 'FINANCE_PARTIAL_STATUS_REQUIRES_PARTIAL_PAYMENT';
  end if;
  if new.status in ('draft', 'pending', 'overdue') and new.paid_amount <> 0 then
    raise exception 'FINANCE_UNPAID_STATUS_REQUIRES_ZERO_PAYMENT';
  end if;
  if new.status = 'voided' and exists (
    select 1
    from public.finance_payments original_payment
    where original_payment.organization_id = new.organization_id
      and original_payment.obligation_id = new.id
      and original_payment.direction = 'payment'
      and not exists (
        select 1
        from public.finance_payments reversal
        where reversal.organization_id = original_payment.organization_id
          and reversal.branch_id = original_payment.branch_id
          and reversal.reverses_payment_id = original_payment.id
          and reversal.direction = 'reversal'
      )
  ) then
    raise exception 'FINANCE_VOID_REQUIRES_PAYMENT_COMPENSATION';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_paid_finance_obligation_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.paid_amount > 0 or exists (
    select 1
    from public.finance_payments payment
    where payment.organization_id = old.organization_id
      and payment.obligation_id = old.id
  ) then
    raise exception 'PAID_FINANCE_OBLIGATION_CANNOT_BE_DELETED';
  end if;

  return old;
end;
$$;

create or replace function public.validate_finance_payment_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_obligation public.finance_obligations%rowtype;
  original_payment public.finance_payments%rowtype;
  current_paid_amount numeric(14, 2);
begin
  select obligation.*
  into target_obligation
  from public.finance_obligations obligation
  where obligation.id = new.obligation_id
    and obligation.organization_id = new.organization_id
    and obligation.branch_id = new.branch_id
  for update;

  if not found then
    raise exception 'FINANCE_OBLIGATION_NOT_FOUND';
  end if;

  select coalesce(sum(
    case payment.direction
      when 'payment' then payment.amount
      else -payment.amount
    end
  ), 0)
  into current_paid_amount
  from public.finance_payments payment
  where payment.organization_id = new.organization_id
    and payment.obligation_id = new.obligation_id;

  if new.direction = 'payment' then
    if target_obligation.status in ('draft', 'paid', 'voided') then
      raise exception 'FINANCE_OBLIGATION_NOT_PAYABLE';
    end if;
    if current_paid_amount + new.amount > target_obligation.amount then
      raise exception 'FINANCE_OVERPAYMENT';
    end if;
  else
    select payment.*
    into original_payment
    from public.finance_payments payment
    where payment.id = new.reverses_payment_id
      and payment.organization_id = new.organization_id
      and payment.branch_id = new.branch_id
      and payment.obligation_id = new.obligation_id
      and payment.direction = 'payment'
    for update;

    if not found then
      raise exception 'FINANCE_PAYMENT_TO_REVERSE_NOT_FOUND';
    end if;
    if new.amount <> original_payment.amount
       or new.payment_method <> original_payment.payment_method then
      raise exception 'FINANCE_REVERSAL_MUST_FULLY_COMPENSATE_PAYMENT';
    end if;
    if current_paid_amount - new.amount < 0 then
      raise exception 'FINANCE_REVERSAL_EXCEEDS_PAID_AMOUNT';
    end if;
  end if;

  if new.payment_method = 'cash' then
    perform 1
    from public.cash_closures session
    join public.cash_registers register
      on register.id::text = session.register_id
     and register.organization_id = session.organization_id
     and register.branch_id = session.branch_id
    where session.id = new.cash_session_id
      and session.organization_id = new.organization_id
      and session.branch_id = new.branch_id
      and session.date is null
      and register.is_active = true
    for update of session, register;

    if not found then
      raise exception 'OPEN_CASH_SESSION_NOT_FOUND';
    end if;
  elsif new.cash_session_id is not null then
    raise exception 'NON_CASH_PAYMENT_CANNOT_USE_CASH_SESSION';
  end if;

  return new;
end;
$$;

create or replace function public.sync_finance_obligation_from_payment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  net_paid_amount numeric(14, 2);
begin
  select coalesce(sum(
    case payment.direction
      when 'payment' then payment.amount
      else -payment.amount
    end
  ), 0)
  into net_paid_amount
  from public.finance_payments payment
  where payment.organization_id = new.organization_id
    and payment.obligation_id = new.obligation_id;

  update public.finance_obligations obligation
  set paid_amount = net_paid_amount,
      status = case
        when net_paid_amount = obligation.amount then 'paid'
        when net_paid_amount > 0 then 'partially_paid'
        when obligation.due_date is not null and obligation.due_date < current_date then 'overdue'
        else 'pending'
      end,
      updated_by = new.created_by,
      updated_at = now()
  where obligation.id = new.obligation_id
    and obligation.organization_id = new.organization_id
    and obligation.branch_id = new.branch_id;

  return new;
end;
$$;

create or replace function public.post_finance_cash_movement_from_payment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  obligation_concept text;
begin
  if new.payment_method <> 'cash' then
    return new;
  end if;

  select obligation.concept
  into obligation_concept
  from public.finance_obligations obligation
  where obligation.id = new.obligation_id
    and obligation.organization_id = new.organization_id
    and obligation.branch_id = new.branch_id;

  insert into public.cash_movements (
    session_id,
    type,
    amount,
    reason,
    payment_method,
    created_by,
    created_at,
    organization_id,
    branch_id,
    finance_payment_id
  ) values (
    new.cash_session_id,
    case when new.direction = 'payment' then 'cash_out' else 'cash_in' end,
    new.amount,
    left(
      case when new.direction = 'payment'
        then 'Pago de gasto: '
        else 'Compensacion por anulacion: '
      end || obligation_concept,
      500
    ),
    'cash',
    new.created_by,
    now(),
    new.organization_id,
    new.branch_id,
    new.id
  );

  update public.cash_closures
  set last_activity_at = now(), updated_at = now()
  where id = new.cash_session_id
    and organization_id = new.organization_id
    and branch_id = new.branch_id;

  return new;
end;
$$;

create or replace function public.protect_finance_cash_movement()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.finance_payment_id is not null
     or (tg_op = 'UPDATE' and new.finance_payment_id is not null) then
    raise exception 'FINANCE_CASH_MOVEMENT_IS_IMMUTABLE';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.validate_finance_cash_movement_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.finance_payment_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.finance_payments payment
    where payment.id = new.finance_payment_id
      and payment.organization_id = new.organization_id
      and payment.branch_id = new.branch_id
      and payment.payment_method = 'cash'
      and payment.cash_session_id = new.session_id
      and payment.amount = new.amount
      and new.payment_method = 'cash'
      and new.type = case
        when payment.direction = 'payment' then 'cash_out'
        else 'cash_in'
      end
      and new.created_by is not distinct from payment.created_by
  ) then
    raise exception 'FINANCE_CASH_MOVEMENT_DOES_NOT_MATCH_PAYMENT';
  end if;

  return new;
end;
$$;

create or replace function public.record_finance_audit_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  row_values jsonb;
  target_organization_id uuid;
  target_branch_id uuid;
  target_entity_id uuid;
  target_actor_id uuid;
  actor_fk_nulling_only boolean := false;
begin
  if tg_op = 'DELETE' and not exists (
    select 1
    from public.organizations organization
    where organization.id = old.organization_id
  ) then
    return old;
  end if;

  if tg_op = 'UPDATE' then
    actor_fk_nulling_only :=
      to_jsonb(new) - 'created_by' - 'updated_by' - 'voided_by' - 'updated_at'
        = to_jsonb(old) - 'created_by' - 'updated_by' - 'voided_by' - 'updated_at'
      and (
        (
          (to_jsonb(old) ->> 'created_by') is not null
          and (to_jsonb(new) ->> 'created_by') is null
          and not exists (
            select 1 from auth.users actor
            where actor.id = (to_jsonb(old) ->> 'created_by')::uuid
          )
        )
        or (
          (to_jsonb(old) ->> 'updated_by') is not null
          and (to_jsonb(new) ->> 'updated_by') is null
          and not exists (
            select 1 from auth.users actor
            where actor.id = (to_jsonb(old) ->> 'updated_by')::uuid
          )
        )
        or (
          (to_jsonb(old) ->> 'voided_by') is not null
          and (to_jsonb(new) ->> 'voided_by') is null
          and not exists (
            select 1 from auth.users actor
            where actor.id = (to_jsonb(old) ->> 'voided_by')::uuid
          )
        )
      )
      and not (
        (to_jsonb(new) ->> 'created_by') is distinct from (to_jsonb(old) ->> 'created_by')
        and not ((to_jsonb(old) ->> 'created_by') is not null and (to_jsonb(new) ->> 'created_by') is null)
      )
      and not (
        (to_jsonb(new) ->> 'updated_by') is distinct from (to_jsonb(old) ->> 'updated_by')
        and not ((to_jsonb(old) ->> 'updated_by') is not null and (to_jsonb(new) ->> 'updated_by') is null)
      )
      and not (
        (to_jsonb(new) ->> 'voided_by') is distinct from (to_jsonb(old) ->> 'voided_by')
        and not ((to_jsonb(old) ->> 'voided_by') is not null and (to_jsonb(new) ->> 'voided_by') is null)
      );

    if actor_fk_nulling_only then
      return new;
    end if;
  end if;

  row_values := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_organization_id := (row_values ->> 'organization_id')::uuid;
  target_branch_id := nullif(row_values ->> 'branch_id', '')::uuid;
  target_entity_id := (row_values ->> 'id')::uuid;
  target_actor_id := coalesce(
    auth.uid(),
    nullif(row_values ->> 'updated_by', '')::uuid,
    nullif(row_values ->> 'created_by', '')::uuid
  );

  insert into public.finance_audit_events (
    organization_id,
    branch_id,
    entity_type,
    entity_id,
    action,
    actor_id,
    old_values,
    new_values
  ) values (
    target_organization_id,
    target_branch_id,
    tg_table_name,
    target_entity_id,
    lower(tg_op),
    target_actor_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.prevent_finance_audit_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE'
     and tg_table_name = 'finance_payments'
     and old.created_by is not null
     and new.created_by is null
     and to_jsonb(new) - 'created_by' = to_jsonb(old) - 'created_by'
     and not exists (
       select 1 from auth.users actor where actor.id = old.created_by
     ) then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and tg_table_name = 'finance_audit_events'
     and old.actor_id is not null
     and new.actor_id is null
     and to_jsonb(new) - 'actor_id' = to_jsonb(old) - 'actor_id'
     and not exists (
       select 1 from auth.users actor where actor.id = old.actor_id
     ) then
    return new;
  end if;

  if tg_op = 'DELETE'
     and tg_table_name = 'finance_audit_events'
     and (
       not exists (
         select 1
         from public.organizations organization
         where organization.id = old.organization_id
       )
       or (
         old.branch_id is not null
         and not exists (
           select 1
           from public.branches branch
           where branch.organization_id = old.organization_id
             and branch.id = old.branch_id
         )
       )
     ) then
    return old;
  end if;

  raise exception 'FINANCE_AUDIT_EVENTS_ARE_APPEND_ONLY';
end;
$$;

drop trigger if exists finance_categories_updated_at on public.finance_categories;
create trigger finance_categories_updated_at
before update on public.finance_categories
for each row execute function public.set_finance_updated_at();

drop trigger if exists finance_expense_templates_updated_at on public.finance_expense_templates;
create trigger finance_expense_templates_updated_at
before update on public.finance_expense_templates
for each row execute function public.set_finance_updated_at();

drop trigger if exists finance_expense_templates_protect_idempotency on public.finance_expense_templates;
create trigger finance_expense_templates_protect_idempotency
before update on public.finance_expense_templates
for each row execute function public.protect_finance_template_idempotency_key();

drop trigger if exists finance_obligations_validate_state on public.finance_obligations;
create trigger finance_obligations_validate_state
before insert or update on public.finance_obligations
for each row execute function public.validate_finance_obligation_state();

drop trigger if exists finance_obligations_prevent_paid_delete on public.finance_obligations;
create trigger finance_obligations_prevent_paid_delete
before delete on public.finance_obligations
for each row execute function public.prevent_paid_finance_obligation_delete();

drop trigger if exists finance_obligations_updated_at on public.finance_obligations;
create trigger finance_obligations_updated_at
before update on public.finance_obligations
for each row execute function public.set_finance_updated_at();

drop trigger if exists finance_payments_validate_insert on public.finance_payments;
create trigger finance_payments_validate_insert
before insert on public.finance_payments
for each row execute function public.validate_finance_payment_insert();

drop trigger if exists finance_payments_sync_obligation on public.finance_payments;
create trigger finance_payments_sync_obligation
after insert on public.finance_payments
for each row execute function public.sync_finance_obligation_from_payment();

drop trigger if exists finance_payments_post_cash_movement on public.finance_payments;
create trigger finance_payments_post_cash_movement
after insert on public.finance_payments
for each row execute function public.post_finance_cash_movement_from_payment();

drop trigger if exists finance_payments_append_only on public.finance_payments;
create trigger finance_payments_append_only
before update or delete on public.finance_payments
for each row execute function public.prevent_finance_audit_event_mutation();

drop trigger if exists cash_movements_protect_finance_link on public.cash_movements;
create trigger cash_movements_protect_finance_link
before update or delete on public.cash_movements
for each row execute function public.protect_finance_cash_movement();

drop trigger if exists cash_movements_validate_finance_insert on public.cash_movements;
create trigger cash_movements_validate_finance_insert
before insert on public.cash_movements
for each row execute function public.validate_finance_cash_movement_insert();

drop trigger if exists finance_audit_events_append_only on public.finance_audit_events;
create trigger finance_audit_events_append_only
before update or delete on public.finance_audit_events
for each row execute function public.prevent_finance_audit_event_mutation();

drop trigger if exists finance_categories_audit on public.finance_categories;
create trigger finance_categories_audit
after insert or update or delete on public.finance_categories
for each row execute function public.record_finance_audit_event();

drop trigger if exists finance_expense_templates_audit on public.finance_expense_templates;
create trigger finance_expense_templates_audit
after insert or update or delete on public.finance_expense_templates
for each row execute function public.record_finance_audit_event();

drop trigger if exists finance_obligations_audit on public.finance_obligations;
create trigger finance_obligations_audit
after insert or update or delete on public.finance_obligations
for each row execute function public.record_finance_audit_event();

drop trigger if exists finance_payments_audit on public.finance_payments;
create trigger finance_payments_audit
after insert on public.finance_payments
for each row execute function public.record_finance_audit_event();

create or replace function public.seed_default_finance_categories(
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_organization_id is null or not exists (
    select 1 from public.organizations organization
    where organization.id = p_organization_id
  ) then
    raise exception 'FINANCE_ORGANIZATION_NOT_FOUND';
  end if;

  insert into public.finance_categories (
    organization_id,
    code,
    name,
    category_type,
    scope,
    is_system
  )
  values
    (p_organization_id, 'rent', 'Alquiler', 'operating_expense', 'organization', true),
    (p_organization_id, 'electricity', 'Electricidad / ANDE', 'operating_expense', 'organization', true),
    (p_organization_id, 'water', 'Agua / ESSAP', 'operating_expense', 'organization', true),
    (p_organization_id, 'internet', 'Internet', 'operating_expense', 'organization', true),
    (p_organization_id, 'telephony', 'Telefonia', 'operating_expense', 'organization', true),
    (p_organization_id, 'taxes_fees', 'Impuestos y tasas', 'operating_expense', 'organization', true),
    (p_organization_id, 'suppliers_purchases', 'Proveedores y compras', 'operating_expense', 'organization', true),
    (p_organization_id, 'marketing', 'Marketing', 'operating_expense', 'organization', true),
    (p_organization_id, 'maintenance', 'Mantenimiento', 'operating_expense', 'organization', true),
    (p_organization_id, 'transport', 'Transporte', 'operating_expense', 'organization', true),
    (p_organization_id, 'software_subscriptions', 'Software y suscripciones', 'operating_expense', 'organization', true),
    (p_organization_id, 'bank_fees', 'Comisiones bancarias', 'operating_expense', 'organization', true),
    (p_organization_id, 'other', 'Otros', 'other', 'organization', true)
  on conflict (organization_id, code) do nothing;
end;
$$;

create or replace function public.seed_default_finance_categories_for_organization()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.seed_default_finance_categories(new.id);
  return new;
end;
$$;

drop trigger if exists organizations_seed_default_finance_categories on public.organizations;
create trigger organizations_seed_default_finance_categories
after insert on public.organizations
for each row execute function public.seed_default_finance_categories_for_organization();

select public.seed_default_finance_categories(organization.id)
from public.organizations organization;

create or replace function public.create_recurring_finance_obligation_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_category_id uuid,
  p_concept text,
  p_amount numeric,
  p_vendor text,
  p_notes text,
  p_frequency text,
  p_starts_on date,
  p_ends_on date,
  p_due_days_after_accounting integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  existing_template public.finance_expense_templates%rowtype;
  created_template public.finance_expense_templates%rowtype;
  created_obligation public.finance_obligations%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not (
    public.has_org_permission(p_organization_id, 'finances.manage')
    or public.get_user_role(actor_id) = 'super_admin'
  ) then
    raise exception 'FINANCE_RECURRING_PERMISSION_DENIED';
  end if;
  if not public.user_has_branch_access(p_branch_id, actor_id) then
    raise exception 'FINANCE_BRANCH_PERMISSION_DENIED';
  end if;
  if not exists (
    select 1 from public.branches branch
    where branch.id = p_branch_id
      and branch.organization_id = p_organization_id
      and branch.is_active = true
  ) then
    raise exception 'FINANCE_BRANCH_NOT_IN_ORGANIZATION';
  end if;
  if not exists (
    select 1 from public.finance_categories category
    where category.id = p_category_id
      and category.organization_id = p_organization_id
      and category.is_active = true
  ) then
    raise exception 'FINANCE_CATEGORY_INVALID';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
     or char_length(trim(p_idempotency_key)) > 128
     or lower(trim(p_idempotency_key)) like 'finance-system:%' then
    raise exception 'FINANCE_INVALID_IDEMPOTENCY_KEY';
  end if;
  if nullif(trim(p_concept), '') is null or char_length(trim(p_concept)) > 200
     or p_amount is null or p_amount <= 0 or p_amount > 999999999999.99
     or p_amount <> trunc(p_amount, 2)
     or p_frequency not in ('weekly', 'monthly', 'quarterly', 'yearly')
     or p_starts_on is null
     or (p_ends_on is not null and p_ends_on < p_starts_on)
     or p_due_days_after_accounting not between 0 and 366 then
    raise exception 'FINANCE_INVALID_RECURRING_OBLIGATION';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':' || p_branch_id::text || ':' || trim(p_idempotency_key),
    0
  ));

  select template.* into existing_template
  from public.finance_expense_templates template
  where template.organization_id = p_organization_id
    and template.branch_id = p_branch_id
    and template.creation_idempotency_key = trim(p_idempotency_key);

  if found then
    if existing_template.category_id is distinct from p_category_id
       or existing_template.concept is distinct from trim(p_concept)
       or existing_template.amount is distinct from p_amount
       or existing_template.vendor is distinct from nullif(trim(p_vendor), '')
       or existing_template.notes is distinct from nullif(left(trim(p_notes), 2000), '')
       or existing_template.frequency is distinct from p_frequency
       or existing_template.starts_on is distinct from p_starts_on
       or existing_template.ends_on is distinct from p_ends_on
       or existing_template.due_days_after_accounting is distinct from p_due_days_after_accounting then
      raise exception 'FINANCE_RECURRING_IDEMPOTENCY_KEY_REUSED';
    end if;

    select obligation.* into created_obligation
    from public.finance_obligations obligation
    where obligation.organization_id = p_organization_id
      and obligation.branch_id = p_branch_id
      and obligation.template_id = existing_template.id
      and obligation.recurrence_period = p_starts_on;

    return jsonb_build_object(
      'template', to_jsonb(existing_template),
      'obligation', to_jsonb(created_obligation)
    );
  end if;

  insert into public.finance_expense_templates (
    organization_id, branch_id, creation_idempotency_key, category_id,
    concept, amount, vendor, notes, frequency, starts_on, ends_on,
    due_days_after_accounting, status, created_by, updated_by
  ) values (
    p_organization_id, p_branch_id, trim(p_idempotency_key), p_category_id,
    trim(p_concept), p_amount, nullif(trim(p_vendor), ''),
    nullif(left(trim(p_notes), 2000), ''), p_frequency, p_starts_on, p_ends_on,
    p_due_days_after_accounting, 'active', actor_id, actor_id
  ) returning * into created_template;

  insert into public.finance_obligations (
    organization_id, branch_id, category_id, template_id, recurrence_period,
    concept, amount, vendor, accounting_date, due_date, status, notes,
    created_by, updated_by
  ) values (
    p_organization_id, p_branch_id, p_category_id, created_template.id, p_starts_on,
    trim(p_concept), p_amount, nullif(trim(p_vendor), ''), p_starts_on,
    p_starts_on + p_due_days_after_accounting,
    case when p_starts_on + p_due_days_after_accounting < current_date
      then 'overdue' else 'pending' end,
    nullif(left(trim(p_notes), 2000), ''), actor_id, actor_id
  ) returning * into created_obligation;

  return jsonb_build_object(
    'template', to_jsonb(created_template),
    'obligation', to_jsonb(created_obligation)
  );
end;
$$;

create or replace function public.generate_recurring_finance_obligations(
  p_generation_date date,
  p_organization_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  template_record public.finance_expense_templates%rowtype;
  target_period date;
  target_accounting_date date;
  elapsed_months integer;
  cadence_months integer;
  inserted_count integer := 0;
  current_insert_count integer;
begin
  if p_generation_date is null then
    raise exception 'FINANCE_GENERATION_DATE_REQUIRED';
  end if;
  if p_organization_id is null then
    raise exception 'FINANCE_ORGANIZATION_REQUIRED';
  end if;
  if actor_id is not null and not (
    public.has_org_permission(p_organization_id, 'finances.manage')
    or public.get_user_role(actor_id) = 'super_admin'
  ) then
    raise exception 'FINANCE_GENERATION_PERMISSION_DENIED';
  end if;

  for template_record in
    select template.*
    from public.finance_expense_templates template
    where template.status = 'active'
      and template.starts_on <= p_generation_date
      and (template.ends_on is null or template.ends_on >= p_generation_date)
      and template.organization_id = p_organization_id
      and (
        actor_id is null
        or public.user_has_branch_access(template.branch_id, actor_id)
      )
    order by template.organization_id, template.id
  loop
    if template_record.frequency = 'weekly' then
      target_period := template_record.starts_on
        + (((p_generation_date - template_record.starts_on) / 7) * 7);
    else
      cadence_months := case template_record.frequency
        when 'monthly' then 1
        when 'quarterly' then 3
        when 'yearly' then 12
      end;
      elapsed_months := (
        (extract(year from p_generation_date)::integer
          - extract(year from template_record.starts_on)::integer) * 12
        + extract(month from p_generation_date)::integer
        - extract(month from template_record.starts_on)::integer
      );
      elapsed_months := (elapsed_months / cadence_months) * cadence_months;
      target_period := (
        template_record.starts_on + make_interval(months => elapsed_months)
      )::date;

      if target_period > p_generation_date then
        elapsed_months := elapsed_months - cadence_months;
        target_period := (
          template_record.starts_on + make_interval(months => elapsed_months)
        )::date;
      end if;
    end if;
    target_accounting_date := target_period;

    perform pg_advisory_xact_lock(hashtextextended(
      template_record.organization_id::text
        || ':' || template_record.id::text
        || ':' || target_period::text,
      0
    ));

    insert into public.finance_obligations (
      organization_id,
      branch_id,
      category_id,
      template_id,
      recurrence_period,
      concept,
      amount,
      vendor,
      accounting_date,
      due_date,
      status,
      notes,
      created_by
    ) values (
      template_record.organization_id,
      template_record.branch_id,
      template_record.category_id,
      template_record.id,
      target_period,
      template_record.concept,
      template_record.amount,
      template_record.vendor,
      target_accounting_date,
      target_accounting_date + template_record.due_days_after_accounting,
      case
        when target_accounting_date + template_record.due_days_after_accounting < p_generation_date
          then 'overdue'
        else 'pending'
      end,
      template_record.notes,
      coalesce(actor_id, template_record.created_by)
    )
    on conflict (organization_id, template_id, recurrence_period) do nothing;

    get diagnostics current_insert_count = row_count;
    inserted_count := inserted_count + current_insert_count;
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.generate_all_recurring_finance_obligations(
  p_generation_date date
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  organization_record record;
  inserted_count integer := 0;
begin
  if auth.uid() is not null then
    raise exception 'FINANCE_GLOBAL_GENERATION_SERVICE_ONLY';
  end if;
  if p_generation_date is null then
    raise exception 'FINANCE_GENERATION_DATE_REQUIRED';
  end if;

  for organization_record in
    select distinct template.organization_id
    from public.finance_expense_templates template
    where template.status = 'active'
      and template.starts_on <= p_generation_date
      and (template.ends_on is null or template.ends_on >= p_generation_date)
    order by template.organization_id
  loop
    inserted_count := inserted_count
      + public.generate_recurring_finance_obligations(
        p_generation_date,
        organization_record.organization_id
      );
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.pay_finance_obligation_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_obligation_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_idempotency_key text,
  p_cash_session_id uuid default null,
  p_reference text default null,
  p_receipt_storage_path text default null,
  p_receipt_original_name text default null,
  p_receipt_mime_type text default null,
  p_receipt_size_bytes bigint default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  target_obligation public.finance_obligations%rowtype;
  created_payment public.finance_payments%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not (
    public.has_org_permission(p_organization_id, 'finances.pay')
    or public.get_user_role(actor_id) = 'super_admin'
  ) then
    raise exception 'FINANCE_PAYMENT_PERMISSION_DENIED';
  end if;
  if not public.user_has_branch_access(p_branch_id) then
    raise exception 'FINANCE_BRANCH_PERMISSION_DENIED';
  end if;
  if not exists (
    select 1
    from public.branches branch
    where branch.id = p_branch_id
      and branch.organization_id = p_organization_id
      and branch.is_active = true
  ) then
    raise exception 'FINANCE_BRANCH_NOT_IN_ORGANIZATION';
  end if;
  if p_amount is null
     or p_amount <= 0
     or p_amount > 999999999999.99
     or p_amount <> trunc(p_amount, 2) then
    raise exception 'FINANCE_INVALID_PAYMENT_AMOUNT';
  end if;
  if p_payment_method not in ('cash', 'bank_transfer', 'other') then
    raise exception 'FINANCE_INVALID_PAYMENT_METHOD';
  end if;
  if p_payment_date is null then
    raise exception 'FINANCE_PAYMENT_DATE_REQUIRED';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
     or char_length(trim(p_idempotency_key)) > 128
     or lower(trim(p_idempotency_key)) like 'finance-system:%' then
    raise exception 'FINANCE_INVALID_IDEMPOTENCY_KEY';
  end if;

  select obligation.*
  into target_obligation
  from public.finance_obligations obligation
  where obligation.id = p_obligation_id
    and obligation.organization_id = p_organization_id
    and obligation.branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'FINANCE_OBLIGATION_NOT_FOUND';
  end if;

  select payment.*
  into created_payment
  from public.finance_payments payment
  where payment.organization_id = p_organization_id
    and payment.obligation_id = p_obligation_id
    and payment.idempotency_key = trim(p_idempotency_key)
    and payment.branch_id = p_branch_id
    and payment.direction = 'payment'
    and payment.amount = p_amount
    and payment.payment_method = p_payment_method
    and payment.payment_date = p_payment_date
    and payment.cash_session_id is not distinct from p_cash_session_id
    and payment.reference is not distinct from nullif(left(trim(p_reference), 200), '')
    and payment.receipt_storage_path is not distinct from nullif(trim(p_receipt_storage_path), '')
    and payment.receipt_original_name is not distinct from nullif(left(trim(p_receipt_original_name), 255), '')
    and payment.receipt_mime_type is not distinct from nullif(lower(trim(p_receipt_mime_type)), '')
    and payment.receipt_size_bytes is not distinct from p_receipt_size_bytes
    and payment.notes is not distinct from nullif(left(trim(p_notes), 2000), '');

  if found then
    return jsonb_build_object(
      'payment', to_jsonb(created_payment),
      'obligation', to_jsonb(target_obligation)
    );
  end if;

  if exists (
    select 1
    from public.finance_payments payment
    where payment.organization_id = p_organization_id
      and payment.obligation_id = p_obligation_id
      and payment.idempotency_key = trim(p_idempotency_key)
  ) then
    raise exception 'FINANCE_IDEMPOTENCY_KEY_REUSED';
  end if;

  if target_obligation.status in ('draft', 'paid', 'voided') then
    raise exception 'FINANCE_OBLIGATION_NOT_PAYABLE';
  end if;
  if p_amount > target_obligation.amount - target_obligation.paid_amount then
    raise exception 'FINANCE_OVERPAYMENT';
  end if;

  if p_payment_method = 'cash' then
    perform 1
    from public.cash_closures session
    join public.cash_registers register
      on register.id::text = session.register_id
     and register.organization_id = session.organization_id
     and register.branch_id = session.branch_id
    where session.id = p_cash_session_id
      and session.organization_id = p_organization_id
      and session.branch_id = p_branch_id
      and session.date is null
      and register.is_active = true
    for update of session, register;

    if not found then
      raise exception 'OPEN_CASH_SESSION_NOT_FOUND';
    end if;
  elsif p_cash_session_id is not null then
    raise exception 'NON_CASH_PAYMENT_CANNOT_USE_CASH_SESSION';
  end if;

  insert into public.finance_payments (
    organization_id,
    branch_id,
    obligation_id,
    idempotency_key,
    direction,
    amount,
    payment_method,
    payment_date,
    cash_session_id,
    reference,
    receipt_storage_path,
    receipt_original_name,
    receipt_mime_type,
    receipt_size_bytes,
    notes,
    created_by
  ) values (
    p_organization_id,
    p_branch_id,
    p_obligation_id,
    trim(p_idempotency_key),
    'payment',
    p_amount,
    p_payment_method,
    p_payment_date,
    p_cash_session_id,
    nullif(left(trim(p_reference), 200), ''),
    nullif(trim(p_receipt_storage_path), ''),
    nullif(left(trim(p_receipt_original_name), 255), ''),
    nullif(lower(trim(p_receipt_mime_type)), ''),
    p_receipt_size_bytes,
    nullif(left(trim(p_notes), 2000), ''),
    actor_id
  )
  returning * into created_payment;

  return jsonb_build_object(
    'payment', to_jsonb(created_payment),
    'obligation', (
      select to_jsonb(updated_obligation)
      from public.finance_obligations updated_obligation
      where updated_obligation.id = p_obligation_id
        and updated_obligation.organization_id = p_organization_id
    )
  );
end;
$$;

create or replace function public.void_finance_obligation_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_obligation_id uuid,
  p_reason text,
  p_cash_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  target_obligation public.finance_obligations%rowtype;
  original_payment public.finance_payments%rowtype;
  has_cash_compensation boolean;
begin
  if actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not (
    public.has_org_permission(p_organization_id, 'finances.void')
    or public.get_user_role(actor_id) = 'super_admin'
  ) then
    raise exception 'FINANCE_VOID_PERMISSION_DENIED';
  end if;
  if not public.user_has_branch_access(p_branch_id) then
    raise exception 'FINANCE_BRANCH_PERMISSION_DENIED';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'FINANCE_VOID_REASON_REQUIRED';
  end if;

  select obligation.*
  into target_obligation
  from public.finance_obligations obligation
  where obligation.id = p_obligation_id
    and obligation.organization_id = p_organization_id
    and obligation.branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'FINANCE_OBLIGATION_NOT_FOUND';
  end if;
  if target_obligation.status = 'voided' then
    return to_jsonb(target_obligation);
  end if;

  select exists (
    select 1
    from public.finance_payments payment
    where payment.organization_id = p_organization_id
      and payment.obligation_id = p_obligation_id
      and payment.direction = 'payment'
      and payment.payment_method = 'cash'
      and not exists (
        select 1
        from public.finance_payments reversal
        where reversal.organization_id = payment.organization_id
          and reversal.branch_id = payment.branch_id
          and reversal.reverses_payment_id = payment.id
      )
  ) into has_cash_compensation;

  if has_cash_compensation then
    perform 1
    from public.cash_closures session
    join public.cash_registers register
      on register.id::text = session.register_id
     and register.organization_id = session.organization_id
     and register.branch_id = session.branch_id
    where session.id = p_cash_session_id
      and session.organization_id = p_organization_id
      and session.branch_id = p_branch_id
      and session.date is null
      and register.is_active = true
    for update of session, register;

    if not found then
      raise exception 'OPEN_CASH_SESSION_NOT_FOUND';
    end if;
  elsif p_cash_session_id is not null then
    raise exception 'CASH_SESSION_ONLY_ALLOWED_FOR_CASH_COMPENSATION';
  end if;

  for original_payment in
    select payment.*
    from public.finance_payments payment
    where payment.organization_id = p_organization_id
      and payment.branch_id = p_branch_id
      and payment.obligation_id = p_obligation_id
      and payment.direction = 'payment'
      and not exists (
        select 1
        from public.finance_payments existing_reversal
        where existing_reversal.organization_id = payment.organization_id
          and existing_reversal.branch_id = payment.branch_id
          and existing_reversal.reverses_payment_id = payment.id
      )
    order by payment.created_at, payment.id
  loop
    insert into public.finance_payments (
      organization_id,
      branch_id,
      obligation_id,
      idempotency_key,
      direction,
      reverses_payment_id,
      amount,
      payment_method,
      payment_date,
      cash_session_id,
      reference,
      notes,
      created_by
    ) values (
      p_organization_id,
      p_branch_id,
      p_obligation_id,
      'finance-system:reversal:' || original_payment.id::text,
      'reversal',
      original_payment.id,
      original_payment.amount,
      original_payment.payment_method,
      current_date,
      case when original_payment.payment_method = 'cash' then p_cash_session_id else null end,
      left('Reversion de pago ' || original_payment.id::text, 200),
      left(trim(p_reason), 2000),
      actor_id
    );
  end loop;

  update public.finance_obligations
  set status = 'voided',
      paid_amount = 0,
      void_reason = left(trim(p_reason), 1000),
      voided_at = now(),
      voided_by = actor_id,
      updated_by = actor_id,
      updated_at = now()
  where id = p_obligation_id
    and organization_id = p_organization_id
    and branch_id = p_branch_id
  returning * into target_obligation;

  return to_jsonb(target_obligation);
end;
$$;

alter table public.finance_categories enable row level security;
alter table public.finance_expense_templates enable row level security;
alter table public.finance_obligations enable row level security;
alter table public.finance_payments enable row level security;
alter table public.finance_audit_events enable row level security;

drop policy if exists "Enable select for authenticated users only" on public.cash_movements;
drop policy if exists "Usuarios autenticados ven movimientos" on public.cash_movements;
drop policy if exists "Usuarios autenticados pueden ver movimientos de caja" on public.cash_movements;
drop policy if exists "solo usuarios autenticados pueden leer" on public.cash_movements;
drop policy if exists "tenant members can read cash movements" on public.cash_movements;
drop policy if exists "cash_movements_select_org" on public.cash_movements;
drop policy if exists cash_movements_select_staff on public.cash_movements;
drop policy if exists cash_movements_write_staff on public.cash_movements;
drop policy if exists "cash_movements_update_staff" on public.cash_movements;
drop policy if exists "cash_movements_delete_admin" on public.cash_movements;
drop policy if exists "tenant members can update cash movements" on public.cash_movements;
drop policy if exists "tenant members can delete cash movements" on public.cash_movements;
drop policy if exists "Admin/Vendedores crean movimientos" on public.cash_movements;
drop policy if exists "Enable insert for authenticated users only" on public.cash_movements;
drop policy if exists "cash_movements_insert_staff" on public.cash_movements;

create policy cash_movements_authenticated_source_guard
on public.cash_movements
as restrictive
for insert
to authenticated
with check (finance_payment_id is null);

create policy cash_movements_finance_aware_read
on public.cash_movements
for select
to authenticated
using (
  (
    finance_payment_id is null
    and (
      public.has_org_permission(organization_id, 'pos.cash.manage')
      or public.has_org_permission(organization_id, 'pos.sales.read')
      or public.has_org_permission(organization_id, 'pos.sales.create')
    )
  )
  or (
    finance_payment_id is not null
    and public.has_org_permission(organization_id, 'finances.read')
  )
);

create policy cash_movements_legacy_update
on public.cash_movements
for update
to authenticated
using (
  finance_payment_id is null
  and public.has_org_permission(organization_id, 'pos.cash.manage')
)
with check (
  finance_payment_id is null
  and public.has_org_permission(organization_id, 'pos.cash.manage')
);

create policy cash_movements_legacy_delete
on public.cash_movements
for delete
to authenticated
using (
  finance_payment_id is null
  and public.has_org_permission(organization_id, 'pos.cash.manage')
);

drop policy if exists finance_categories_read on public.finance_categories;
create policy finance_categories_read
on public.finance_categories
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and organization_id = public.current_organization_id()
);

drop policy if exists finance_expense_templates_read on public.finance_expense_templates;
create policy finance_expense_templates_read
on public.finance_expense_templates
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and public.user_has_branch_access(branch_id)
  and organization_id = public.current_organization_id()
);

drop policy if exists finance_obligations_read on public.finance_obligations;
create policy finance_obligations_read
on public.finance_obligations
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and public.user_has_branch_access(branch_id)
  and organization_id = public.current_organization_id()
);

drop policy if exists finance_payments_read on public.finance_payments;
create policy finance_payments_read
on public.finance_payments
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and public.user_has_branch_access(branch_id)
  and organization_id = public.current_organization_id()
);

drop policy if exists finance_audit_events_read on public.finance_audit_events;
create policy finance_audit_events_read
on public.finance_audit_events
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and (branch_id is null or public.user_has_branch_access(branch_id))
  and organization_id = public.current_organization_id()
);

revoke all on table public.finance_categories from public, anon, authenticated;
revoke all on table public.finance_expense_templates from public, anon, authenticated;
revoke all on table public.finance_obligations from public, anon, authenticated;
revoke all on table public.finance_payments from public, anon, authenticated;
revoke all on table public.finance_audit_events from public, anon, authenticated;

grant select on table public.finance_categories to authenticated;
grant select on table public.finance_expense_templates to authenticated;
grant select on table public.finance_obligations to authenticated;
grant select on table public.finance_payments to authenticated;
grant select on table public.finance_audit_events to authenticated;

revoke all on table public.finance_categories from service_role;
revoke all on table public.finance_expense_templates from service_role;
revoke all on table public.finance_obligations from service_role;
revoke all on table public.finance_payments from service_role;
revoke all on table public.finance_audit_events from service_role;

grant select, insert, update, delete on table public.finance_categories to service_role;
grant select, insert, update, delete on table public.finance_expense_templates to service_role;
grant select, insert, update, delete on table public.finance_obligations to service_role;
grant select, insert on table public.finance_payments to service_role;
grant select on table public.finance_audit_events to service_role;

revoke all on function public.create_recurring_finance_obligation_atomic(
  uuid, uuid, uuid, text, numeric, text, text, text, date, date, integer, text
) from public, anon, authenticated;
grant execute on function public.create_recurring_finance_obligation_atomic(
  uuid, uuid, uuid, text, numeric, text, text, text, date, date, integer, text
) to authenticated;

revoke all on function public.generate_recurring_finance_obligations(date, uuid)
from public, anon, authenticated;
grant execute on function public.generate_recurring_finance_obligations(date, uuid)
to authenticated, service_role;

revoke all on function public.generate_all_recurring_finance_obligations(date)
from public, anon, authenticated;
grant execute on function public.generate_all_recurring_finance_obligations(date)
to service_role;

revoke all on function public.pay_finance_obligation_atomic(
  uuid, uuid, uuid, numeric, text, date, text, uuid, text, text, text, text, bigint, text
) from public, anon, authenticated;
grant execute on function public.pay_finance_obligation_atomic(
  uuid, uuid, uuid, numeric, text, date, text, uuid, text, text, text, text, bigint, text
) to authenticated;

revoke all on function public.void_finance_obligation_atomic(uuid, uuid, uuid, text, uuid)
from public, anon, authenticated;
grant execute on function public.void_finance_obligation_atomic(uuid, uuid, uuid, text, uuid)
to authenticated;

revoke all on function public.seed_default_finance_categories(uuid)
from public, anon, authenticated;
grant execute on function public.seed_default_finance_categories(uuid) to service_role;

revoke all on function public.set_finance_updated_at()
from public, anon, authenticated;
revoke all on function public.protect_finance_template_idempotency_key()
from public, anon, authenticated;
revoke all on function public.validate_finance_obligation_state()
from public, anon, authenticated;
revoke all on function public.prevent_paid_finance_obligation_delete()
from public, anon, authenticated;
revoke all on function public.validate_finance_payment_insert()
from public, anon, authenticated;
revoke all on function public.sync_finance_obligation_from_payment()
from public, anon, authenticated;
revoke all on function public.post_finance_cash_movement_from_payment()
from public, anon, authenticated;
revoke all on function public.protect_finance_cash_movement()
from public, anon, authenticated;
revoke all on function public.validate_finance_cash_movement_insert()
from public, anon, authenticated;
revoke all on function public.record_finance_audit_event()
from public, anon, authenticated;
revoke all on function public.prevent_finance_audit_event_mutation()
from public, anon, authenticated;
revoke all on function public.seed_default_finance_categories_for_organization()
from public, anon, authenticated;

revoke all on table public.cash_movements from authenticated;
grant select, insert, update, delete on table public.cash_movements to authenticated;
revoke all on table public.cash_movements from service_role;
grant select, insert, update, delete on table public.cash_movements to service_role;

commit;
