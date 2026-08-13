-- Organization-wide payroll, effective-dated compensation and commissions,
-- immutable approval history, and atomic payroll cash posting.

begin;

create extension if not exists pgcrypto;

-- Task 2 creates these composite keys. Keep the migration independently safe
-- when a partially provisioned environment already has the base tables.
create unique index if not exists payroll_branches_organization_id_id_unique
  on public.branches (organization_id, id);
create unique index if not exists payroll_cash_closures_scope_id_unique
  on public.cash_closures (organization_id, branch_id, id);
create unique index if not exists payroll_organization_members_scope_unique
  on public.organization_members (organization_id, user_id);

create table if not exists public.employee_compensation (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  employee_id uuid not null,
  base_salary numeric(14, 2) not null default 0 check (base_salary >= 0),
  pay_frequency text not null default 'monthly'
    check (pay_frequency in ('monthly')),
  effective_from date not null,
  effective_to date,
  legacy_source_id uuid,
  legacy_cutover_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint employee_compensation_employee_scope_fkey
    foreign key (organization_id, employee_id)
    references public.organization_members (organization_id, user_id) on delete restrict,
  check (effective_to is null or effective_to >= effective_from),
  check (
    (legacy_source_id is null and legacy_cutover_on is null)
    or (legacy_source_id is not null and legacy_cutover_on is not null)
  )
);

create unique index if not exists employee_compensation_legacy_source_unique
  on public.employee_compensation (organization_id, legacy_source_id)
  where legacy_source_id is not null;

create table if not exists public.employee_employment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  employee_id uuid not null,
  employee_role public.organization_role not null,
  employment_status text not null check (employment_status in ('active', 'invited', 'suspended')),
  occurred_at timestamptz not null,
  capture_basis text not null default 'live_transition'
    check (capture_basis in ('live_transition', 'cutover_best_available')),
  source_membership_id uuid,
  source_event text,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint employee_employment_events_employee_scope_fkey
    foreign key (organization_id, employee_id)
    references public.organization_members (organization_id, user_id) on delete restrict,
  check (
    (source_membership_id is null and source_event is null)
    or (
      source_membership_id is not null
      and source_event in ('cutover-current', 'cutover-suspended')
    )
  )
);

create unique index if not exists employee_employment_events_cutover_unique
  on public.employee_employment_events (
    organization_id,
    source_membership_id,
    source_event
  ) where source_membership_id is not null;

create table if not exists public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid,
  scope_type text not null check (scope_type in ('role', 'employee')),
  role public.organization_role,
  employee_id uuid,
  source_type text not null
    check (source_type in ('sale', 'product', 'category', 'repair', 'repair_labor')),
  source_reference_id uuid,
  accrual_status text check (accrual_status in ('listo', 'entregado')),
  calculation_type text not null
    check (calculation_type in ('percentage', 'fixed')),
  value numeric(14, 2) not null check (value >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'retired')),
  effective_from date not null,
  effective_to date,
  legacy_source_id uuid,
  legacy_component text,
  legacy_cutover_on date,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint commission_rules_branch_scope_fkey
    foreign key (organization_id, branch_id)
    references public.branches (organization_id, id) on delete restrict,
  constraint commission_rules_employee_scope_fkey
    foreign key (organization_id, employee_id)
    references public.organization_members (organization_id, user_id) on delete restrict,
  check (
    (scope_type = 'role' and role is not null and employee_id is null)
    or (scope_type = 'employee' and employee_id is not null and role is null)
  ),
  check (
    (source_type in ('product', 'category') and source_reference_id is not null)
    or (source_type not in ('product', 'category') and source_reference_id is null)
  ),
  check (
    (source_type in ('repair', 'repair_labor') and accrual_status is not null)
    or (source_type not in ('repair', 'repair_labor') and accrual_status is null)
  ),
  check (calculation_type <> 'percentage' or value <= 100),
  check (effective_to is null or effective_to >= effective_from),
  check (
    (status = 'approved' and approved_at is not null)
    or status <> 'approved'
  ),
  check (
    (legacy_source_id is null and legacy_component is null and legacy_cutover_on is null)
    or (
      legacy_source_id is not null
      and legacy_component in ('percentage', 'fixed')
      and legacy_cutover_on is not null
    )
  )
);

create unique index if not exists commission_rules_legacy_source_unique
  on public.commission_rules (organization_id, legacy_source_id, legacy_component)
  where legacy_source_id is not null;

-- Immutable operation-time attribution avoids recalculating old commissions
-- with a member's current role or employment status.
create table if not exists public.commission_operation_attributions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  source_type text not null check (source_type in ('sale', 'repair')),
  source_id uuid not null,
  accrual_status text check (accrual_status in ('listo', 'entregado')),
  employee_id uuid not null,
  employee_role public.organization_role not null,
  occurred_at timestamptz not null,
  basis_amount numeric(14, 2) not null default 0 check (basis_amount >= 0),
  labor_basis_amount numeric(14, 2) not null default 0 check (labor_basis_amount >= 0),
  capture_basis text not null default 'live_event'
    check (capture_basis in ('live_event', 'cutover_current_membership')),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint commission_operation_attributions_branch_scope_fkey
    foreign key (organization_id, branch_id)
    references public.branches (organization_id, id) on delete restrict,
  constraint commission_operation_attributions_employee_scope_fkey
    foreign key (organization_id, employee_id)
    references public.organization_members (organization_id, user_id) on delete restrict,
  check (employee_role <> 'customer'),
  check (
    (source_type = 'sale' and accrual_status is null)
    or (source_type = 'repair' and accrual_status is not null)
  )
);

create unique index if not exists commission_operation_attributions_origin_unique
  on public.commission_operation_attributions (
    organization_id,
    source_type,
    source_id,
    coalesce(accrual_status, 'sale')
  );

-- Immutable sale-item facts used by product/category commission rules. The
-- payroll materializer must never re-read editable line items or products.
create table if not exists public.commission_sale_item_attributions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  sale_id uuid not null,
  sale_item_id uuid not null,
  product_id uuid,
  category_id uuid,
  quantity numeric(14, 4) not null check (quantity > 0),
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  occurred_at timestamptz not null,
  capture_basis text not null default 'live_event'
    check (capture_basis in ('live_event', 'cutover_best_available')),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, sale_item_id),
  constraint commission_sale_item_attributions_branch_scope_fkey
    foreign key (organization_id, branch_id)
    references public.branches (organization_id, id) on delete restrict
);

create table if not exists public.earned_commissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  employee_id uuid not null,
  commission_rule_id uuid not null,
  entry_kind text not null check (entry_kind in ('accrual', 'reversal')),
  source_type text not null
    check (source_type in ('sale', 'product', 'category', 'repair', 'repair_labor')),
  origin_type text not null
    check (origin_type in ('sale', 'sale_item', 'repair', 'after_sales', 'terminal_status')),
  origin_id uuid not null,
  origin_key text not null,
  reverses_commission_id uuid,
  occurred_on date not null,
  basis_amount numeric(14, 2) not null check (basis_amount >= 0),
  amount numeric(14, 2) not null,
  employee_role public.organization_role not null,
  rule_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, branch_id, id),
  constraint earned_commissions_branch_scope_fkey
    foreign key (organization_id, branch_id)
    references public.branches (organization_id, id) on delete restrict,
  constraint earned_commissions_employee_scope_fkey
    foreign key (organization_id, employee_id)
    references public.organization_members (organization_id, user_id) on delete restrict,
  constraint earned_commissions_rule_scope_fkey
    foreign key (organization_id, commission_rule_id)
    references public.commission_rules (organization_id, id) on delete restrict,
  constraint earned_commissions_reversal_scope_fkey
    foreign key (organization_id, branch_id, reverses_commission_id)
    references public.earned_commissions (organization_id, branch_id, id) on delete restrict,
  check (
    (entry_kind = 'accrual' and amount > 0 and reverses_commission_id is null)
    or (entry_kind = 'reversal' and amount < 0 and reverses_commission_id is not null)
  ),
  check (char_length(trim(origin_key)) between 1 and 300)
);

create unique index if not exists earned_commissions_origin_unique
  on public.earned_commissions (organization_id, origin_key);
create unique index if not exists earned_commissions_one_terminal_reversal
  on public.earned_commissions (organization_id, reverses_commission_id)
  where entry_kind = 'reversal' and origin_type = 'terminal_status';

create table if not exists public.commission_terminal_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  source_type text not null check (source_type in ('sale', 'repair')),
  source_id uuid not null,
  source_status text not null,
  occurred_at timestamptz not null,
  timing_basis text not null default 'live_transition'
    check (timing_basis in ('live_transition', 'cutover_best_available')),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, source_type, source_id),
  constraint commission_terminal_events_branch_scope_fkey
    foreign key (organization_id, branch_id)
    references public.branches (organization_id, id) on delete restrict,
  check (char_length(trim(source_status)) between 1 and 40)
);

-- A completed return is copied once from after_sales_cases. Reversal dates and
-- ratios therefore remain stable even if the workflow row is edited later.
create table if not exists public.commission_refund_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  after_sales_case_id uuid not null,
  source_type text not null check (source_type in ('sale', 'repair')),
  sale_id uuid,
  sale_item_id uuid,
  repair_id uuid,
  refund_amount numeric(14, 2) check (refund_amount is null or refund_amount >= 0),
  refund_quantity numeric(14, 4) check (refund_quantity is null or refund_quantity > 0),
  source_amount numeric(14, 2) not null check (source_amount >= 0),
  source_quantity numeric(14, 4) check (source_quantity is null or source_quantity > 0),
  occurred_at timestamptz not null,
  timing_basis text not null default 'live_transition'
    check (timing_basis in ('live_transition', 'cutover_best_available')),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, after_sales_case_id),
  constraint commission_refund_events_branch_scope_fkey
    foreign key (organization_id, branch_id)
    references public.branches (organization_id, id) on delete restrict,
  check (
    (source_type = 'sale' and sale_id is not null and repair_id is null)
    or (source_type = 'repair' and repair_id is not null and sale_id is null and sale_item_id is null)
  )
);

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid,
  allocation_scope text not null default 'organization'
    check (allocation_scope in ('organization', 'branch')),
  period_from date not null,
  period_to date not null,
  idempotency_key text not null,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'voided')),
  run_type text not null default 'standard'
    check (run_type in ('standard', 'legacy')),
  currency text not null,
  base_amount numeric(14, 2) not null default 0,
  commission_amount numeric(14, 2) not null default 0,
  adjustment_amount numeric(14, 2) not null default 0,
  gross_amount numeric(14, 2) not null default 0,
  net_amount numeric(14, 2) not null default 0,
  legacy_source_id uuid,
  generated_by uuid references auth.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint payroll_runs_branch_scope_fkey
    foreign key (organization_id, branch_id)
    references public.branches (organization_id, id) on delete restrict,
  check (
    (allocation_scope = 'organization' and branch_id is null)
    or (allocation_scope = 'branch' and branch_id is not null)
  ),
  check (period_to >= period_from),
  check (char_length(trim(idempotency_key)) between 1 and 128),
  check (char_length(currency) = 3 and currency = upper(currency)),
  check (base_amount >= 0),
  check (gross_amount = base_amount + commission_amount),
  check (net_amount = gross_amount + adjustment_amount),
  check (
    (status = 'approved' and approved_at is not null)
    or status <> 'approved'
  )
);

create unique index if not exists payroll_runs_idempotency_unique
  on public.payroll_runs (
    organization_id,
    coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    idempotency_key
  );
create unique index if not exists payroll_runs_legacy_source_unique
  on public.payroll_runs (organization_id, legacy_source_id)
  where legacy_source_id is not null;

create table if not exists public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid,
  allocation_scope text not null check (allocation_scope in ('organization', 'branch')),
  payroll_run_id uuid not null,
  employee_id uuid not null,
  employee_role public.organization_role not null,
  base_amount numeric(14, 2) not null default 0 check (base_amount >= 0),
  commission_amount numeric(14, 2) not null default 0,
  adjustment_amount numeric(14, 2) not null default 0,
  gross_amount numeric(14, 2) not null default 0,
  net_amount numeric(14, 2) not null default 0,
  paid_amount numeric(14, 2) not null default 0 check (paid_amount >= 0),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'partially_paid', 'paid')),
  legacy_source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, payroll_run_id, employee_id),
  constraint payroll_entries_run_scope_fkey
    foreign key (organization_id, payroll_run_id)
    references public.payroll_runs (organization_id, id) on delete restrict,
  constraint payroll_entries_branch_scope_fkey
    foreign key (organization_id, branch_id)
    references public.branches (organization_id, id) on delete restrict,
  constraint payroll_entries_employee_scope_fkey
    foreign key (organization_id, employee_id)
    references public.organization_members (organization_id, user_id) on delete restrict,
  check (
    (allocation_scope = 'organization' and branch_id is null)
    or (allocation_scope = 'branch' and branch_id is not null)
  ),
  check (gross_amount = base_amount + commission_amount),
  check (net_amount = gross_amount + adjustment_amount)
);

create unique index if not exists payroll_entries_legacy_source_unique
  on public.payroll_entries (organization_id, legacy_source_id)
  where legacy_source_id is not null;

create table if not exists public.payroll_entry_commissions (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payroll_entry_id uuid not null,
  earned_commission_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, payroll_entry_id, earned_commission_id),
  unique (organization_id, earned_commission_id),
  constraint payroll_entry_commissions_entry_scope_fkey
    foreign key (organization_id, payroll_entry_id)
    references public.payroll_entries (organization_id, id) on delete restrict,
  constraint payroll_entry_commissions_commission_scope_fkey
    foreign key (organization_id, earned_commission_id)
    references public.earned_commissions (organization_id, id) on delete restrict
);

create table if not exists public.payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  payroll_entry_id uuid not null,
  adjustment_type text not null
    check (adjustment_type in ('bonus', 'discount', 'advance', 'correction', 'reversal')),
  amount numeric(14, 2) not null check (amount <> 0),
  reason text not null,
  idempotency_key text not null,
  reverses_adjustment_id uuid,
  included_in_net boolean not null default false,
  legacy_source_id uuid,
  legacy_component text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, payroll_entry_id, idempotency_key),
  constraint payroll_adjustments_entry_scope_fkey
    foreign key (organization_id, payroll_entry_id)
    references public.payroll_entries (organization_id, id) on delete restrict,
  constraint payroll_adjustments_reversal_scope_fkey
    foreign key (organization_id, reverses_adjustment_id)
    references public.payroll_adjustments (organization_id, id) on delete restrict,
  check (char_length(trim(reason)) between 1 and 1000),
  check (char_length(trim(idempotency_key)) between 1 and 128),
  check (
    (adjustment_type = 'bonus' and amount > 0)
    or (adjustment_type in ('discount', 'advance') and amount < 0)
    or adjustment_type in ('correction', 'reversal')
  ),
  check (
    (adjustment_type = 'reversal' and reverses_adjustment_id is not null)
    or (adjustment_type <> 'reversal' and reverses_adjustment_id is null)
  ),
  check (
    (legacy_source_id is null and legacy_component is null)
    or (legacy_source_id is not null and legacy_component is not null)
  )
);

create unique index if not exists payroll_adjustments_one_reversal
  on public.payroll_adjustments (organization_id, reverses_adjustment_id)
  where reverses_adjustment_id is not null;
create unique index if not exists payroll_adjustments_legacy_source_unique
  on public.payroll_adjustments (organization_id, legacy_source_id, legacy_component)
  where legacy_source_id is not null;

create table if not exists public.payroll_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid,
  allocation_scope text not null default 'branch'
    check (allocation_scope in ('organization', 'branch')),
  payroll_entry_id uuid not null,
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
  notes text,
  legacy_source_id uuid,
  legacy_component text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, branch_id, id),
  unique (organization_id, payroll_entry_id, idempotency_key),
  constraint payroll_payments_entry_scope_fkey
    foreign key (organization_id, payroll_entry_id)
    references public.payroll_entries (organization_id, id) on delete restrict,
  constraint payroll_payments_branch_scope_fkey
    foreign key (organization_id, branch_id)
    references public.branches (organization_id, id) on delete restrict,
  constraint payroll_payments_cash_session_scope_fkey
    foreign key (organization_id, branch_id, cash_session_id)
    references public.cash_closures (organization_id, branch_id, id) on delete restrict,
  constraint payroll_payments_reversal_scope_fkey
    foreign key (organization_id, branch_id, reverses_payment_id)
    references public.payroll_payments (organization_id, branch_id, id) on delete restrict,
  check (
    (allocation_scope = 'organization' and branch_id is null)
    or (allocation_scope = 'branch' and branch_id is not null)
  ),
  check (
    (direction = 'payment' and reverses_payment_id is null)
    or (direction = 'reversal' and reverses_payment_id is not null)
  ),
  check (
    (payment_method = 'cash' and (cash_session_id is not null or legacy_source_id is not null))
    or (payment_method <> 'cash' and cash_session_id is null)
  ),
  check (char_length(trim(idempotency_key)) between 1 and 128),
  check (reference is null or char_length(trim(reference)) between 1 and 200),
  check (notes is null or char_length(notes) <= 2000),
  check (
    (legacy_source_id is null and legacy_component is null)
    or (legacy_source_id is not null and legacy_component in ('payment', 'reversal'))
  )
);

create unique index if not exists payroll_payments_one_reversal
  on public.payroll_payments (organization_id, reverses_payment_id)
  where reverses_payment_id is not null;
create unique index if not exists payroll_payments_legacy_source_unique
  on public.payroll_payments (organization_id, legacy_source_id, legacy_component)
  where legacy_source_id is not null;

alter table public.cash_movements
  add column if not exists payroll_payment_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_record
    where constraint_record.conname = 'cash_movements_payroll_payment_scope_fkey'
      and constraint_record.conrelid = 'public.cash_movements'::regclass
  ) then
    alter table public.cash_movements
      add constraint cash_movements_payroll_payment_scope_fkey
      foreign key (organization_id, branch_id, payroll_payment_id)
      references public.payroll_payments (organization_id, branch_id, id)
      on delete restrict;
  end if;
end;
$$;

create unique index if not exists cash_movements_payroll_payment_unique
  on public.cash_movements (organization_id, payroll_payment_id)
  where payroll_payment_id is not null;

create index if not exists employee_compensation_employee_idx
  on public.employee_compensation (organization_id, employee_id, effective_from desc);
create index if not exists employee_compensation_created_by_idx
  on public.employee_compensation (created_by) where created_by is not null;
create index if not exists employee_employment_events_employee_period_idx
  on public.employee_employment_events (
    organization_id,
    employee_id,
    occurred_at desc,
    id
  );
create index if not exists commission_rules_employee_idx
  on public.commission_rules (organization_id, employee_id, source_type, effective_from desc)
  where employee_id is not null;
create index if not exists commission_rules_role_idx
  on public.commission_rules (organization_id, role, source_type, effective_from desc)
  where role is not null;
create index if not exists commission_rules_branch_idx
  on public.commission_rules (organization_id, branch_id)
  where branch_id is not null;
create index if not exists commission_rules_source_reference_idx
  on public.commission_rules (organization_id, source_type, source_reference_id)
  where source_reference_id is not null;
create index if not exists commission_rules_approved_by_idx
  on public.commission_rules (approved_by) where approved_by is not null;
create index if not exists commission_rules_created_by_idx
  on public.commission_rules (created_by) where created_by is not null;
create index if not exists commission_operation_attributions_source_idx
  on public.commission_operation_attributions (
    organization_id,
    source_type,
    source_id,
    occurred_at
  );
create index if not exists commission_operation_attributions_employee_period_idx
  on public.commission_operation_attributions (
    organization_id,
    employee_id,
    occurred_at,
    branch_id
  );
create index if not exists commission_operation_attributions_branch_idx
  on public.commission_operation_attributions (organization_id, branch_id);
create index if not exists commission_sale_item_attributions_sale_idx
  on public.commission_sale_item_attributions (organization_id, sale_id, sale_item_id);
create index if not exists earned_commissions_employee_period_idx
  on public.earned_commissions (organization_id, employee_id, occurred_on, branch_id);
create index if not exists earned_commissions_branch_idx
  on public.earned_commissions (organization_id, branch_id);
create index if not exists earned_commissions_rule_idx
  on public.earned_commissions (organization_id, commission_rule_id);
create index if not exists earned_commissions_reverses_idx
  on public.earned_commissions (organization_id, branch_id, reverses_commission_id)
  where reverses_commission_id is not null;
create index if not exists earned_commissions_origin_idx
  on public.earned_commissions (organization_id, origin_type, origin_id);
create index if not exists commission_terminal_events_period_idx
  on public.commission_terminal_events (
    organization_id,
    branch_id,
    occurred_at,
    source_type
  );
create index if not exists commission_refund_events_period_idx
  on public.commission_refund_events (
    organization_id,
    branch_id,
    occurred_at,
    source_type
  );
create index if not exists payroll_runs_scope_period_idx
  on public.payroll_runs (organization_id, branch_id, period_from, period_to, status);
create index if not exists payroll_runs_branch_idx
  on public.payroll_runs (organization_id, branch_id) where branch_id is not null;
create index if not exists payroll_runs_generated_by_idx
  on public.payroll_runs (generated_by) where generated_by is not null;
create index if not exists payroll_runs_approved_by_idx
  on public.payroll_runs (approved_by) where approved_by is not null;
create index if not exists payroll_entries_run_idx
  on public.payroll_entries (organization_id, payroll_run_id, employee_id);
create index if not exists payroll_entries_employee_idx
  on public.payroll_entries (organization_id, employee_id, created_at desc);
create index if not exists payroll_entries_branch_idx
  on public.payroll_entries (organization_id, branch_id)
  where branch_id is not null;
create index if not exists payroll_entry_commissions_entry_idx
  on public.payroll_entry_commissions (organization_id, payroll_entry_id);
create index if not exists payroll_adjustments_entry_idx
  on public.payroll_adjustments (organization_id, payroll_entry_id, created_at);
create index if not exists payroll_adjustments_reverses_idx
  on public.payroll_adjustments (organization_id, reverses_adjustment_id)
  where reverses_adjustment_id is not null;
create index if not exists payroll_adjustments_created_by_idx
  on public.payroll_adjustments (created_by) where created_by is not null;
create index if not exists payroll_payments_entry_idx
  on public.payroll_payments (organization_id, payroll_entry_id, created_at);
create index if not exists payroll_payments_branch_date_idx
  on public.payroll_payments (organization_id, branch_id, payment_date);
create index if not exists payroll_payments_cash_session_idx
  on public.payroll_payments (organization_id, branch_id, cash_session_id)
  where cash_session_id is not null;
create index if not exists payroll_payments_reverses_idx
  on public.payroll_payments (organization_id, branch_id, reverses_payment_id)
  where reverses_payment_id is not null;
create index if not exists payroll_payments_created_by_idx
  on public.payroll_payments (created_by) where created_by is not null;

create or replace function public.set_payroll_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.payroll_organization_date(
  p_organization_id uuid,
  p_instant timestamptz default now()
)
returns date
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  organization_timezone text := 'America/Asuncion';
begin
  select timezone_record.name
  into organization_timezone
  from public.organization_settings settings
  join pg_timezone_names timezone_record
    on timezone_record.name = settings.timezone
  where settings.organization_id = p_organization_id
  limit 1;

  return (p_instant at time zone coalesce(
    organization_timezone,
    'America/Asuncion'
  ))::date;
end;
$$;

create or replace function public.validate_employee_compensation_period()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    new.organization_id::text || ':compensation:' || new.employee_id::text,
    0
  ));

  if exists (
    select 1
    from public.employee_compensation existing
    where existing.organization_id = new.organization_id
      and existing.employee_id = new.employee_id
      and existing.id <> new.id
      and daterange(
        existing.effective_from,
        coalesce(existing.effective_to + 1, 'infinity'::date),
        '[)'
      ) && daterange(
        new.effective_from,
        coalesce(new.effective_to + 1, 'infinity'::date),
        '[)'
      )
  ) then
    raise exception 'PAYROLL_COMPENSATION_PERIOD_OVERLAP';
  end if;

  return new;
end;
$$;

create or replace function public.validate_commission_rule_period()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.status <> 'approved' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    new.organization_id::text || ':commission-rule:'
      || new.scope_type || ':' || coalesce(new.employee_id::text, new.role::text)
      || ':' || coalesce(new.branch_id::text, 'organization')
      || ':' || new.source_type || ':' || new.calculation_type
      || ':' || coalesce(new.source_reference_id::text, 'all'),
    0
  ));

  if exists (
    select 1
    from public.commission_rules existing
    where existing.organization_id = new.organization_id
      and existing.id <> new.id
      and existing.status = 'approved'
      and existing.scope_type = new.scope_type
      and existing.role is not distinct from new.role
      and existing.employee_id is not distinct from new.employee_id
      and existing.branch_id is not distinct from new.branch_id
      and existing.source_type = new.source_type
      and existing.source_reference_id is not distinct from new.source_reference_id
      and existing.calculation_type = new.calculation_type
      and daterange(
        existing.effective_from,
        coalesce(existing.effective_to + 1, 'infinity'::date),
        '[)'
      ) && daterange(
        new.effective_from,
        coalesce(new.effective_to + 1, 'infinity'::date),
        '[)'
      )
  ) then
    raise exception 'PAYROLL_COMMISSION_RULE_PERIOD_OVERLAP';
  end if;

  return new;
end;
$$;

create or replace function public.protect_approved_commission_rule()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_fk_nulling_only boolean := false;
  safe_effective_close boolean := false;
  organization_today date;
begin
  if tg_op = 'DELETE' and old.status = 'approved' then
    raise exception 'PAYROLL_APPROVED_COMMISSION_RULE_IS_IMMUTABLE';
  end if;
  if tg_op <> 'UPDATE' or old.status <> 'approved' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  organization_today := public.payroll_organization_date(old.organization_id, now());

  actor_fk_nulling_only :=
    to_jsonb(new) - 'approved_by' - 'created_by' - 'updated_at'
      = to_jsonb(old) - 'approved_by' - 'created_by' - 'updated_at'
    and (
      (
        old.approved_by is not null and new.approved_by is null
        and not exists (select 1 from auth.users actor where actor.id = old.approved_by)
      )
      or (
        old.created_by is not null and new.created_by is null
        and not exists (select 1 from auth.users actor where actor.id = old.created_by)
      )
    )
    and (
      new.approved_by is not distinct from old.approved_by
      or (
        old.approved_by is not null and new.approved_by is null
        and not exists (select 1 from auth.users actor where actor.id = old.approved_by)
      )
    )
    and (
      new.created_by is not distinct from old.created_by
      or (
        old.created_by is not null and new.created_by is null
        and not exists (select 1 from auth.users actor where actor.id = old.created_by)
      )
    );

  if actor_fk_nulling_only then
    return new;
  end if;

  safe_effective_close :=
    to_jsonb(new) - 'effective_to' - 'updated_at'
      = to_jsonb(old) - 'effective_to' - 'updated_at'
    and new.effective_to is not null
    and new.effective_to >= old.effective_from
    and new.effective_to >= organization_today
    and (old.effective_to is null or new.effective_to <= old.effective_to)
    and not exists (
      select 1
      from public.earned_commissions commission
      where commission.organization_id = old.organization_id
        and commission.commission_rule_id = old.id
        and commission.occurred_on > new.effective_to
    );

  if safe_effective_close then
    return new;
  end if;

  raise exception 'PAYROLL_APPROVED_COMMISSION_RULE_IS_IMMUTABLE';
end;
$$;

create or replace function public.prevent_payroll_append_only_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if tg_op = 'UPDATE'
     and tg_table_name in ('payroll_adjustments', 'payroll_payments')
     and (to_jsonb(old) ->> 'created_by') is not null
     and (to_jsonb(new) ->> 'created_by') is null
     and to_jsonb(new) - 'created_by' = to_jsonb(old) - 'created_by'
     and not exists (
       select 1
       from auth.users actor
       where actor.id = (to_jsonb(old) ->> 'created_by')::uuid
     ) then
    return new;
  end if;

  if tg_table_name = 'payroll_adjustments' then
    raise exception 'PAYROLL_ADJUSTMENTS_ARE_APPEND_ONLY';
  end if;
  if tg_table_name = 'payroll_payments' then
    raise exception 'PAYROLL_PAYMENTS_ARE_APPEND_ONLY';
  end if;
  if tg_table_name = 'earned_commissions' then
    raise exception 'EARNED_COMMISSIONS_ARE_APPEND_ONLY';
  end if;
  if tg_table_name = 'commission_terminal_events' then
    raise exception 'COMMISSION_TERMINAL_EVENTS_ARE_APPEND_ONLY';
  end if;
  if tg_table_name = 'commission_refund_events' then
    raise exception 'COMMISSION_REFUND_EVENTS_ARE_APPEND_ONLY';
  end if;
  if tg_table_name = 'employee_employment_events' then
    raise exception 'EMPLOYEE_EMPLOYMENT_EVENTS_ARE_APPEND_ONLY';
  end if;
  if tg_table_name = 'commission_operation_attributions' then
    raise exception 'COMMISSION_OPERATION_ATTRIBUTIONS_ARE_APPEND_ONLY';
  end if;
  if tg_table_name = 'commission_sale_item_attributions' then
    raise exception 'COMMISSION_SALE_ITEM_ATTRIBUTIONS_ARE_APPEND_ONLY';
  end if;

  raise exception 'PAYROLL_ENTRY_COMMISSIONS_ARE_APPEND_ONLY';
end;
$$;

create or replace function public.protect_approved_payroll_run()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_fk_nulling_only boolean := false;
begin
  if tg_op = 'UPDATE'
     and old.status = 'draft'
     and new.status = 'voided'
     and exists (
       select 1
       from public.payroll_entries entry
       join public.payroll_entry_commissions claim
         on claim.organization_id = entry.organization_id
        and claim.payroll_entry_id = entry.id
       where entry.organization_id = old.organization_id
         and entry.payroll_run_id = old.id
     ) then
    raise exception 'PAYROLL_RUN_WITH_CLAIMS_CANNOT_BE_VOIDED';
  end if;

  if tg_op = 'DELETE' and old.status = 'approved' then
    raise exception 'PAYROLL_APPROVED_RUN_IS_IMMUTABLE';
  end if;
  if tg_op <> 'UPDATE' or old.status <> 'approved' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  actor_fk_nulling_only :=
    to_jsonb(new) - 'generated_by' - 'approved_by' - 'updated_at'
      = to_jsonb(old) - 'generated_by' - 'approved_by' - 'updated_at'
    and (
      (
        old.generated_by is not null and new.generated_by is null
        and not exists (select 1 from auth.users actor where actor.id = old.generated_by)
      )
      or (
        old.approved_by is not null and new.approved_by is null
        and not exists (select 1 from auth.users actor where actor.id = old.approved_by)
      )
    )
    and (
      new.generated_by is not distinct from old.generated_by
      or (
        old.generated_by is not null and new.generated_by is null
        and not exists (select 1 from auth.users actor where actor.id = old.generated_by)
      )
    )
    and (
      new.approved_by is not distinct from old.approved_by
      or (
        old.approved_by is not null and new.approved_by is null
        and not exists (select 1 from auth.users actor where actor.id = old.approved_by)
      )
    );

  if actor_fk_nulling_only then
    return new;
  end if;

  raise exception 'PAYROLL_APPROVED_RUN_IS_IMMUTABLE';
end;
$$;

create or replace function public.protect_approved_payroll_entry()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  parent_status text;
  ledger_paid numeric(14, 2);
  adjusted_payable numeric(14, 2);
  expected_status text;
begin
  select run.status
  into parent_status
  from public.payroll_runs run
  where run.organization_id = old.organization_id
    and run.id = old.payroll_run_id;

  if parent_status <> 'approved' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'PAYROLL_APPROVED_ENTRY_IS_IMMUTABLE';
  end if;

  if to_jsonb(new) - 'paid_amount' - 'payment_status' - 'updated_at'
       <> to_jsonb(old) - 'paid_amount' - 'payment_status' - 'updated_at' then
    raise exception 'PAYROLL_APPROVED_ENTRY_IS_IMMUTABLE';
  end if;

  select coalesce(sum(
    case payment.direction when 'payment' then payment.amount else -payment.amount end
  ), 0)
  into ledger_paid
  from public.payroll_payments payment
  where payment.organization_id = old.organization_id
    and payment.payroll_entry_id = old.id;

  select old.net_amount + coalesce(sum(adjustment.amount) filter (
    where adjustment.included_in_net = false
  ), 0)
  into adjusted_payable
  from public.payroll_adjustments adjustment
  where adjustment.organization_id = old.organization_id
    and adjustment.payroll_entry_id = old.id;

  expected_status := case
    when ledger_paid = adjusted_payable and adjusted_payable > 0 then 'paid'
    when ledger_paid > 0 then 'partially_paid'
    else 'pending'
  end;

  if new.paid_amount is distinct from ledger_paid
     or new.payment_status is distinct from expected_status then
    raise exception 'PAYROLL_PAYMENT_STATE_MUST_MATCH_LEDGER';
  end if;

  return new;
end;
$$;

create or replace function public.validate_payroll_adjustment_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_run_id uuid;
  target_entry public.payroll_entries%rowtype;
  target_run public.payroll_runs%rowtype;
  original_adjustment public.payroll_adjustments%rowtype;
  adjusted_payable numeric(14, 2);
begin
  select entry.payroll_run_id
  into target_run_id
  from public.payroll_entries entry
  where entry.organization_id = new.organization_id
    and entry.id = new.payroll_entry_id;

  if not found then
    raise exception 'PAYROLL_ENTRY_NOT_FOUND';
  end if;

  select run.*
  into target_run
  from public.payroll_runs run
  where run.organization_id = new.organization_id
    and run.id = target_run_id
  for update;

  select entry.*
  into target_entry
  from public.payroll_entries entry
  where entry.organization_id = new.organization_id
    and entry.id = new.payroll_entry_id
    and entry.payroll_run_id = target_run.id
  for update;

  if not found then
    raise exception 'PAYROLL_ENTRY_NOT_FOUND';
  end if;

  if target_run.status not in ('draft', 'approved') then
    raise exception 'PAYROLL_ADJUSTMENT_REQUIRES_OPEN_OR_APPROVED_RUN';
  end if;

  -- Draft adjustments are frozen into the approved entry net. Later
  -- corrections remain external append-only deltas against that snapshot.
  new.included_in_net := case when target_run.status = 'draft' then true else false end;

  if new.adjustment_type = 'reversal' then
    select adjustment.*
    into original_adjustment
    from public.payroll_adjustments adjustment
    where adjustment.organization_id = new.organization_id
      and adjustment.id = new.reverses_adjustment_id
      and adjustment.payroll_entry_id = new.payroll_entry_id
      and adjustment.adjustment_type <> 'reversal'
    for update;

    if not found or new.amount <> -original_adjustment.amount then
      raise exception 'PAYROLL_ADJUSTMENT_REVERSAL_MUST_COMPENSATE_ORIGINAL';
    end if;
  end if;

  select case
    when target_run.status = 'draft' then
      target_entry.gross_amount + coalesce(sum(adjustment.amount), 0) + new.amount
    else
      target_entry.net_amount + coalesce(sum(adjustment.amount) filter (
        where adjustment.included_in_net = false
      ), 0) + new.amount
    end
  into adjusted_payable
  from public.payroll_adjustments adjustment
  where adjustment.organization_id = new.organization_id
    and adjustment.payroll_entry_id = new.payroll_entry_id;

  if adjusted_payable < target_entry.paid_amount or adjusted_payable < 0 then
    raise exception 'PAYROLL_ADJUSTMENT_BELOW_PAID_AMOUNT';
  end if;

  return new;
end;
$$;

create or replace function public.validate_earned_commission_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  original_commission public.earned_commissions%rowtype;
  existing_reversals numeric(14, 2);
begin
  if new.entry_kind = 'accrual' then
    return new;
  end if;
  if new.entry_kind <> 'reversal'
     or new.origin_type not in ('after_sales', 'terminal_status') then
    raise exception 'PAYROLL_INVALID_COMMISSION_REVERSAL';
  end if;

  select commission.*
  into original_commission
  from public.earned_commissions commission
  where commission.organization_id = new.organization_id
    and commission.branch_id = new.branch_id
    and commission.id = new.reverses_commission_id
    and commission.entry_kind = 'accrual'
  for update;

  if not found then
    raise exception 'PAYROLL_COMMISSION_TO_REVERSE_NOT_FOUND';
  end if;
  if new.employee_id <> original_commission.employee_id
     or new.commission_rule_id <> original_commission.commission_rule_id
     or new.source_type <> original_commission.source_type
     or new.basis_amount <> original_commission.basis_amount
     or new.employee_role <> original_commission.employee_role
     or new.occurred_on < original_commission.occurred_on then
    raise exception 'PAYROLL_COMMISSION_REVERSAL_SCOPE_MISMATCH';
  end if;

  select coalesce(sum(reversal.amount), 0)
  into existing_reversals
  from public.earned_commissions reversal
  where reversal.organization_id = new.organization_id
    and reversal.reverses_commission_id = original_commission.id
    and reversal.entry_kind = 'reversal';

  if original_commission.amount + existing_reversals + new.amount < 0 then
    raise exception 'PAYROLL_COMMISSION_REVERSAL_EXCEEDS_ACCRUAL';
  end if;

  return new;
end;
$$;

create or replace function public.validate_payroll_entry_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_run public.payroll_runs%rowtype;
  target_membership public.organization_members%rowtype;
  target_employment_role public.organization_role;
  has_active_employment boolean := false;
  organization_timezone text := 'America/Asuncion';
begin
  select run.*
  into target_run
  from public.payroll_runs run
  where run.organization_id = new.organization_id
    and run.id = new.payroll_run_id
  for key share;

  if not found then
    raise exception 'PAYROLL_RUN_NOT_FOUND';
  end if;
  if target_run.branch_id is distinct from new.branch_id
     or target_run.allocation_scope <> new.allocation_scope then
    raise exception 'PAYROLL_ENTRY_SCOPE_MISMATCH';
  end if;

  select timezone_record.name
  into organization_timezone
  from public.organization_settings settings
  join pg_timezone_names timezone_record
    on timezone_record.name = settings.timezone
  where settings.organization_id = new.organization_id
  limit 1;
  organization_timezone := coalesce(organization_timezone, 'America/Asuncion');

  if tg_op = 'INSERT' then
    if target_run.status <> 'draft' then
      raise exception 'PAYROLL_ENTRY_REQUIRES_DRAFT_RUN';
    end if;

    select membership.*
    into target_membership
    from public.organization_members membership
    where membership.organization_id = new.organization_id
      and membership.user_id = new.employee_id;

    if not found then
      raise exception 'PAYROLL_ENTRY_REQUIRES_ORGANIZATION_MEMBER';
    end if;

    select employment.employee_role
    into target_employment_role
    from (
      select
        event.id,
        event.employee_role,
        event.employment_status,
        event.occurred_at,
        lead(event.occurred_at) over (
          partition by event.organization_id, event.employee_id
          order by event.occurred_at, event.id
        ) as ended_at
      from public.employee_employment_events event
      where event.organization_id = new.organization_id
        and event.employee_id = new.employee_id
    ) employment
    where employment.employment_status = 'active'
      and employment.employee_role <> 'customer'
      and employment.occurred_at
        < ((target_run.period_to + 1)::timestamp at time zone organization_timezone)
      and coalesce(employment.ended_at, 'infinity'::timestamptz)
        > (target_run.period_from::timestamp at time zone organization_timezone)
    order by employment.occurred_at desc, employment.id desc
    limit 1;
    has_active_employment := found;

    if has_active_employment then
      if target_employment_role <> new.employee_role then
        raise exception 'PAYROLL_ENTRY_ROLE_MISMATCH';
      end if;
    elsif new.base_amount <> 0 or not exists (
      select 1
      from public.earned_commissions commission
      where commission.organization_id = new.organization_id
        and commission.employee_id = new.employee_id
        and commission.employee_role = new.employee_role
        and commission.occurred_on <= target_run.period_to
        and (
          target_run.branch_id is null
          or commission.branch_id = target_run.branch_id
        )
        and not exists (
          select 1
          from public.payroll_entry_commissions claimed
          where claimed.organization_id = commission.organization_id
            and claimed.earned_commission_id = commission.id
        )
    ) then
      -- Former/suspended staff remain payable only for already materialized,
      -- unclaimed commission. A zero net is valid when an accrual and its
      -- reversal are claimed together; approval later proves the linked sum.
      raise exception 'PAYROLL_ENTRY_REQUIRES_STAFF_OR_OWED_COMMISSION';
    end if;
  elsif new.organization_id is distinct from old.organization_id
     or new.payroll_run_id is distinct from old.payroll_run_id
     or new.employee_id is distinct from old.employee_id
     or new.employee_role is distinct from old.employee_role
     or new.allocation_scope is distinct from old.allocation_scope
     or new.branch_id is distinct from old.branch_id then
    raise exception 'PAYROLL_ENTRY_SCOPE_IS_IMMUTABLE';
  end if;

  return new;
end;
$$;

create or replace function public.validate_payroll_entry_commission_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_run_id uuid;
  target_entry public.payroll_entries%rowtype;
  target_run public.payroll_runs%rowtype;
  target_commission public.earned_commissions%rowtype;
begin
  select entry.payroll_run_id
  into target_run_id
  from public.payroll_entries entry
  where entry.organization_id = new.organization_id
    and entry.id = new.payroll_entry_id;

  if not found then
    raise exception 'PAYROLL_ENTRY_NOT_FOUND';
  end if;

  select run.*
  into target_run
  from public.payroll_runs run
  where run.organization_id = new.organization_id
    and run.id = target_run_id
  for key share;

  select entry.*
  into target_entry
  from public.payroll_entries entry
  where entry.organization_id = new.organization_id
    and entry.id = new.payroll_entry_id
    and entry.payroll_run_id = target_run.id
  for key share;

  if not found then
    raise exception 'PAYROLL_ENTRY_NOT_FOUND';
  end if;

  select commission.*
  into target_commission
  from public.earned_commissions commission
  where commission.organization_id = new.organization_id
    and commission.id = new.earned_commission_id
  for key share;

  if not found then
    raise exception 'PAYROLL_EARNED_COMMISSION_NOT_FOUND';
  end if;
  if target_run.status <> 'draft'
     or target_commission.employee_id <> target_entry.employee_id
     or target_commission.occurred_on > target_run.period_to
     or (
       target_entry.branch_id is not null
       and target_commission.branch_id <> target_entry.branch_id
     ) then
    raise exception 'PAYROLL_ENTRY_COMMISSION_SCOPE_MISMATCH';
  end if;

  return new;
end;
$$;

create or replace function public.capture_employee_employment_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.role is not distinct from old.role
       and new.status is not distinct from old.status then
      return new;
    end if;

    if new.role = 'customer' and old.role = 'customer' then
      return new;
    end if;
  end if;

  if tg_op = 'INSERT' and new.role = 'customer' then
    return new;
  end if;

  insert into public.employee_employment_events (
    organization_id,
    employee_id,
    employee_role,
    employment_status,
    occurred_at,
    capture_basis
  ) values (
    new.organization_id,
    new.user_id,
    new.role,
    new.status,
    case when tg_op = 'INSERT' then coalesce(new.created_at, now()) else now() end,
    'live_transition'
  );

  return new;
end;
$$;

-- The trigger is installed before the cutover snapshot. Its table lock closes
-- the race between the snapshot and future role/status transitions.
drop trigger if exists organization_members_capture_employment_event
  on public.organization_members;
create trigger organization_members_capture_employment_event
after insert or update of role, status on public.organization_members
for each row execute function public.capture_employee_employment_event();

insert into public.employee_employment_events (
  organization_id,
  employee_id,
  employee_role,
  employment_status,
  occurred_at,
  capture_basis,
  source_membership_id,
  source_event
)
select
  membership.organization_id,
  membership.user_id,
  membership.role,
  case when membership.status = 'suspended' then 'active' else membership.status end,
  membership.created_at,
  'cutover_best_available',
  membership.id,
  'cutover-current'
from public.organization_members membership
where membership.role <> 'customer'
on conflict (organization_id, source_membership_id, source_event)
  where source_membership_id is not null
  do nothing;

insert into public.employee_employment_events (
  organization_id,
  employee_id,
  employee_role,
  employment_status,
  occurred_at,
  capture_basis,
  source_membership_id,
  source_event
)
select
  membership.organization_id,
  membership.user_id,
  membership.role,
  'suspended',
  greatest(
    membership.updated_at,
    membership.created_at + interval '1 microsecond'
  ),
  'cutover_best_available',
  membership.id,
  'cutover-suspended'
from public.organization_members membership
where membership.role <> 'customer'
  and membership.status = 'suspended'
on conflict (organization_id, source_membership_id, source_event)
  where source_membership_id is not null
  do nothing;

create or replace function public.capture_commission_operation_attribution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  attributed_employee_id uuid;
  attributed_employee_role public.organization_role;
  attributed_employment_status text;
  attribution_occurred_at timestamptz;
begin
  if new.organization_id is null or new.branch_id is null then
    return new;
  end if;

  if tg_table_name = 'sales' then
    if lower(coalesce(new.status, 'completed')) not in (
      'completed', 'refunded', 'cancelled', 'canceled', 'voided'
    ) then
      return new;
    end if;
    attributed_employee_id := new.created_by;
  elsif tg_table_name = 'repairs' then
    if lower(coalesce(new.payment_status, '')) not in ('pagado', 'paid')
       or lower(coalesce(new.status::text, '')) not in (
         'listo', 'entregado', 'cancelado', 'cancelled', 'canceled'
       ) then
      return new;
    end if;
    attributed_employee_id := new.technician_id;
  else
    raise exception 'PAYROLL_UNSUPPORTED_ATTRIBUTION_SOURCE';
  end if;

  if attributed_employee_id is null then
    return new;
  end if;

  if tg_table_name = 'sales' then
    attribution_occurred_at := coalesce(new.created_at, now());

    select employment.employee_role, employment.employment_status
    into attributed_employee_role, attributed_employment_status
    from public.employee_employment_events employment
    where employment.organization_id = new.organization_id
      and employment.employee_id = attributed_employee_id
      and employment.occurred_at <= attribution_occurred_at
    order by employment.occurred_at desc, employment.id desc
    limit 1;

    if not found
       or attributed_employment_status <> 'active'
       or attributed_employee_role = 'customer' then
      return new;
    end if;

    insert into public.commission_operation_attributions (
      organization_id,
      branch_id,
      source_type,
      source_id,
      accrual_status,
      employee_id,
      employee_role,
      occurred_at,
      basis_amount,
      labor_basis_amount
    ) values (
      new.organization_id,
      new.branch_id,
      'sale',
      new.id,
      null,
      attributed_employee_id,
      attributed_employee_role,
      attribution_occurred_at,
      coalesce(new.total_amount, 0),
      0
    )
    on conflict (
      organization_id,
      source_type,
      source_id,
      (coalesce(accrual_status, 'sale'))
    ) do nothing;

    return new;
  end if;

  if new.completed_at is not null then
    attribution_occurred_at := new.completed_at;
    select employment.employee_role, employment.employment_status
    into attributed_employee_role, attributed_employment_status
    from public.employee_employment_events employment
    where employment.organization_id = new.organization_id
      and employment.employee_id = attributed_employee_id
      and employment.occurred_at <= attribution_occurred_at
    order by employment.occurred_at desc, employment.id desc
    limit 1;

    if found
       and attributed_employment_status = 'active'
       and attributed_employee_role <> 'customer' then
    insert into public.commission_operation_attributions (
      organization_id,
      branch_id,
      source_type,
      source_id,
      accrual_status,
      employee_id,
      employee_role,
      occurred_at,
      basis_amount,
      labor_basis_amount
    ) values (
      new.organization_id,
      new.branch_id,
      'repair',
      new.id,
      'listo',
      attributed_employee_id,
      attributed_employee_role,
      attribution_occurred_at,
      coalesce(new.final_cost, new.estimated_cost, 0),
      coalesce(new.labor_cost, 0)
    )
    on conflict (
      organization_id,
      source_type,
      source_id,
      (coalesce(accrual_status, 'sale'))
    ) do nothing;
    end if;
  end if;

  if new.delivered_at is not null then
    attribution_occurred_at := new.delivered_at;
    select employment.employee_role, employment.employment_status
    into attributed_employee_role, attributed_employment_status
    from public.employee_employment_events employment
    where employment.organization_id = new.organization_id
      and employment.employee_id = attributed_employee_id
      and employment.occurred_at <= attribution_occurred_at
    order by employment.occurred_at desc, employment.id desc
    limit 1;

    if found
       and attributed_employment_status = 'active'
       and attributed_employee_role <> 'customer' then
    insert into public.commission_operation_attributions (
      organization_id,
      branch_id,
      source_type,
      source_id,
      accrual_status,
      employee_id,
      employee_role,
      occurred_at,
      basis_amount,
      labor_basis_amount
    ) values (
      new.organization_id,
      new.branch_id,
      'repair',
      new.id,
      'entregado',
      attributed_employee_id,
      attributed_employee_role,
      attribution_occurred_at,
      coalesce(new.final_cost, new.estimated_cost, 0),
      coalesce(new.labor_cost, 0)
    )
    on conflict (
      organization_id,
      source_type,
      source_id,
      (coalesce(accrual_status, 'sale'))
    ) do nothing;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.capture_commission_sale_item_attribution()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  source_sale public.sales%rowtype;
  source_category_id uuid;
begin
  select sale.*
  into source_sale
  from public.sales sale
  where sale.id = new.sale_id
    and sale.organization_id = new.organization_id;

  if not found or source_sale.branch_id is null then
    return new;
  end if;

  if new.product_id is not null then
    select product.category_id
    into source_category_id
    from public.products product
    where product.organization_id = source_sale.organization_id
      and product.id = new.product_id;
  end if;

  insert into public.commission_sale_item_attributions (
    organization_id,
    branch_id,
    sale_id,
    sale_item_id,
    product_id,
    category_id,
    quantity,
    subtotal,
    occurred_at
  ) values (
    source_sale.organization_id,
    source_sale.branch_id,
    source_sale.id,
    new.id,
    new.product_id,
    source_category_id,
    new.quantity,
    coalesce(new.subtotal, 0),
    coalesce(source_sale.created_at, now())
  )
  on conflict (organization_id, sale_item_id) do nothing;

  return new;
end;
$$;

-- Install attribution capture before the backfill so operation writes cannot
-- slip between the historical snapshot and the live immutable event stream.
drop trigger if exists sales_capture_commission_operation_attribution on public.sales;
create trigger sales_capture_commission_operation_attribution
after insert or update of status, created_by on public.sales
for each row execute function public.capture_commission_operation_attribution();

drop trigger if exists repairs_capture_commission_operation_attribution on public.repairs;
create trigger repairs_capture_commission_operation_attribution
after insert or update of status, payment_status, technician_id, completed_at, delivered_at
on public.repairs
for each row execute function public.capture_commission_operation_attribution();

drop trigger if exists sale_items_capture_commission_attribution on public.sale_items;
create trigger sale_items_capture_commission_attribution
after insert or update of sale_id, product_id, quantity, subtotal on public.sale_items
for each row execute function public.capture_commission_sale_item_attribution();

insert into public.commission_operation_attributions (
  organization_id,
  branch_id,
  source_type,
  source_id,
  accrual_status,
  employee_id,
  employee_role,
  occurred_at,
  basis_amount,
  labor_basis_amount,
  capture_basis
)
select
  sale.organization_id,
  sale.branch_id,
  'sale',
  sale.id,
  null,
  sale.created_by,
  employment.employee_role,
  sale.created_at,
  coalesce(sale.total_amount, 0),
  0,
  'cutover_current_membership'
from public.sales sale
join lateral (
  select event.employee_role, event.employment_status
  from public.employee_employment_events event
  where event.organization_id = sale.organization_id
    and event.employee_id = sale.created_by
    and event.occurred_at <= sale.created_at
  order by event.occurred_at desc, event.id desc
  limit 1
) employment on true
where sale.organization_id is not null
  and sale.branch_id is not null
  and employment.employment_status = 'active'
  and employment.employee_role <> 'customer'
  and lower(coalesce(sale.status, 'completed')) in (
    'completed', 'refunded', 'cancelled', 'canceled', 'voided'
  )

union all

select
  repair.organization_id,
  repair.branch_id,
  'repair',
  repair.id,
  repair_event.accrual_status,
  repair.technician_id,
  employment.employee_role,
  repair_event.occurred_at,
  coalesce(repair.final_cost, repair.estimated_cost, 0),
  coalesce(repair.labor_cost, 0),
  'cutover_current_membership'
from public.repairs repair
cross join lateral (
  values
    ('listo'::text, repair.completed_at),
    ('entregado'::text, repair.delivered_at)
) as repair_event(accrual_status, occurred_at)
join lateral (
  select event.employee_role, event.employment_status
  from public.employee_employment_events event
  where event.organization_id = repair.organization_id
    and event.employee_id = repair.technician_id
    and event.occurred_at <= repair_event.occurred_at
  order by event.occurred_at desc, event.id desc
  limit 1
) employment on true
where repair.organization_id is not null
  and repair.branch_id is not null
  and repair_event.occurred_at is not null
  and employment.employment_status = 'active'
  and employment.employee_role <> 'customer'
  and lower(coalesce(repair.payment_status, '')) in ('pagado', 'paid')
  and lower(coalesce(repair.status::text, '')) in (
    'listo', 'entregado', 'cancelado', 'cancelled', 'canceled'
  )
on conflict (
  organization_id,
  source_type,
  source_id,
  (coalesce(accrual_status, 'sale'))
) do nothing;

insert into public.commission_sale_item_attributions (
  organization_id,
  branch_id,
  sale_id,
  sale_item_id,
  product_id,
  category_id,
  quantity,
  subtotal,
  occurred_at,
  capture_basis
)
select
  sale.organization_id,
  sale.branch_id,
  sale.id,
  item.id,
  item.product_id,
  product.category_id,
  item.quantity,
  coalesce(item.subtotal, 0),
  coalesce(sale.created_at, item.created_at, now()),
  'cutover_best_available'
from public.sale_items item
join public.sales sale
  on sale.organization_id = item.organization_id
 and sale.id = item.sale_id
left join public.products product
  on product.organization_id = item.organization_id
 and product.id = item.product_id
where sale.branch_id is not null
  and item.quantity > 0
on conflict (organization_id, sale_item_id) do nothing;

create or replace function public.capture_commission_terminal_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  terminal_source_type text;
  terminal_status text := lower(coalesce(new.status::text, ''));
  was_terminal boolean := false;
begin
  if tg_table_name = 'sales' then
    terminal_source_type := 'sale';
    if tg_op = 'UPDATE' then
      was_terminal := lower(coalesce(old.status::text, '')) in (
        'refunded', 'cancelled', 'canceled', 'voided'
      );
    end if;
    if terminal_status not in ('refunded', 'cancelled', 'canceled', 'voided') then
      return new;
    end if;
  elsif tg_table_name = 'repairs' then
    terminal_source_type := 'repair';
    if tg_op = 'UPDATE' then
      was_terminal := lower(coalesce(old.status::text, '')) in (
        'cancelado', 'cancelled', 'canceled'
      );
    end if;
    if terminal_status not in ('cancelado', 'cancelled', 'canceled') then
      return new;
    end if;
  else
    raise exception 'PAYROLL_UNSUPPORTED_TERMINAL_EVENT_SOURCE';
  end if;

  if was_terminal or new.organization_id is null or new.branch_id is null then
    return new;
  end if;

  insert into public.commission_terminal_events (
    organization_id,
    branch_id,
    source_type,
    source_id,
    source_status,
    occurred_at
  ) values (
    new.organization_id,
    new.branch_id,
    terminal_source_type,
    new.id,
    terminal_status,
    now()
  )
  on conflict (organization_id, source_type, source_id) do nothing;

  return new;
end;
$$;

-- Install the capture triggers before the backfill. Their table locks close the
-- migration race between the historical snapshot and future terminal writes.
drop trigger if exists sales_capture_commission_terminal_event on public.sales;
create trigger sales_capture_commission_terminal_event
after insert or update of status on public.sales
for each row execute function public.capture_commission_terminal_event();

drop trigger if exists repairs_capture_commission_terminal_event on public.repairs;
create trigger repairs_capture_commission_terminal_event
after insert or update of status on public.repairs
for each row execute function public.capture_commission_terminal_event();

-- Freeze the best available timestamp for operations already terminal at cutover.
insert into public.commission_terminal_events (
  organization_id,
  branch_id,
  source_type,
  source_id,
  source_status,
  occurred_at,
  timing_basis
)
select
  sale.organization_id,
  sale.branch_id,
  'sale',
  sale.id,
  lower(sale.status),
  coalesce(sale.updated_at, sale.created_at, now()),
  'cutover_best_available'
from public.sales sale
where sale.organization_id is not null
  and sale.branch_id is not null
  and lower(coalesce(sale.status, '')) in (
    'refunded', 'cancelled', 'canceled', 'voided'
  )

union all

select
  repair.organization_id,
  repair.branch_id,
  'repair',
  repair.id,
  lower(repair.status::text),
  coalesce(repair.updated_at, repair.completed_at, repair.created_at, now()),
  'cutover_best_available'
from public.repairs repair
where repair.organization_id is not null
  and repair.branch_id is not null
  and lower(coalesce(repair.status::text, '')) in (
    'cancelado', 'cancelled', 'canceled'
  )
on conflict (organization_id, source_type, source_id) do nothing;

create or replace function public.capture_commission_refund_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  canonical_organization_id uuid;
  canonical_branch_id uuid;
  canonical_source_amount numeric(14, 2);
  canonical_source_quantity numeric(14, 4);
begin
  if lower(coalesce(new.status, '')) not in ('completed', 'completado')
     or lower(coalesce(new.request_type, '')) not in ('return', 'devolucion') then
    return new;
  end if;

  if new.source_type = 'repair' and new.repair_id is not null then
    select repair.organization_id, repair.branch_id,
           coalesce(repair.final_cost, repair.estimated_cost, 0)
    into canonical_organization_id, canonical_branch_id, canonical_source_amount
    from public.repairs repair
    where repair.id = new.repair_id;
  elsif new.source_type = 'sale' and new.sale_id is not null then
    select sale.organization_id, sale.branch_id, coalesce(sale.total_amount, 0)
    into canonical_organization_id, canonical_branch_id, canonical_source_amount
    from public.sales sale
    where sale.id = new.sale_id;

    if new.sale_item_id is not null then
      select item.quantity::numeric(14, 4)
      into canonical_source_quantity
      from public.sale_items item
      where item.organization_id = canonical_organization_id
        and item.sale_id = new.sale_id
        and item.id = new.sale_item_id;

      if not found then
        raise exception 'PAYROLL_REFUND_ITEM_SCOPE_MISMATCH';
      end if;
    end if;
  else
    raise exception 'PAYROLL_REFUND_SOURCE_REQUIRED';
  end if;

  if canonical_organization_id is null
     or canonical_branch_id is null
     or canonical_organization_id is distinct from new.organization_id then
    raise exception 'PAYROLL_REFUND_SOURCE_SCOPE_MISMATCH';
  end if;

  insert into public.commission_refund_events (
    organization_id,
    branch_id,
    after_sales_case_id,
    source_type,
    sale_id,
    sale_item_id,
    repair_id,
    refund_amount,
    refund_quantity,
    source_amount,
    source_quantity,
    occurred_at
  ) values (
    canonical_organization_id,
    canonical_branch_id,
    new.id,
    new.source_type,
    new.sale_id,
    new.sale_item_id,
    new.repair_id,
    new.refund_amount,
    new.quantity,
    canonical_source_amount,
    canonical_source_quantity,
    coalesce(new.resolved_at, now())
  )
  on conflict (organization_id, after_sales_case_id) do nothing;

  return new;
end;
$$;

-- Capture first, then backfill, so no completed return can fall between the
-- historical snapshot and the live immutable stream.
drop trigger if exists after_sales_capture_commission_refund_event
  on public.after_sales_cases;
create trigger after_sales_capture_commission_refund_event
after insert or update of status, request_type, resolved_at, refund_amount,
  quantity, sale_id, sale_item_id, repair_id
on public.after_sales_cases
for each row execute function public.capture_commission_refund_event();

insert into public.commission_refund_events (
  organization_id,
  branch_id,
  after_sales_case_id,
  source_type,
  sale_id,
  sale_item_id,
  repair_id,
  refund_amount,
  refund_quantity,
  source_amount,
  source_quantity,
  occurred_at,
  timing_basis
)
select
  refund_case.organization_id,
  sale.branch_id,
  refund_case.id,
  'sale',
  refund_case.sale_id,
  refund_case.sale_item_id,
  null::uuid,
  refund_case.refund_amount,
  refund_case.quantity::numeric(14, 4),
  coalesce(sale.total_amount, 0),
  item.quantity::numeric(14, 4),
  coalesce(refund_case.resolved_at, refund_case.updated_at, refund_case.created_at, now()),
  'cutover_best_available'
from public.after_sales_cases refund_case
join public.sales sale
  on sale.organization_id = refund_case.organization_id
 and sale.id = refund_case.sale_id
left join public.sale_items item
  on item.organization_id = refund_case.organization_id
 and item.sale_id = refund_case.sale_id
 and item.id = refund_case.sale_item_id
where lower(refund_case.status) in ('completed', 'completado')
  and lower(refund_case.request_type) in ('return', 'devolucion')
  and sale.branch_id is not null
  and (refund_case.sale_item_id is null or item.id is not null)

union all

select
  refund_case.organization_id,
  repair.branch_id,
  refund_case.id,
  'repair',
  null::uuid,
  null::uuid,
  refund_case.repair_id,
  refund_case.refund_amount,
  refund_case.quantity::numeric(14, 4),
  coalesce(repair.final_cost, repair.estimated_cost, 0),
  null::numeric(14, 4),
  coalesce(refund_case.resolved_at, refund_case.updated_at, refund_case.created_at, now()),
  'cutover_best_available'
from public.after_sales_cases refund_case
join public.repairs repair
  on repair.organization_id = refund_case.organization_id
 and repair.id = refund_case.repair_id
where lower(refund_case.status) in ('completed', 'completado')
  and lower(refund_case.request_type) in ('return', 'devolucion')
  and repair.branch_id is not null
on conflict (organization_id, after_sales_case_id) do nothing;

create or replace function public.calculate_earned_commissions(
  p_organization_id uuid,
  p_period_from date,
  p_period_to date,
  p_branch_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  organization_timezone text := 'America/Asuncion';
  accrual_count integer := 0;
  terminal_reversal_count integer := 0;
  refund_reversal_count integer := 0;
begin
  if p_organization_id is null then
    raise exception 'PAYROLL_ORGANIZATION_REQUIRED';
  end if;
  if p_period_from is null or p_period_to is null or p_period_to < p_period_from then
    raise exception 'PAYROLL_INVALID_PERIOD';
  end if;
  if actor_id is not null and not (
    public.has_org_permission(p_organization_id, 'finances.manage')
    or public.get_user_role(actor_id) = 'super_admin'
  ) then
    raise exception 'PAYROLL_COMMISSION_PERMISSION_DENIED';
  end if;
  if p_branch_id is not null then
    if not exists (
      select 1
      from public.branches branch
      where branch.organization_id = p_organization_id
        and branch.id = p_branch_id
        and branch.is_active = true
    ) then
      raise exception 'PAYROLL_BRANCH_NOT_IN_ORGANIZATION';
    end if;
    if actor_id is not null and not public.user_has_branch_access(p_branch_id, actor_id) then
      raise exception 'PAYROLL_BRANCH_PERMISSION_DENIED';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':earned-commissions',
    0
  ));

  select timezone_record.name
  into organization_timezone
  from public.organization_settings settings
  join pg_timezone_names timezone_record
    on timezone_record.name = settings.timezone
  where settings.organization_id = p_organization_id
  limit 1;
  organization_timezone := coalesce(organization_timezone, 'America/Asuncion');

  with operation_candidates as (
    select
      'sale:' || attribution.source_id::text as candidate_key,
      attribution.employee_id,
      attribution.employee_role,
      attribution.branch_id,
      'sale'::text as source_type,
      null::uuid as source_reference_id,
      null::text as accrual_status,
      'sale'::text as origin_type,
      attribution.source_id as origin_id,
      attribution.source_id as parent_origin_id,
      null::numeric(14, 4) as source_quantity,
      attribution.occurred_at,
      (attribution.occurred_at at time zone organization_timezone)::date as occurred_on,
      attribution.basis_amount
    from public.commission_operation_attributions attribution
    where attribution.organization_id = p_organization_id
      and attribution.source_type = 'sale'
      and (p_branch_id is null or attribution.branch_id = p_branch_id)
      and (attribution.occurred_at at time zone organization_timezone)::date
        between p_period_from and p_period_to
      and attribution.basis_amount > 0

    union all

    select
      'product:' || item_attribution.sale_item_id::text,
      attribution.employee_id,
      attribution.employee_role,
      attribution.branch_id,
      'product'::text,
      item_attribution.product_id,
      null::text,
      'sale_item'::text,
      item_attribution.sale_item_id,
      item_attribution.sale_id,
      item_attribution.quantity,
      attribution.occurred_at,
      (attribution.occurred_at at time zone organization_timezone)::date,
      item_attribution.subtotal::numeric(14, 2)
    from public.commission_operation_attributions attribution
    join public.commission_sale_item_attributions item_attribution
      on item_attribution.organization_id = attribution.organization_id
     and item_attribution.sale_id = attribution.source_id
    where attribution.organization_id = p_organization_id
      and attribution.source_type = 'sale'
      and (p_branch_id is null or attribution.branch_id = p_branch_id)
      and (attribution.occurred_at at time zone organization_timezone)::date
        between p_period_from and p_period_to
      and item_attribution.product_id is not null
      and item_attribution.subtotal > 0

    union all

    select
      'category:' || item_attribution.sale_item_id::text,
      attribution.employee_id,
      attribution.employee_role,
      attribution.branch_id,
      'category'::text,
      item_attribution.category_id,
      null::text,
      'sale_item'::text,
      item_attribution.sale_item_id,
      item_attribution.sale_id,
      item_attribution.quantity,
      attribution.occurred_at,
      (attribution.occurred_at at time zone organization_timezone)::date,
      item_attribution.subtotal::numeric(14, 2)
    from public.commission_operation_attributions attribution
    join public.commission_sale_item_attributions item_attribution
      on item_attribution.organization_id = attribution.organization_id
     and item_attribution.sale_id = attribution.source_id
    where attribution.organization_id = p_organization_id
      and attribution.source_type = 'sale'
      and (p_branch_id is null or attribution.branch_id = p_branch_id)
      and (attribution.occurred_at at time zone organization_timezone)::date
        between p_period_from and p_period_to
      and item_attribution.category_id is not null
      and item_attribution.subtotal > 0

    union all

    select
      'repair:' || attribution.source_id::text,
      attribution.employee_id,
      attribution.employee_role,
      attribution.branch_id,
      'repair'::text,
      null::uuid,
      attribution.accrual_status,
      'repair'::text,
      attribution.source_id,
      attribution.source_id,
      null::numeric(14, 4),
      attribution.occurred_at,
      (attribution.occurred_at at time zone organization_timezone)::date,
      attribution.basis_amount
    from public.commission_operation_attributions attribution
    where attribution.organization_id = p_organization_id
      and attribution.source_type = 'repair'
      and (p_branch_id is null or attribution.branch_id = p_branch_id)
      and (attribution.occurred_at at time zone organization_timezone)::date
        between p_period_from and p_period_to
      and attribution.basis_amount > 0

    union all

    select
      'repair-labor:' || attribution.source_id::text,
      attribution.employee_id,
      attribution.employee_role,
      attribution.branch_id,
      'repair_labor'::text,
      null::uuid,
      attribution.accrual_status,
      'repair'::text,
      attribution.source_id,
      attribution.source_id,
      null::numeric(14, 4),
      attribution.occurred_at,
      (attribution.occurred_at at time zone organization_timezone)::date,
      attribution.labor_basis_amount
    from public.commission_operation_attributions attribution
    where attribution.organization_id = p_organization_id
      and attribution.source_type = 'repair'
      and (p_branch_id is null or attribution.branch_id = p_branch_id)
      and (attribution.occurred_at at time zone organization_timezone)::date
        between p_period_from and p_period_to
      and attribution.labor_basis_amount > 0
  ),
  ranked_rules as (
    select
      candidate.*,
      rule.id as commission_rule_id,
      rule.calculation_type,
      rule.value,
      row_number() over (
        partition by candidate.candidate_key, rule.calculation_type
        order by
          case when rule.scope_type = 'employee' then 1 else 0 end desc,
          case when rule.branch_id is not null then 1 else 0 end desc,
          candidate.occurred_at,
          rule.effective_from desc,
          rule.id
      ) as rule_rank
    from operation_candidates candidate
    join public.commission_rules rule
      on rule.organization_id = p_organization_id
     and rule.status = 'approved'
     and rule.source_type = candidate.source_type
     and (rule.branch_id is null or rule.branch_id = candidate.branch_id)
     and rule.effective_from <= candidate.occurred_on
     and (rule.effective_to is null or rule.effective_to >= candidate.occurred_on)
     and candidate.occurred_on >= coalesce(rule.legacy_cutover_on, rule.effective_from)
     and rule.source_reference_id is not distinct from candidate.source_reference_id
     and (
       candidate.source_type not in ('repair', 'repair_labor')
       or (
         rule.accrual_status = 'entregado'
         and candidate.accrual_status = 'entregado'
       )
       or (
         rule.accrual_status = 'listo'
         and candidate.accrual_status in ('listo', 'entregado')
       )
     )
     and (
       (
         rule.scope_type = 'employee'
         and rule.employee_id = candidate.employee_id
       )
       or (
         rule.scope_type = 'role'
         and rule.role = candidate.employee_role
       )
     )
  )
  insert into public.earned_commissions (
    organization_id,
    branch_id,
    employee_id,
    commission_rule_id,
    entry_kind,
    source_type,
    origin_type,
    origin_id,
    origin_key,
    occurred_on,
    basis_amount,
    amount,
    employee_role,
    rule_snapshot
  )
  select
    p_organization_id,
    ranked.branch_id,
    ranked.employee_id,
    ranked.commission_rule_id,
    'accrual',
    ranked.source_type,
    ranked.origin_type,
    ranked.origin_id,
    'accrual:' || ranked.source_type || ':' || ranked.origin_id::text
      || ':' || ranked.calculation_type,
    ranked.occurred_on,
    ranked.basis_amount,
    case ranked.calculation_type
      when 'percentage' then round(ranked.basis_amount * ranked.value / 100, 2)
      else ranked.value
    end,
    ranked.employee_role,
    jsonb_build_object(
      'calculation_type', ranked.calculation_type,
      'value', ranked.value,
      'source_type', ranked.source_type,
      'accrual_status', ranked.accrual_status,
      'parent_origin_id', ranked.parent_origin_id,
      'source_quantity', ranked.source_quantity
    )
  from ranked_rules ranked
  where ranked.rule_rank = 1
    and case ranked.calculation_type
      when 'percentage' then round(ranked.basis_amount * ranked.value / 100, 2)
      else ranked.value
    end > 0
  on conflict (organization_id, origin_key) do nothing;

  get diagnostics accrual_count = row_count;

  with terminal_events as (
    select
      commission.id as accrual_id,
      terminal_event.source_id as terminal_origin_id,
      (terminal_event.occurred_at at time zone organization_timezone)::date as reversed_on
    from public.earned_commissions commission
    join public.commission_terminal_events terminal_event
      on commission.origin_type = 'sale'
     and terminal_event.organization_id = commission.organization_id
     and terminal_event.branch_id = commission.branch_id
     and terminal_event.source_type = 'sale'
     and terminal_event.source_id = commission.origin_id
    where commission.organization_id = p_organization_id
      and commission.entry_kind = 'accrual'
      and (p_branch_id is null or commission.branch_id = p_branch_id)
      and (terminal_event.occurred_at at time zone organization_timezone)::date
        <= p_period_to

    union all

    select
      commission.id,
      terminal_event.source_id,
      (terminal_event.occurred_at at time zone organization_timezone)::date
    from public.earned_commissions commission
    join public.commission_terminal_events terminal_event
      on terminal_event.organization_id = commission.organization_id
     and terminal_event.branch_id = commission.branch_id
     and terminal_event.source_type = 'sale'
     and terminal_event.source_id = (
       commission.rule_snapshot ->> 'parent_origin_id'
     )::uuid
    where commission.organization_id = p_organization_id
      and commission.entry_kind = 'accrual'
      and commission.origin_type = 'sale_item'
      and (p_branch_id is null or commission.branch_id = p_branch_id)
      and (terminal_event.occurred_at at time zone organization_timezone)::date
        <= p_period_to

    union all

    select
      commission.id,
      terminal_event.source_id,
      (terminal_event.occurred_at at time zone organization_timezone)::date
    from public.earned_commissions commission
    join public.commission_terminal_events terminal_event
      on commission.origin_type = 'repair'
     and terminal_event.organization_id = commission.organization_id
     and terminal_event.branch_id = commission.branch_id
     and terminal_event.source_type = 'repair'
     and terminal_event.source_id = commission.origin_id
    where commission.organization_id = p_organization_id
      and commission.entry_kind = 'accrual'
      and (p_branch_id is null or commission.branch_id = p_branch_id)
      and (terminal_event.occurred_at at time zone organization_timezone)::date
        <= p_period_to
  ),
  terminal_accruals as (
    select distinct on (event.accrual_id)
      accrual.*,
      event.terminal_origin_id,
      event.reversed_on,
      greatest(
        accrual.amount + coalesce(sum(existing_reversal.amount), 0),
        0
      )::numeric(14, 2) as remaining_amount
    from terminal_events event
    join public.earned_commissions accrual
      on accrual.organization_id = p_organization_id
     and accrual.id = event.accrual_id
    left join public.earned_commissions existing_reversal
      on existing_reversal.organization_id = accrual.organization_id
     and existing_reversal.reverses_commission_id = accrual.id
     and existing_reversal.entry_kind = 'reversal'
    group by accrual.id, event.terminal_origin_id, event.reversed_on
    order by event.accrual_id, event.reversed_on, event.terminal_origin_id
  )
  insert into public.earned_commissions (
    organization_id,
    branch_id,
    employee_id,
    commission_rule_id,
    entry_kind,
    source_type,
    origin_type,
    origin_id,
    origin_key,
    reverses_commission_id,
    occurred_on,
    basis_amount,
    amount,
    employee_role,
    rule_snapshot
  )
  select
    terminal.organization_id,
    terminal.branch_id,
    terminal.employee_id,
    terminal.commission_rule_id,
    'reversal',
    terminal.source_type,
    'terminal_status',
    terminal.terminal_origin_id,
    'terminal-status:' || terminal.terminal_origin_id::text
      || ':' || terminal.id::text,
    terminal.id,
    terminal.reversed_on,
    terminal.basis_amount,
    -terminal.remaining_amount,
    terminal.employee_role,
    terminal.rule_snapshot || jsonb_build_object('reversal_reason', 'terminal_status')
  from terminal_accruals terminal
  where terminal.remaining_amount > 0
  on conflict (organization_id, origin_key) do nothing;

  get diagnostics terminal_reversal_count = row_count;

  with refund_matches as (
    select
      accrual.*,
      refund_event.id as refund_case_id,
      (refund_event.occurred_at at time zone organization_timezone)::date as refunded_on,
      least(
        1::numeric,
        greatest(
          0::numeric,
          case
            when accrual.origin_type = 'sale_item'
                 and refund_event.sale_item_id is not null then
              coalesce(
                refund_event.refund_quantity
                  / nullif(refund_event.source_quantity, 0),
                1
              )
            when refund_event.sale_id is not null then
              coalesce(
                refund_event.refund_amount / nullif(refund_event.source_amount, 0),
                1
              )
            when refund_event.repair_id is not null then
              coalesce(
                refund_event.refund_amount / nullif(refund_event.source_amount, 0),
                1
              )
            else 1
          end
        )
      ) as refund_ratio
    from public.commission_refund_events refund_event
    join public.earned_commissions accrual
      on accrual.organization_id = refund_event.organization_id
     and accrual.entry_kind = 'accrual'
     and (
       (accrual.origin_type = 'sale' and accrual.origin_id = refund_event.sale_id)
       or (
         accrual.origin_type = 'sale_item'
         and (accrual.rule_snapshot ->> 'parent_origin_id')::uuid = refund_event.sale_id
         and (
           refund_event.sale_item_id is null
           or refund_event.sale_item_id = accrual.origin_id
         )
       )
       or (accrual.origin_type = 'repair' and accrual.origin_id = refund_event.repair_id)
     )
    where refund_event.organization_id = p_organization_id
      and (p_branch_id is null or accrual.branch_id = p_branch_id)
      and (refund_event.occurred_at at time zone organization_timezone)::date
        <= p_period_to
      and not exists (
        select 1
        from public.earned_commissions materialized_reversal
        where materialized_reversal.organization_id = accrual.organization_id
          and materialized_reversal.origin_key = 'after-sales:'
            || refund_event.id::text || ':' || accrual.id::text
      )
  ),
  requested_refunds as (
    select
      refund.*,
      round(refund.amount * refund.refund_ratio, 2) as requested_amount,
      coalesce((
        select sum(existing_reversal.amount)
        from public.earned_commissions existing_reversal
        where existing_reversal.organization_id = refund.organization_id
          and existing_reversal.reverses_commission_id = refund.id
          and existing_reversal.entry_kind = 'reversal'
      ), 0) as existing_reversals
    from refund_matches refund
  ),
  bounded_refunds as (
    select
      requested.*,
      least(
        requested.requested_amount,
        greatest(
          requested.amount + requested.existing_reversals
            - coalesce(sum(requested.requested_amount) over (
                partition by requested.id
                order by requested.refunded_on, requested.refund_case_id
                rows between unbounded preceding and 1 preceding
              ), 0),
          0
        )
      )::numeric(14, 2) as reversal_amount
    from requested_refunds requested
  )
  insert into public.earned_commissions (
    organization_id,
    branch_id,
    employee_id,
    commission_rule_id,
    entry_kind,
    source_type,
    origin_type,
    origin_id,
    origin_key,
    reverses_commission_id,
    occurred_on,
    basis_amount,
    amount,
    employee_role,
    rule_snapshot
  )
  select
    refund.organization_id,
    refund.branch_id,
    refund.employee_id,
    refund.commission_rule_id,
    'reversal',
    refund.source_type,
    'after_sales',
    refund.refund_case_id,
    'after-sales:' || refund.refund_case_id::text || ':' || refund.id::text,
    refund.id,
    refund.refunded_on,
    refund.basis_amount,
    -refund.reversal_amount,
    refund.employee_role,
    refund.rule_snapshot || jsonb_build_object(
      'reversal_reason', 'refund',
      'refund_ratio', refund.refund_ratio
    )
  from bounded_refunds refund
  where refund.reversal_amount > 0
  on conflict (organization_id, origin_key) do nothing;

  get diagnostics refund_reversal_count = row_count;

  return accrual_count + terminal_reversal_count + refund_reversal_count;
end;
$$;

create or replace function public.generate_payroll_run_atomic(
  p_organization_id uuid,
  p_period_from date,
  p_period_to date,
  p_idempotency_key text,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  created_run public.payroll_runs%rowtype;
  existing_run public.payroll_runs%rowtype;
  organization_currency text;
  organization_timezone text := 'America/Asuncion';
begin
  if actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not (
    public.has_org_permission(p_organization_id, 'finances.manage')
    or public.get_user_role(actor_id) = 'super_admin'
  ) then
    raise exception 'PAYROLL_GENERATION_PERMISSION_DENIED';
  end if;
  if p_period_from is null or p_period_to is null or p_period_to < p_period_from then
    raise exception 'PAYROLL_INVALID_PERIOD';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
     or char_length(trim(p_idempotency_key)) > 128
     or lower(trim(p_idempotency_key)) like 'payroll-system:%'
     or lower(trim(p_idempotency_key)) like 'legacy-technician:%' then
    raise exception 'PAYROLL_INVALID_IDEMPOTENCY_KEY';
  end if;
  if p_branch_id is not null then
    if not exists (
      select 1
      from public.branches branch
      where branch.organization_id = p_organization_id
        and branch.id = p_branch_id
        and branch.is_active = true
    ) then
      raise exception 'PAYROLL_BRANCH_NOT_IN_ORGANIZATION';
    end if;
    if not public.user_has_branch_access(p_branch_id, actor_id) then
      raise exception 'PAYROLL_BRANCH_PERMISSION_DENIED';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_organization_id::text || ':payroll-run',
    0
  ));

  select timezone_record.name
  into organization_timezone
  from public.organization_settings settings
  join pg_timezone_names timezone_record
    on timezone_record.name = settings.timezone
  where settings.organization_id = p_organization_id
  limit 1;
  organization_timezone := coalesce(organization_timezone, 'America/Asuncion');

  select run.*
  into existing_run
  from public.payroll_runs run
  where run.organization_id = p_organization_id
    and run.branch_id is not distinct from p_branch_id
    and run.idempotency_key = trim(p_idempotency_key)
  for update;

  if found then
    if existing_run.period_from is distinct from p_period_from
       or existing_run.period_to is distinct from p_period_to
       or existing_run.run_type <> 'standard' then
      raise exception 'PAYROLL_GENERATION_IDEMPOTENCY_KEY_REUSED';
    end if;

    return jsonb_build_object(
      'run', to_jsonb(existing_run),
      'entries', (
        select coalesce(jsonb_agg(to_jsonb(entry) order by entry.employee_id), '[]'::jsonb)
        from public.payroll_entries entry
        where entry.organization_id = p_organization_id
          and entry.payroll_run_id = existing_run.id
      )
    );
  end if;

  if exists (
    select 1
    from public.payroll_runs run
    where run.organization_id = p_organization_id
      and run.run_type = 'standard'
      and run.status in ('draft', 'approved')
      and daterange(run.period_from, run.period_to + 1, '[)')
        && daterange(p_period_from, p_period_to + 1, '[)')
      and (
        run.branch_id is null
        or p_branch_id is null
        or run.branch_id = p_branch_id
      )
  ) then
    raise exception 'PAYROLL_PERIOD_ALREADY_GENERATED';
  end if;

  perform public.calculate_earned_commissions(
    p_organization_id,
    p_period_from,
    p_period_to,
    p_branch_id
  );

  select coalesce(settings.currency, 'PYG')
  into organization_currency
  from public.organization_settings settings
  where settings.organization_id = p_organization_id;
  organization_currency := coalesce(organization_currency, 'PYG');

  insert into public.payroll_runs (
    organization_id,
    branch_id,
    allocation_scope,
    period_from,
    period_to,
    idempotency_key,
    status,
    run_type,
    currency,
    generated_by
  ) values (
    p_organization_id,
    p_branch_id,
    case when p_branch_id is null then 'organization' else 'branch' end,
    p_period_from,
    p_period_to,
    trim(p_idempotency_key),
    'draft',
    'standard',
    organization_currency,
    actor_id
  )
  returning * into created_run;

  with unclaimed_scoped_commission as (
    select distinct on (commission.employee_id)
      commission.employee_id,
      commission.employee_role
    from public.earned_commissions commission
    where commission.organization_id = p_organization_id
      and (p_branch_id is null or commission.branch_id = p_branch_id)
      and commission.occurred_on <= p_period_to
      and not exists (
        select 1
        from public.payroll_entry_commissions claimed
        where claimed.organization_id = commission.organization_id
          and claimed.earned_commission_id = commission.id
      )
    order by
      commission.employee_id,
      commission.occurred_on desc,
      commission.created_at desc,
      commission.id
  ),
  employment_intervals as (
    select
      employment.id,
      employment.employee_id,
      employment.employee_role,
      employment.employment_status,
      employment.occurred_at,
      lead(employment.occurred_at) over (
        partition by employment.organization_id, employment.employee_id
        order by employment.occurred_at, employment.id
      ) as ended_at
    from public.employee_employment_events employment
    where employment.organization_id = p_organization_id
  ),
  active_employment_in_period as (
    select distinct on (employment.employee_id)
      employment.employee_id,
      employment.employee_role
    from employment_intervals employment
    where employment.employment_status = 'active'
      and employment.employee_role <> 'customer'
      and employment.occurred_at
        < ((p_period_to + 1)::timestamp at time zone organization_timezone)
      and coalesce(employment.ended_at, 'infinity'::timestamptz)
        > (p_period_from::timestamp at time zone organization_timezone)
    order by employment.employee_id, employment.occurred_at desc, employment.id desc
  ),
  salary_allocation_conflict as (
    select distinct allocated_entry.employee_id
    from public.payroll_entries allocated_entry
    join public.payroll_runs allocated_run
      on allocated_run.organization_id = allocated_entry.organization_id
     and allocated_run.id = allocated_entry.payroll_run_id
    where allocated_entry.organization_id = p_organization_id
      and allocated_entry.base_amount > 0
      and allocated_run.run_type = 'standard'
      and allocated_run.status in ('draft', 'approved')
      and daterange(allocated_run.period_from, allocated_run.period_to + 1, '[)')
        && daterange(p_period_from, p_period_to + 1, '[)')
  ),
  active_staff as (
    select
      membership.user_id,
      coalesce(employment.employee_role, unclaimed_commission.employee_role) as role,
      (
        employment.employee_id is not null
        and (
          p_branch_id is null
           or exists (
            select 1
            from public.user_branch_assignments assignment
            where assignment.organization_id = membership.organization_id
              and assignment.user_id = membership.user_id
              and assignment.branch_id = p_branch_id
              and assignment.is_active = true
               and assignment.is_primary = true
           )
         )
        and not exists (
          select 1
          from salary_allocation_conflict allocation_conflict
          where allocation_conflict.employee_id = membership.user_id
        )
      ) as salary_eligible
    from public.organization_members membership
    left join active_employment_in_period employment
      on employment.employee_id = membership.user_id
    left join unclaimed_scoped_commission unclaimed_commission
      on unclaimed_commission.employee_id = membership.user_id
    where membership.organization_id = p_organization_id
      and (
        (
          employment.employee_id is not null
          and (
            p_branch_id is null
            or exists (
              select 1
              from public.user_branch_assignments assignment
              where assignment.organization_id = membership.organization_id
                and assignment.user_id = membership.user_id
                and assignment.branch_id = p_branch_id
                and assignment.is_active = true
                and assignment.is_primary = true
            )
          )
        )
        or unclaimed_commission.employee_id is not null
      )
  ),
  staff_salary as (
    select
      staff.user_id,
      staff.role,
      round(coalesce(sum(
        coalesce(
          case
            when staff.salary_eligible
              and daily_employment.employment_status = 'active'
              and daily_employment.employee_role <> 'customer'
              then compensation.base_salary
            else 0
          end,
          0
        )
          / extract(day from (
              date_trunc('month', pay_day)::date + interval '1 month - 1 day'
            ))
      ), 0), 2)::numeric(14, 2) as base_amount
    from active_staff staff
    cross join generate_series(
      p_period_from,
      p_period_to,
      interval '1 day'
    ) pay_day
    left join lateral (
      select
        employment.employee_role,
        employment.employment_status
      from public.employee_employment_events employment
      where employment.organization_id = p_organization_id
        and employment.employee_id = staff.user_id
        and employment.occurred_at
          < ((pay_day::date + 1)::timestamp at time zone organization_timezone)
      order by employment.occurred_at desc, employment.id desc
      limit 1
    ) daily_employment on true
    left join lateral (
      select compensation_record.base_salary
      from public.employee_compensation compensation_record
      where compensation_record.organization_id = p_organization_id
        and compensation_record.employee_id = staff.user_id
        and compensation_record.effective_from <= pay_day::date
        and pay_day::date >= coalesce(
          compensation_record.legacy_cutover_on,
          compensation_record.effective_from
        )
        and (
          compensation_record.effective_to is null
          or compensation_record.effective_to >= pay_day::date
        )
      order by compensation_record.effective_from desc, compensation_record.id
      limit 1
    ) compensation on true
    group by staff.user_id, staff.role, staff.salary_eligible
  ),
  staff_commission as (
    select
      staff.user_id,
      coalesce(sum(commission.amount), 0)::numeric(14, 2) as commission_amount
    from active_staff staff
    left join public.earned_commissions commission
      on commission.organization_id = p_organization_id
     and commission.employee_id = staff.user_id
     and commission.occurred_on <= p_period_to
     and (p_branch_id is null or commission.branch_id = p_branch_id)
     and not exists (
          select 1
          from public.payroll_entry_commissions claimed
          where claimed.organization_id = commission.organization_id
            and claimed.earned_commission_id = commission.id
        )
    group by staff.user_id
  )
  insert into public.payroll_entries (
    organization_id,
    branch_id,
    allocation_scope,
    payroll_run_id,
    employee_id,
    employee_role,
    base_amount,
    commission_amount,
    gross_amount,
    net_amount
  )
  select
    p_organization_id,
    p_branch_id,
    case when p_branch_id is null then 'organization' else 'branch' end,
    created_run.id,
    salary.user_id,
    salary.role,
    salary.base_amount,
    commission.commission_amount,
    salary.base_amount + commission.commission_amount,
    salary.base_amount + commission.commission_amount
  from staff_salary salary
  join staff_commission commission on commission.user_id = salary.user_id;

  insert into public.payroll_entry_commissions (
    organization_id,
    payroll_entry_id,
    earned_commission_id
  )
  select
    p_organization_id,
    entry.id,
    commission.id
  from public.payroll_entries entry
  join public.earned_commissions commission
    on commission.organization_id = entry.organization_id
   and commission.employee_id = entry.employee_id
   and commission.occurred_on <= p_period_to
   and (p_branch_id is null or commission.branch_id = p_branch_id)
  where entry.organization_id = p_organization_id
    and entry.payroll_run_id = created_run.id
    and not exists (
      select 1
      from public.payroll_entry_commissions existing_claim
      where existing_claim.organization_id = commission.organization_id
        and existing_claim.earned_commission_id = commission.id
    )
  on conflict (organization_id, earned_commission_id) do nothing;

  update public.payroll_runs run
  set
    base_amount = totals.base_amount,
    commission_amount = totals.commission_amount,
    gross_amount = totals.gross_amount,
    net_amount = totals.net_amount,
    updated_at = now()
  from (
    select
      coalesce(sum(entry.base_amount), 0)::numeric(14, 2) as base_amount,
      coalesce(sum(entry.commission_amount), 0)::numeric(14, 2) as commission_amount,
      coalesce(sum(entry.gross_amount), 0)::numeric(14, 2) as gross_amount,
      coalesce(sum(entry.net_amount), 0)::numeric(14, 2) as net_amount
    from public.payroll_entries entry
    where entry.organization_id = p_organization_id
      and entry.payroll_run_id = created_run.id
  ) totals
  where run.organization_id = p_organization_id
    and run.id = created_run.id
  returning run.* into created_run;

  return jsonb_build_object(
    'run', to_jsonb(created_run),
    'entries', (
      select coalesce(jsonb_agg(to_jsonb(entry) order by entry.employee_id), '[]'::jsonb)
      from public.payroll_entries entry
      where entry.organization_id = p_organization_id
        and entry.payroll_run_id = created_run.id
    )
  );
end;
$$;

create or replace function public.approve_payroll_run_atomic(
  p_organization_id uuid,
  p_payroll_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  target_run public.payroll_runs%rowtype;
  entries_base_amount numeric(14, 2);
  entries_commission_amount numeric(14, 2);
  entries_adjustment_amount numeric(14, 2);
  entries_gross_amount numeric(14, 2);
  entries_net_amount numeric(14, 2);
begin
  if actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not (
    public.has_org_permission(p_organization_id, 'finances.manage')
    or public.get_user_role(actor_id) = 'super_admin'
  ) then
    raise exception 'PAYROLL_APPROVAL_PERMISSION_DENIED';
  end if;

  select run.*
  into target_run
  from public.payroll_runs run
  where run.organization_id = p_organization_id
    and run.id = p_payroll_run_id
  for update;

  if not found then
    raise exception 'PAYROLL_RUN_NOT_FOUND';
  end if;
  if target_run.branch_id is not null
     and not public.user_has_branch_access(target_run.branch_id, actor_id) then
    raise exception 'PAYROLL_BRANCH_PERMISSION_DENIED';
  end if;
  if target_run.status = 'approved' then
    return to_jsonb(target_run);
  end if;
  if target_run.status <> 'draft' then
    raise exception 'PAYROLL_RUN_NOT_APPROVABLE';
  end if;
  if not exists (
    select 1
    from public.payroll_entries entry
    where entry.organization_id = p_organization_id
      and entry.payroll_run_id = p_payroll_run_id
  ) then
    raise exception 'PAYROLL_RUN_HAS_NO_ENTRIES';
  end if;

  perform 1
  from public.payroll_entries entry
  where entry.organization_id = p_organization_id
    and entry.payroll_run_id = p_payroll_run_id
  order by entry.id
  for update;

  if target_run.run_type = 'standard' and exists (
    select 1
    from public.payroll_entries entry
    left join public.payroll_entry_commissions link
      on link.organization_id = entry.organization_id
     and link.payroll_entry_id = entry.id
    left join public.earned_commissions commission
      on commission.organization_id = link.organization_id
     and commission.id = link.earned_commission_id
    where entry.organization_id = p_organization_id
      and entry.payroll_run_id = p_payroll_run_id
    group by entry.id, entry.commission_amount
    having entry.commission_amount is distinct from
      coalesce(sum(commission.amount), 0)::numeric(14, 2)
  ) then
    raise exception 'PAYROLL_COMMISSION_SNAPSHOT_MISMATCH';
  end if;

  select
    coalesce(sum(entry.base_amount), 0)::numeric(14, 2),
    coalesce(sum(entry.commission_amount), 0)::numeric(14, 2),
    coalesce(sum(entry.adjustment_amount), 0)::numeric(14, 2),
    coalesce(sum(entry.gross_amount), 0)::numeric(14, 2),
    coalesce(sum(entry.net_amount), 0)::numeric(14, 2)
  into
    entries_base_amount,
    entries_commission_amount,
    entries_adjustment_amount,
    entries_gross_amount,
    entries_net_amount
  from public.payroll_entries entry
  where entry.organization_id = p_organization_id
    and entry.payroll_run_id = p_payroll_run_id;

  if target_run.base_amount is distinct from entries_base_amount
     or target_run.commission_amount is distinct from entries_commission_amount
     or target_run.adjustment_amount is distinct from entries_adjustment_amount
     or target_run.gross_amount is distinct from entries_gross_amount
     or target_run.net_amount is distinct from entries_net_amount then
    raise exception 'PAYROLL_RUN_TOTALS_MISMATCH';
  end if;

  update public.payroll_runs run
  set
    status = 'approved',
    approved_by = actor_id,
    approved_at = now(),
    updated_at = now()
  where run.organization_id = p_organization_id
    and run.id = p_payroll_run_id
  returning run.* into target_run;

  return to_jsonb(target_run);
end;
$$;

create or replace function public.validate_payroll_payment_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_run_id uuid;
  target_entry public.payroll_entries%rowtype;
  target_run public.payroll_runs%rowtype;
  original_payment public.payroll_payments%rowtype;
  adjusted_payable numeric(14, 2);
  current_paid numeric(14, 2);
begin
  select entry.payroll_run_id
  into target_run_id
  from public.payroll_entries entry
  where entry.organization_id = new.organization_id
    and entry.id = new.payroll_entry_id;

  if not found then
    raise exception 'PAYROLL_ENTRY_NOT_FOUND';
  end if;

  select run.*
  into target_run
  from public.payroll_runs run
  where run.organization_id = new.organization_id
    and run.id = target_run_id
  for update;

  select entry.*
  into target_entry
  from public.payroll_entries entry
  where entry.organization_id = new.organization_id
    and entry.id = new.payroll_entry_id
    and entry.payroll_run_id = target_run.id
  for update;

  if not found then
    raise exception 'PAYROLL_ENTRY_NOT_FOUND';
  end if;

  if target_run.status <> 'approved' then
    raise exception 'PAYROLL_ENTRY_NOT_PAYABLE';
  end if;
  if target_entry.branch_id is not null
     and target_entry.branch_id <> new.branch_id then
    raise exception 'PAYROLL_PAYMENT_BRANCH_MISMATCH';
  end if;

  select target_entry.net_amount + coalesce(sum(adjustment.amount) filter (
    where adjustment.included_in_net = false
  ), 0)
  into adjusted_payable
  from public.payroll_adjustments adjustment
  where adjustment.organization_id = new.organization_id
    and adjustment.payroll_entry_id = new.payroll_entry_id;

  select coalesce(sum(
    case payment.direction when 'payment' then payment.amount else -payment.amount end
  ), 0)
  into current_paid
  from public.payroll_payments payment
  where payment.organization_id = new.organization_id
    and payment.payroll_entry_id = new.payroll_entry_id;

  if new.direction = 'payment' then
    if adjusted_payable <= 0 then
      raise exception 'PAYROLL_ENTRY_NOT_PAYABLE';
    end if;
    if current_paid + new.amount > adjusted_payable then
      raise exception 'PAYROLL_OVERPAYMENT';
    end if;
  else
    select payment.*
    into original_payment
    from public.payroll_payments payment
    where payment.organization_id = new.organization_id
      and payment.branch_id is not distinct from new.branch_id
      and payment.payroll_entry_id = new.payroll_entry_id
      and payment.id = new.reverses_payment_id
      and payment.direction = 'payment'
    for update;

    if not found
       or original_payment.amount <> new.amount
       or original_payment.payment_method <> new.payment_method then
      raise exception 'PAYROLL_REVERSAL_MUST_COMPENSATE_PAYMENT';
    end if;
    if current_paid - new.amount < 0 then
      raise exception 'PAYROLL_REVERSAL_EXCEEDS_PAID_AMOUNT';
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

create or replace function public.sync_payroll_entry_from_payment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  ledger_paid numeric(14, 2);
  adjusted_payable numeric(14, 2);
begin
  select coalesce(sum(
    case payment.direction when 'payment' then payment.amount else -payment.amount end
  ), 0)
  into ledger_paid
  from public.payroll_payments payment
  where payment.organization_id = new.organization_id
    and payment.payroll_entry_id = new.payroll_entry_id;

  select entry.net_amount + coalesce(sum(adjustment.amount) filter (
    where adjustment.included_in_net = false
  ), 0)
  into adjusted_payable
  from public.payroll_entries entry
  left join public.payroll_adjustments adjustment
    on adjustment.organization_id = entry.organization_id
   and adjustment.payroll_entry_id = entry.id
  where entry.organization_id = new.organization_id
    and entry.id = new.payroll_entry_id
  group by entry.id;

  update public.payroll_entries entry
  set
    paid_amount = ledger_paid,
    payment_status = case
      when ledger_paid = adjusted_payable and adjusted_payable > 0 then 'paid'
      when ledger_paid > 0 then 'partially_paid'
      else 'pending'
    end,
    updated_at = now()
  where entry.organization_id = new.organization_id
    and entry.id = new.payroll_entry_id;

  return new;
end;
$$;

create or replace function public.post_payroll_cash_movement_from_payment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  employee_label text;
begin
  if new.payment_method <> 'cash' or new.legacy_source_id is not null then
    return new;
  end if;

  select coalesce(profile.full_name, profile.email, new.payroll_entry_id::text)
  into employee_label
  from public.payroll_entries entry
  left join public.profiles profile on profile.id = entry.employee_id
  where entry.organization_id = new.organization_id
    and entry.id = new.payroll_entry_id;

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
    payroll_payment_id
  ) values (
    new.cash_session_id,
    case when new.direction = 'payment' then 'cash_out' else 'cash_in' end,
    new.amount,
    left(
      case when new.direction = 'payment'
        then 'Pago de nomina: '
        else 'Compensacion de pago de nomina: '
      end || employee_label,
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

create or replace function public.protect_payroll_cash_movement()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.payroll_payment_id is not null
     or (tg_op = 'UPDATE' and new.payroll_payment_id is not null) then
    raise exception 'PAYROLL_CASH_MOVEMENT_IS_IMMUTABLE';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.validate_payroll_cash_movement_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.payroll_payment_id is null then
    return new;
  end if;

  if new.finance_payment_id is not null or not exists (
    select 1
    from public.payroll_payments payment
    where payment.organization_id = new.organization_id
      and payment.branch_id = new.branch_id
      and payment.id = new.payroll_payment_id
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
    raise exception 'PAYROLL_CASH_MOVEMENT_DOES_NOT_MATCH_PAYMENT';
  end if;

  return new;
end;
$$;

create or replace function public.pay_payroll_entry_atomic(
  p_organization_id uuid,
  p_branch_id uuid,
  p_payroll_entry_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_idempotency_key text,
  p_cash_session_id uuid default null,
  p_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  actor_id uuid := auth.uid();
  target_run_id uuid;
  target_entry public.payroll_entries%rowtype;
  target_run public.payroll_runs%rowtype;
  created_payment public.payroll_payments%rowtype;
  adjusted_payable numeric(14, 2);
begin
  if actor_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not (
    public.has_org_permission(p_organization_id, 'finances.pay')
    or public.get_user_role(actor_id) = 'super_admin'
  ) then
    raise exception 'PAYROLL_PAYMENT_PERMISSION_DENIED';
  end if;
  if not public.user_has_branch_access(p_branch_id, actor_id) then
    raise exception 'PAYROLL_BRANCH_PERMISSION_DENIED';
  end if;
  if not exists (
    select 1
    from public.branches branch
    where branch.organization_id = p_organization_id
      and branch.id = p_branch_id
      and branch.is_active = true
  ) then
    raise exception 'PAYROLL_BRANCH_NOT_IN_ORGANIZATION';
  end if;
  if p_amount is null
     or p_amount <= 0
     or p_amount > 999999999999.99
     or p_amount <> trunc(p_amount, 2) then
    raise exception 'PAYROLL_INVALID_PAYMENT_AMOUNT';
  end if;
  if p_payment_method not in ('cash', 'bank_transfer', 'other') then
    raise exception 'PAYROLL_INVALID_PAYMENT_METHOD';
  end if;
  if p_payment_date is null then
    raise exception 'PAYROLL_PAYMENT_DATE_REQUIRED';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
     or char_length(trim(p_idempotency_key)) > 128
     or lower(trim(p_idempotency_key)) like 'payroll-system:%'
     or lower(trim(p_idempotency_key)) like 'legacy-technician:%' then
    raise exception 'PAYROLL_INVALID_IDEMPOTENCY_KEY';
  end if;

  select entry.payroll_run_id
  into target_run_id
  from public.payroll_entries entry
  where entry.organization_id = p_organization_id
    and entry.id = p_payroll_entry_id;

  if not found then
    raise exception 'PAYROLL_ENTRY_NOT_FOUND';
  end if;

  select run.*
  into target_run
  from public.payroll_runs run
  where run.organization_id = p_organization_id
    and run.id = target_run_id
  for update;

  select entry.*
  into target_entry
  from public.payroll_entries entry
  where entry.organization_id = p_organization_id
    and entry.id = p_payroll_entry_id
    and entry.payroll_run_id = target_run.id
  for update;

  if not found then
    raise exception 'PAYROLL_ENTRY_NOT_FOUND';
  end if;

  if target_run.status <> 'approved' then
    raise exception 'PAYROLL_ENTRY_NOT_PAYABLE';
  end if;
  if target_entry.branch_id is not null and target_entry.branch_id <> p_branch_id then
    raise exception 'PAYROLL_PAYMENT_BRANCH_MISMATCH';
  end if;

  select payment.*
  into created_payment
  from public.payroll_payments payment
  where payment.organization_id = p_organization_id
    and payment.payroll_entry_id = p_payroll_entry_id
    and payment.idempotency_key = trim(p_idempotency_key)
    and payment.direction = 'payment'
    and payment.branch_id = p_branch_id
    and payment.amount = p_amount
    and payment.payment_method = p_payment_method
    and payment.payment_date = p_payment_date
    and payment.cash_session_id is not distinct from p_cash_session_id
    and payment.reference is not distinct from nullif(left(trim(p_reference), 200), '')
    and payment.notes is not distinct from nullif(left(trim(p_notes), 2000), '');

  if found then
    return jsonb_build_object(
      'payment', to_jsonb(created_payment),
      'entry', to_jsonb(target_entry)
    );
  end if;

  if exists (
    select 1
    from public.payroll_payments payment
    where payment.organization_id = p_organization_id
      and payment.payroll_entry_id = p_payroll_entry_id
      and payment.idempotency_key = trim(p_idempotency_key)
  ) then
    raise exception 'PAYROLL_PAYMENT_IDEMPOTENCY_KEY_REUSED';
  end if;

  select target_entry.net_amount + coalesce(sum(adjustment.amount) filter (
    where adjustment.included_in_net = false
  ), 0)
  into adjusted_payable
  from public.payroll_adjustments adjustment
  where adjustment.organization_id = p_organization_id
    and adjustment.payroll_entry_id = p_payroll_entry_id;

  if adjusted_payable <= 0 then
    raise exception 'PAYROLL_ENTRY_NOT_PAYABLE';
  end if;
  if p_amount > adjusted_payable - target_entry.paid_amount then
    raise exception 'PAYROLL_OVERPAYMENT';
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

  insert into public.payroll_payments (
    organization_id,
    branch_id,
    allocation_scope,
    payroll_entry_id,
    idempotency_key,
    direction,
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
    'branch',
    p_payroll_entry_id,
    trim(p_idempotency_key),
    'payment',
    p_amount,
    p_payment_method,
    p_payment_date,
    p_cash_session_id,
    nullif(left(trim(p_reference), 200), ''),
    nullif(left(trim(p_notes), 2000), ''),
    actor_id
  )
  returning * into created_payment;

  return jsonb_build_object(
    'payment', to_jsonb(created_payment),
    'entry', (
      select to_jsonb(updated_entry)
      from public.payroll_entries updated_entry
      where updated_entry.organization_id = p_organization_id
        and updated_entry.id = p_payroll_entry_id
    )
  );
end;
$$;

-- Legacy bridge. Each source row is mapped with a unique legacy_source_id.
-- Imported commission rules retain their historical effective date but use a
-- cutover date so this ledger never rematerializes commissions already handled
-- by the technician module before this migration.
insert into public.employee_compensation (
  organization_id,
  employee_id,
  base_salary,
  pay_frequency,
  effective_from,
  effective_to,
  legacy_source_id,
  legacy_cutover_on,
  created_at,
  updated_at
)
select
  legacy.organization_id,
  legacy.technician_id,
  legacy.base_salary,
  'monthly',
  coalesce(legacy.salary_effective_from, date '1900-01-01'),
  case
    when legacy.is_active then null
    else greatest(
      coalesce(legacy.salary_effective_from, date '1900-01-01'),
      public.payroll_organization_date(legacy.organization_id, now()) - 1
    )
  end,
  legacy.id,
  public.payroll_organization_date(legacy.organization_id, now()),
  coalesce(legacy.created_at, now()),
  coalesce(legacy.updated_at, now())
from public.technician_compensation legacy
join public.organization_members membership
  on membership.organization_id = legacy.organization_id
 and membership.user_id = legacy.technician_id
on conflict do nothing;

insert into public.commission_rules (
  organization_id,
  scope_type,
  employee_id,
  source_type,
  accrual_status,
  calculation_type,
  value,
  status,
  effective_from,
  effective_to,
  legacy_source_id,
  legacy_component,
  legacy_cutover_on,
  approved_at,
  created_at,
  updated_at
)
select
  legacy_rule.organization_id,
  'employee',
  legacy_rule.technician_id,
  legacy_rule.source_type,
  legacy_rule.accrual_status,
  legacy_rule.calculation_type,
  legacy_rule.rule_value,
  case when legacy_rule.is_active then 'approved' else 'retired' end,
  legacy_rule.effective_from,
  legacy_rule.effective_to,
  legacy_rule.legacy_source_id,
  legacy_rule.legacy_component,
  public.payroll_organization_date(legacy_rule.organization_id, now()),
  case when legacy_rule.is_active then legacy_rule.approved_at else null end,
  legacy_rule.created_at,
  legacy_rule.updated_at
from (
  select
    legacy.organization_id,
    legacy.technician_id,
    case legacy.commission_base
      when 'labor' then 'repair_labor'
      else 'repair'
    end as source_type,
    legacy.accrual_status,
    'percentage'::text as calculation_type,
    legacy.commission_rate::numeric(14, 2) as rule_value,
    legacy.is_active,
    coalesce(legacy.salary_effective_from, date '1900-01-01') as effective_from,
    case
      when legacy.is_active then null
      else greatest(
        coalesce(legacy.salary_effective_from, date '1900-01-01'),
        public.payroll_organization_date(legacy.organization_id, now()) - 1
      )
    end as effective_to,
    legacy.id as legacy_source_id,
    'percentage'::text as legacy_component,
    coalesce(legacy.updated_at, legacy.created_at, now()) as approved_at,
    coalesce(legacy.created_at, now()) as created_at,
    coalesce(legacy.updated_at, now()) as updated_at
  from public.technician_compensation legacy
  join public.organization_members membership
    on membership.organization_id = legacy.organization_id
   and membership.user_id = legacy.technician_id
  where legacy.commission_rate > 0

  union all

  select
    legacy.organization_id,
    legacy.technician_id,
    'repair'::text,
    legacy.accrual_status,
    'fixed'::text,
    legacy.fixed_per_repair::numeric(14, 2),
    legacy.is_active,
    coalesce(legacy.salary_effective_from, date '1900-01-01'),
    case
      when legacy.is_active then null
      else greatest(
        coalesce(legacy.salary_effective_from, date '1900-01-01'),
        public.payroll_organization_date(legacy.organization_id, now()) - 1
      )
    end,
    legacy.id,
    'fixed'::text,
    coalesce(legacy.updated_at, legacy.created_at, now()),
    coalesce(legacy.created_at, now()),
    coalesce(legacy.updated_at, now())
  from public.technician_compensation legacy
  join public.organization_members membership
    on membership.organization_id = legacy.organization_id
   and membership.user_id = legacy.technician_id
  where legacy.fixed_per_repair > 0
) legacy_rule
on conflict do nothing;

insert into public.payroll_runs (
  organization_id,
  branch_id,
  allocation_scope,
  period_from,
  period_to,
  idempotency_key,
  status,
  run_type,
  currency,
  base_amount,
  commission_amount,
  gross_amount,
  net_amount,
  legacy_source_id,
  generated_by,
  generated_at,
  approved_by,
  approved_at,
  created_at,
  updated_at
)
select
  legacy.organization_id,
  null,
  'organization',
  legacy.period_from,
  legacy.period_to,
  'legacy-technician:' || legacy.id::text,
  'approved',
  'legacy',
  coalesce(settings.currency, 'PYG'),
  legacy.base_amount,
  legacy.commission_amount + legacy.fixed_amount,
  legacy.base_amount + legacy.commission_amount + legacy.fixed_amount,
  legacy.base_amount + legacy.commission_amount + legacy.fixed_amount,
  legacy.id,
  legacy.paid_by,
  coalesce(legacy.created_at, legacy.paid_at, now()),
  legacy.paid_by,
  coalesce(legacy.approved_at, legacy.paid_at, legacy.created_at, now()),
  coalesce(legacy.created_at, now()),
  coalesce(legacy.updated_at, now())
from public.technician_payments legacy
join public.organization_members membership
  on membership.organization_id = legacy.organization_id
 and membership.user_id = legacy.technician_id
left join public.organization_settings settings
  on settings.organization_id = legacy.organization_id
on conflict do nothing;

insert into public.payroll_entries (
  organization_id,
  branch_id,
  allocation_scope,
  payroll_run_id,
  employee_id,
  employee_role,
  base_amount,
  commission_amount,
  gross_amount,
  net_amount,
  paid_amount,
  payment_status,
  legacy_source_id,
  created_at,
  updated_at
)
select
  legacy.organization_id,
  null,
  'organization',
  run.id,
  legacy.technician_id,
  membership.role,
  legacy.base_amount,
  legacy.commission_amount + legacy.fixed_amount,
  legacy.base_amount + legacy.commission_amount + legacy.fixed_amount,
  legacy.base_amount + legacy.commission_amount + legacy.fixed_amount,
  0,
  'pending',
  legacy.id,
  coalesce(legacy.created_at, now()),
  coalesce(legacy.updated_at, now())
from public.technician_payments legacy
join public.payroll_runs run
  on run.organization_id = legacy.organization_id
 and run.legacy_source_id = legacy.id
join public.organization_members membership
  on membership.organization_id = legacy.organization_id
 and membership.user_id = legacy.technician_id
on conflict do nothing;

insert into public.payroll_adjustments (
  organization_id,
  payroll_entry_id,
  adjustment_type,
  amount,
  reason,
  idempotency_key,
  legacy_source_id,
  legacy_component,
  created_by,
  created_at
)
select
  legacy.organization_id,
  entry.id,
  'correction',
  case
    when legacy.status = 'anulado' then -entry.net_amount
    else legacy.amount - entry.net_amount
  end,
  case
    when legacy.status = 'anulado'
      then 'Compensacion de registro tecnico anulado'
    else 'Diferencia adaptada del pago tecnico legado'
  end,
  'legacy-technician:' || legacy.id::text || ':payable-delta',
  legacy.id,
  'payable-delta',
  legacy.paid_by,
  coalesce(legacy.updated_at, legacy.created_at, now())
from public.technician_payments legacy
join public.payroll_entries entry
  on entry.organization_id = legacy.organization_id
 and entry.legacy_source_id = legacy.id
where case
  when legacy.status = 'anulado' then -entry.net_amount
  else legacy.amount - entry.net_amount
end <> 0
on conflict do nothing;

with resolved_legacy_payment as (
  select
    legacy.*,
    entry.id as payroll_entry_id,
    coalesce(
      cash_movement.branch_id,
      legacy_session.branch_id,
      primary_branch.branch_id
    ) as resolved_branch_id,
    cash_movement.session_id as resolved_cash_session_id
  from public.technician_payments legacy
  join public.payroll_entries entry
    on entry.organization_id = legacy.organization_id
   and entry.legacy_source_id = legacy.id
  left join public.cash_movements cash_movement
    on cash_movement.id = legacy.cash_movement_id
   and cash_movement.organization_id = legacy.organization_id
  left join public.cash_closures legacy_session
    on legacy_session.id = cash_movement.session_id
   and legacy_session.organization_id = legacy.organization_id
  left join lateral (
    select branch.id as branch_id
    from public.branches branch
    left join public.user_branch_assignments assignment
      on assignment.organization_id = branch.organization_id
     and assignment.branch_id = branch.id
     and assignment.user_id = legacy.technician_id
     and assignment.is_active = true
     and assignment.is_primary = true
    where branch.organization_id = legacy.organization_id
      and branch.is_active = true
    order by
      case when assignment.id is not null then 0 else 1 end,
      case when branch.is_default then 0 else 1 end,
      branch.created_at,
      branch.id
    limit 1
  ) primary_branch on true
  where legacy.status in ('pagado', 'confirmado', 'anulado')
    and legacy.amount > 0
)
insert into public.payroll_payments (
  organization_id,
  branch_id,
  allocation_scope,
  payroll_entry_id,
  idempotency_key,
  direction,
  amount,
  payment_method,
  payment_date,
  cash_session_id,
  reference,
  notes,
  legacy_source_id,
  legacy_component,
  created_by,
  created_at
)
select
  legacy.organization_id,
  legacy.resolved_branch_id,
  case when legacy.resolved_branch_id is null then 'organization' else 'branch' end,
  legacy.payroll_entry_id,
  'legacy-technician:' || legacy.id::text || ':payment',
  'payment',
  legacy.amount,
  case legacy.method
    when 'efectivo' then 'cash'
    when 'transferencia' then 'bank_transfer'
    else 'other'
  end,
  public.payroll_organization_date(
    legacy.organization_id,
    coalesce(legacy.paid_at, legacy.created_at, now())
  ),
  case when legacy.method = 'efectivo' then legacy.resolved_cash_session_id else null end,
  left('Pago tecnico legado ' || legacy.id::text, 200),
  nullif(left(legacy.notes, 2000), ''),
  legacy.id,
  'payment',
  legacy.paid_by,
  coalesce(legacy.paid_at, legacy.created_at, now())
from resolved_legacy_payment legacy
on conflict do nothing;

insert into public.payroll_payments (
  organization_id,
  branch_id,
  allocation_scope,
  payroll_entry_id,
  idempotency_key,
  direction,
  reverses_payment_id,
  amount,
  payment_method,
  payment_date,
  cash_session_id,
  reference,
  notes,
  legacy_source_id,
  legacy_component,
  created_by,
  created_at
)
select
  legacy.organization_id,
  original.branch_id,
  original.allocation_scope,
  original.payroll_entry_id,
  'legacy-technician:' || legacy.id::text || ':reversal',
  'reversal',
  original.id,
  original.amount,
  original.payment_method,
  public.payroll_organization_date(
    legacy.organization_id,
    coalesce(legacy.updated_at, legacy.paid_at, legacy.created_at, now())
  ),
  null,
  left('Compensacion de pago tecnico anulado ' || legacy.id::text, 200),
  nullif(left(legacy.notes, 2000), ''),
  legacy.id,
  'reversal',
  legacy.paid_by,
  coalesce(legacy.updated_at, legacy.paid_at, legacy.created_at, now())
from public.technician_payments legacy
join public.payroll_payments original
  on original.organization_id = legacy.organization_id
 and original.legacy_source_id = legacy.id
 and original.legacy_component = 'payment'
where legacy.status = 'anulado'
on conflict do nothing;

update public.payroll_entries entry
set
  paid_amount = ledger.paid_amount,
  payment_status = case
    when ledger.paid_amount = ledger.adjusted_payable and ledger.adjusted_payable > 0
      then 'paid'
    when ledger.paid_amount > 0 then 'partially_paid'
    else 'pending'
  end,
  updated_at = now()
from (
  select
    target.id,
    coalesce(sum(
      case payment.direction when 'payment' then payment.amount else -payment.amount end
    ), 0)::numeric(14, 2) as paid_amount,
     target.net_amount + coalesce((
      select sum(adjustment.amount)
      from public.payroll_adjustments adjustment
      where adjustment.organization_id = target.organization_id
        and adjustment.payroll_entry_id = target.id
        and adjustment.included_in_net = false
    ), 0) as adjusted_payable
  from public.payroll_entries target
  left join public.payroll_payments payment
    on payment.organization_id = target.organization_id
   and payment.payroll_entry_id = target.id
  where target.legacy_source_id is not null
  group by target.id
) ledger
where entry.id = ledger.id;

update public.cash_movements cash_movement
set
  payroll_payment_id = imported_payment.id,
  branch_id = coalesce(cash_movement.branch_id, imported_payment.branch_id)
from public.technician_payments legacy
join public.payroll_payments imported_payment
  on imported_payment.organization_id = legacy.organization_id
 and imported_payment.legacy_source_id = legacy.id
 and imported_payment.legacy_component = 'payment'
where legacy.cash_movement_id = cash_movement.id
  and cash_movement.organization_id = imported_payment.organization_id
  and (
    cash_movement.branch_id is null
    or cash_movement.branch_id = imported_payment.branch_id
  )
  and cash_movement.payroll_payment_id is null;

create or replace function public.protect_used_employee_compensation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  safe_effective_close boolean := false;
  organization_today date;
begin
  if tg_op = 'UPDATE'
     and old.created_by is not null
     and new.created_by is null
     and to_jsonb(new) - 'created_by' - 'updated_at'
       = to_jsonb(old) - 'created_by' - 'updated_at'
     and not exists (
       select 1 from auth.users actor where actor.id = old.created_by
     ) then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    organization_today := public.payroll_organization_date(old.organization_id, now());
    safe_effective_close :=
      to_jsonb(new) - 'effective_to' - 'updated_at'
        = to_jsonb(old) - 'effective_to' - 'updated_at'
      and new.effective_to is not null
      and new.effective_to >= old.effective_from
      and new.effective_to >= organization_today
      and (old.effective_to is null or new.effective_to <= old.effective_to)
      and not exists (
        select 1
        from public.payroll_entries entry
        join public.payroll_runs run
          on run.organization_id = entry.organization_id
         and run.id = entry.payroll_run_id
        where entry.organization_id = old.organization_id
          and entry.employee_id = old.employee_id
          and run.status = 'approved'
          and run.run_type = 'standard'
          and run.period_to > new.effective_to
          and daterange(run.period_from, run.period_to + 1, '[)')
            && daterange(
              old.effective_from,
              coalesce(old.effective_to + 1, 'infinity'::date),
              '[)'
            )
      );

    if safe_effective_close then
      return new;
    end if;
  end if;

  if exists (
    select 1
    from public.payroll_entries entry
    join public.payroll_runs run
      on run.organization_id = entry.organization_id
     and run.id = entry.payroll_run_id
    where entry.organization_id = old.organization_id
      and entry.employee_id = old.employee_id
      and run.status = 'approved'
      and run.run_type = 'standard'
      and daterange(run.period_from, run.period_to + 1, '[)')
        && daterange(
          old.effective_from,
          coalesce(old.effective_to + 1, 'infinity'::date),
          '[)'
        )
  ) then
    raise exception 'PAYROLL_USED_COMPENSATION_IS_IMMUTABLE';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.sync_payroll_entry_from_adjustment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_entry public.payroll_entries%rowtype;
  target_run public.payroll_runs%rowtype;
  draft_adjustment_amount numeric(14, 2);
  ledger_paid numeric(14, 2);
  adjusted_payable numeric(14, 2);
begin
  select entry.*
  into target_entry
  from public.payroll_entries entry
  where entry.organization_id = new.organization_id
    and entry.id = new.payroll_entry_id;

  select run.*
  into target_run
  from public.payroll_runs run
  where run.organization_id = target_entry.organization_id
    and run.id = target_entry.payroll_run_id;

  if target_run.status = 'draft' then
    select coalesce(sum(adjustment.amount), 0)::numeric(14, 2)
    into draft_adjustment_amount
    from public.payroll_adjustments adjustment
    where adjustment.organization_id = new.organization_id
      and adjustment.payroll_entry_id = new.payroll_entry_id;

    update public.payroll_entries entry
    set
      adjustment_amount = draft_adjustment_amount,
      net_amount = entry.gross_amount + draft_adjustment_amount,
      paid_amount = 0,
      payment_status = 'pending',
      updated_at = now()
    where entry.organization_id = new.organization_id
      and entry.id = new.payroll_entry_id;

    update public.payroll_runs run
    set
      adjustment_amount = totals.adjustment_amount,
      net_amount = totals.net_amount,
      updated_at = now()
    from (
      select
        coalesce(sum(entry.adjustment_amount), 0)::numeric(14, 2)
          as adjustment_amount,
        coalesce(sum(entry.net_amount), 0)::numeric(14, 2) as net_amount
      from public.payroll_entries entry
      where entry.organization_id = new.organization_id
        and entry.payroll_run_id = target_run.id
    ) totals
    where run.organization_id = new.organization_id
      and run.id = target_run.id;

    return new;
  end if;

  select coalesce(sum(
    case payment.direction when 'payment' then payment.amount else -payment.amount end
  ), 0)
  into ledger_paid
  from public.payroll_payments payment
  where payment.organization_id = new.organization_id
    and payment.payroll_entry_id = new.payroll_entry_id;

  select entry.net_amount + coalesce(sum(adjustment.amount) filter (
    where adjustment.included_in_net = false
  ), 0)
  into adjusted_payable
  from public.payroll_entries entry
  left join public.payroll_adjustments adjustment
    on adjustment.organization_id = entry.organization_id
   and adjustment.payroll_entry_id = entry.id
  where entry.organization_id = new.organization_id
    and entry.id = new.payroll_entry_id
  group by entry.id;

  update public.payroll_entries entry
  set
    paid_amount = ledger_paid,
    payment_status = case
      when ledger_paid = adjusted_payable and adjusted_payable > 0 then 'paid'
      when ledger_paid > 0 then 'partially_paid'
      else 'pending'
    end,
    updated_at = now()
  where entry.organization_id = new.organization_id
    and entry.id = new.payroll_entry_id;

  return new;
end;
$$;

drop trigger if exists employee_compensation_10_updated_at
  on public.employee_compensation;
create trigger employee_compensation_10_updated_at
before update on public.employee_compensation
for each row execute function public.set_payroll_updated_at();

drop trigger if exists employee_compensation_20_protect_used
  on public.employee_compensation;
create trigger employee_compensation_20_protect_used
before update or delete on public.employee_compensation
for each row execute function public.protect_used_employee_compensation();

drop trigger if exists employee_compensation_30_validate_period
  on public.employee_compensation;
create trigger employee_compensation_30_validate_period
before insert or update on public.employee_compensation
for each row execute function public.validate_employee_compensation_period();

drop trigger if exists commission_rules_10_updated_at on public.commission_rules;
create trigger commission_rules_10_updated_at
before update on public.commission_rules
for each row execute function public.set_payroll_updated_at();

drop trigger if exists commission_rules_20_protect_approved on public.commission_rules;
create trigger commission_rules_20_protect_approved
before update or delete on public.commission_rules
for each row execute function public.protect_approved_commission_rule();

drop trigger if exists commission_rules_30_validate_period on public.commission_rules;
create trigger commission_rules_30_validate_period
before insert or update on public.commission_rules
for each row execute function public.validate_commission_rule_period();

drop trigger if exists commission_terminal_events_append_only
  on public.commission_terminal_events;
create trigger commission_terminal_events_append_only
before update or delete on public.commission_terminal_events
for each row execute function public.prevent_payroll_append_only_mutation();

drop trigger if exists commission_refund_events_append_only
  on public.commission_refund_events;
create trigger commission_refund_events_append_only
before update or delete on public.commission_refund_events
for each row execute function public.prevent_payroll_append_only_mutation();

drop trigger if exists commission_operation_attributions_append_only
  on public.commission_operation_attributions;
create trigger commission_operation_attributions_append_only
before update or delete on public.commission_operation_attributions
for each row execute function public.prevent_payroll_append_only_mutation();

drop trigger if exists commission_sale_item_attributions_append_only
  on public.commission_sale_item_attributions;
create trigger commission_sale_item_attributions_append_only
before update or delete on public.commission_sale_item_attributions
for each row execute function public.prevent_payroll_append_only_mutation();

drop trigger if exists employee_employment_events_append_only
  on public.employee_employment_events;
create trigger employee_employment_events_append_only
before update or delete on public.employee_employment_events
for each row execute function public.prevent_payroll_append_only_mutation();

drop trigger if exists earned_commissions_10_validate on public.earned_commissions;
create trigger earned_commissions_10_validate
before insert on public.earned_commissions
for each row execute function public.validate_earned_commission_insert();

drop trigger if exists earned_commissions_append_only on public.earned_commissions;
create trigger earned_commissions_append_only
before update or delete on public.earned_commissions
for each row execute function public.prevent_payroll_append_only_mutation();

drop trigger if exists payroll_runs_10_updated_at on public.payroll_runs;
create trigger payroll_runs_10_updated_at
before update on public.payroll_runs
for each row execute function public.set_payroll_updated_at();

drop trigger if exists payroll_runs_20_protect_approved on public.payroll_runs;
create trigger payroll_runs_20_protect_approved
before update or delete on public.payroll_runs
for each row execute function public.protect_approved_payroll_run();

drop trigger if exists payroll_entries_10_updated_at on public.payroll_entries;
create trigger payroll_entries_10_updated_at
before update on public.payroll_entries
for each row execute function public.set_payroll_updated_at();

drop trigger if exists payroll_entries_15_validate_scope on public.payroll_entries;
create trigger payroll_entries_15_validate_scope
before insert or update on public.payroll_entries
for each row execute function public.validate_payroll_entry_scope();

drop trigger if exists payroll_entries_20_protect_approved on public.payroll_entries;
create trigger payroll_entries_20_protect_approved
before update or delete on public.payroll_entries
for each row execute function public.protect_approved_payroll_entry();

drop trigger if exists payroll_entry_commissions_10_validate
  on public.payroll_entry_commissions;
create trigger payroll_entry_commissions_10_validate
before insert on public.payroll_entry_commissions
for each row execute function public.validate_payroll_entry_commission_insert();

drop trigger if exists payroll_entry_commissions_append_only
  on public.payroll_entry_commissions;
create trigger payroll_entry_commissions_append_only
before update or delete on public.payroll_entry_commissions
for each row execute function public.prevent_payroll_append_only_mutation();

drop trigger if exists payroll_adjustments_10_validate
  on public.payroll_adjustments;
create trigger payroll_adjustments_10_validate
before insert on public.payroll_adjustments
for each row execute function public.validate_payroll_adjustment_insert();

drop trigger if exists payroll_adjustments_20_sync_entry
  on public.payroll_adjustments;
create trigger payroll_adjustments_20_sync_entry
after insert on public.payroll_adjustments
for each row execute function public.sync_payroll_entry_from_adjustment();

drop trigger if exists payroll_adjustments_append_only
  on public.payroll_adjustments;
create trigger payroll_adjustments_append_only
before update or delete on public.payroll_adjustments
for each row execute function public.prevent_payroll_append_only_mutation();

drop trigger if exists payroll_payments_10_validate on public.payroll_payments;
create trigger payroll_payments_10_validate
before insert on public.payroll_payments
for each row execute function public.validate_payroll_payment_insert();

drop trigger if exists payroll_payments_20_sync_entry on public.payroll_payments;
create trigger payroll_payments_20_sync_entry
after insert on public.payroll_payments
for each row execute function public.sync_payroll_entry_from_payment();

drop trigger if exists payroll_payments_30_post_cash on public.payroll_payments;
create trigger payroll_payments_30_post_cash
after insert on public.payroll_payments
for each row execute function public.post_payroll_cash_movement_from_payment();

drop trigger if exists payroll_payments_append_only on public.payroll_payments;
create trigger payroll_payments_append_only
before update or delete on public.payroll_payments
for each row execute function public.prevent_payroll_append_only_mutation();

drop trigger if exists cash_movements_protect_payroll_link on public.cash_movements;
create trigger cash_movements_protect_payroll_link
before update or delete on public.cash_movements
for each row execute function public.protect_payroll_cash_movement();

drop trigger if exists cash_movements_validate_payroll_insert on public.cash_movements;
create trigger cash_movements_validate_payroll_insert
before insert on public.cash_movements
for each row execute function public.validate_payroll_cash_movement_insert();

-- Extend the Task 2 audit allow-list without replacing its append-only ledger.
do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select distinct constraint_info.conname
    from pg_constraint constraint_info
    join pg_class relation on relation.oid = constraint_info.conrelid
    join pg_namespace namespace_info on namespace_info.oid = relation.relnamespace
    join unnest(constraint_info.conkey) as key_column(attnum) on true
    join pg_attribute attribute_info
      on attribute_info.attrelid = relation.oid
     and attribute_info.attnum = key_column.attnum
    where namespace_info.nspname = 'public'
      and relation.relname = 'finance_audit_events'
      and constraint_info.contype = 'c'
      and attribute_info.attname = 'entity_type'
  loop
    execute format(
      'alter table public.finance_audit_events drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;

  alter table public.finance_audit_events
    add constraint finance_audit_events_entity_type_check
    check (entity_type in (
      'finance_categories',
      'finance_expense_templates',
      'finance_obligations',
      'finance_payments',
      'employee_compensation',
      'employee_employment_events',
      'commission_rules',
      'commission_operation_attributions',
      'commission_sale_item_attributions',
      'commission_terminal_events',
      'commission_refund_events',
      'earned_commissions',
      'payroll_runs',
      'payroll_entries',
      'payroll_adjustments',
      'payroll_payments'
    ));
end;
$$;

drop trigger if exists employee_compensation_audit on public.employee_compensation;
create trigger employee_compensation_audit
after insert or update or delete on public.employee_compensation
for each row execute function public.record_finance_audit_event();

drop trigger if exists employee_employment_events_audit
  on public.employee_employment_events;
create trigger employee_employment_events_audit
after insert on public.employee_employment_events
for each row execute function public.record_finance_audit_event();

drop trigger if exists commission_rules_audit on public.commission_rules;
create trigger commission_rules_audit
after insert or update or delete on public.commission_rules
for each row execute function public.record_finance_audit_event();

drop trigger if exists earned_commissions_audit on public.earned_commissions;
create trigger earned_commissions_audit
after insert on public.earned_commissions
for each row execute function public.record_finance_audit_event();

drop trigger if exists commission_operation_attributions_audit
  on public.commission_operation_attributions;
create trigger commission_operation_attributions_audit
after insert on public.commission_operation_attributions
for each row execute function public.record_finance_audit_event();

drop trigger if exists commission_sale_item_attributions_audit
  on public.commission_sale_item_attributions;
create trigger commission_sale_item_attributions_audit
after insert on public.commission_sale_item_attributions
for each row execute function public.record_finance_audit_event();

drop trigger if exists commission_terminal_events_audit
  on public.commission_terminal_events;
create trigger commission_terminal_events_audit
after insert on public.commission_terminal_events
for each row execute function public.record_finance_audit_event();

drop trigger if exists commission_refund_events_audit
  on public.commission_refund_events;
create trigger commission_refund_events_audit
after insert on public.commission_refund_events
for each row execute function public.record_finance_audit_event();

drop trigger if exists payroll_runs_audit on public.payroll_runs;
create trigger payroll_runs_audit
after insert or update or delete on public.payroll_runs
for each row execute function public.record_finance_audit_event();

drop trigger if exists payroll_entries_audit on public.payroll_entries;
create trigger payroll_entries_audit
after insert or update or delete on public.payroll_entries
for each row execute function public.record_finance_audit_event();

drop trigger if exists payroll_adjustments_audit on public.payroll_adjustments;
create trigger payroll_adjustments_audit
after insert on public.payroll_adjustments
for each row execute function public.record_finance_audit_event();

drop trigger if exists payroll_payments_audit on public.payroll_payments;
create trigger payroll_payments_audit
after insert on public.payroll_payments
for each row execute function public.record_finance_audit_event();

alter table public.employee_compensation enable row level security;
alter table public.employee_employment_events enable row level security;
alter table public.commission_rules enable row level security;
alter table public.commission_operation_attributions enable row level security;
alter table public.commission_sale_item_attributions enable row level security;
alter table public.commission_terminal_events enable row level security;
alter table public.commission_refund_events enable row level security;
alter table public.earned_commissions enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_entries enable row level security;
alter table public.payroll_entry_commissions enable row level security;
alter table public.payroll_adjustments enable row level security;
alter table public.payroll_payments enable row level security;

drop policy if exists employee_compensation_read on public.employee_compensation;
create policy employee_compensation_read
on public.employee_compensation
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and organization_id = public.current_organization_id()
);

drop policy if exists employee_employment_events_read
  on public.employee_employment_events;
create policy employee_employment_events_read
on public.employee_employment_events
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and organization_id = public.current_organization_id()
);

drop policy if exists commission_rules_read on public.commission_rules;
create policy commission_rules_read
on public.commission_rules
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and (branch_id is null or public.user_has_branch_access(branch_id))
  and organization_id = public.current_organization_id()
);

drop policy if exists earned_commissions_read on public.earned_commissions;
create policy earned_commissions_read
on public.earned_commissions
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and public.user_has_branch_access(branch_id)
  and organization_id = public.current_organization_id()
);

drop policy if exists commission_operation_attributions_read
  on public.commission_operation_attributions;
create policy commission_operation_attributions_read
on public.commission_operation_attributions
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and public.user_has_branch_access(branch_id)
  and organization_id = public.current_organization_id()
);

drop policy if exists commission_sale_item_attributions_read
  on public.commission_sale_item_attributions;
create policy commission_sale_item_attributions_read
on public.commission_sale_item_attributions
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and public.user_has_branch_access(branch_id)
  and organization_id = public.current_organization_id()
);

drop policy if exists commission_terminal_events_read
  on public.commission_terminal_events;
create policy commission_terminal_events_read
on public.commission_terminal_events
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and public.user_has_branch_access(branch_id)
  and organization_id = public.current_organization_id()
);

drop policy if exists commission_refund_events_read
  on public.commission_refund_events;
create policy commission_refund_events_read
on public.commission_refund_events
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and public.user_has_branch_access(branch_id)
  and organization_id = public.current_organization_id()
);

drop policy if exists payroll_runs_read on public.payroll_runs;
create policy payroll_runs_read
on public.payroll_runs
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and (branch_id is null or public.user_has_branch_access(branch_id))
  and organization_id = public.current_organization_id()
);

drop policy if exists payroll_entries_read on public.payroll_entries;
create policy payroll_entries_read
on public.payroll_entries
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and (branch_id is null or public.user_has_branch_access(branch_id))
  and organization_id = public.current_organization_id()
);

drop policy if exists payroll_entry_commissions_read
  on public.payroll_entry_commissions;
create policy payroll_entry_commissions_read
on public.payroll_entry_commissions
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and organization_id = public.current_organization_id()
  and exists (
    select 1
    from public.payroll_entries entry
    where entry.organization_id = payroll_entry_commissions.organization_id
      and entry.id = payroll_entry_commissions.payroll_entry_id
      and (entry.branch_id is null or public.user_has_branch_access(entry.branch_id))
  )
);

drop policy if exists payroll_adjustments_read on public.payroll_adjustments;
create policy payroll_adjustments_read
on public.payroll_adjustments
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and organization_id = public.current_organization_id()
  and exists (
    select 1
    from public.payroll_entries entry
    where entry.organization_id = payroll_adjustments.organization_id
      and entry.id = payroll_adjustments.payroll_entry_id
      and (entry.branch_id is null or public.user_has_branch_access(entry.branch_id))
  )
);

drop policy if exists payroll_payments_read on public.payroll_payments;
create policy payroll_payments_read
on public.payroll_payments
for select
to authenticated
using (
  public.has_org_permission(organization_id, 'finances.read')
  and (branch_id is null or public.user_has_branch_access(branch_id))
  and organization_id = public.current_organization_id()
);

drop policy if exists cash_movements_authenticated_source_guard
  on public.cash_movements;
create policy cash_movements_authenticated_source_guard
on public.cash_movements
as restrictive
for insert
to authenticated
with check (
  finance_payment_id is null
  and payroll_payment_id is null
);

drop policy if exists cash_movements_finance_aware_read on public.cash_movements;
create policy cash_movements_finance_aware_read
on public.cash_movements
for select
to authenticated
using (
  public.user_has_branch_access(branch_id)
  and (
    (
      finance_payment_id is null
      and payroll_payment_id is null
      and (
        public.has_org_permission(organization_id, 'pos.cash.manage')
        or public.has_org_permission(organization_id, 'pos.sales.read')
        or public.has_org_permission(organization_id, 'pos.sales.create')
      )
    )
    or (
      (finance_payment_id is not null or payroll_payment_id is not null)
      and public.has_org_permission(organization_id, 'finances.read')
    )
  )
);

drop policy if exists cash_movements_legacy_update on public.cash_movements;
create policy cash_movements_legacy_update
on public.cash_movements
for update
to authenticated
using (
  finance_payment_id is null
  and payroll_payment_id is null
  and public.user_has_branch_access(branch_id)
  and public.has_org_permission(organization_id, 'pos.cash.manage')
)
with check (
  finance_payment_id is null
  and payroll_payment_id is null
  and public.user_has_branch_access(branch_id)
  and public.has_org_permission(organization_id, 'pos.cash.manage')
);

drop policy if exists cash_movements_legacy_delete on public.cash_movements;
create policy cash_movements_legacy_delete
on public.cash_movements
for delete
to authenticated
using (
  finance_payment_id is null
  and payroll_payment_id is null
  and public.user_has_branch_access(branch_id)
  and public.has_org_permission(organization_id, 'pos.cash.manage')
);

revoke all on table public.employee_compensation from public, anon, authenticated;
revoke all on table public.employee_employment_events from public, anon, authenticated;
revoke all on table public.commission_rules from public, anon, authenticated;
revoke all on table public.commission_operation_attributions from public, anon, authenticated;
revoke all on table public.commission_sale_item_attributions from public, anon, authenticated;
revoke all on table public.commission_terminal_events from public, anon, authenticated;
revoke all on table public.commission_refund_events from public, anon, authenticated;
revoke all on table public.earned_commissions from public, anon, authenticated;
revoke all on table public.payroll_runs from public, anon, authenticated;
revoke all on table public.payroll_entries from public, anon, authenticated;
revoke all on table public.payroll_entry_commissions from public, anon, authenticated;
revoke all on table public.payroll_adjustments from public, anon, authenticated;
revoke all on table public.payroll_payments from public, anon, authenticated;

grant select on table public.employee_compensation to authenticated;
grant select on table public.employee_employment_events to authenticated;
grant select on table public.commission_rules to authenticated;
grant select on table public.commission_operation_attributions to authenticated;
grant select on table public.commission_sale_item_attributions to authenticated;
grant select on table public.commission_terminal_events to authenticated;
grant select on table public.commission_refund_events to authenticated;
grant select on table public.earned_commissions to authenticated;
grant select on table public.payroll_runs to authenticated;
grant select on table public.payroll_entries to authenticated;
grant select on table public.payroll_entry_commissions to authenticated;
grant select on table public.payroll_adjustments to authenticated;
grant select on table public.payroll_payments to authenticated;

revoke all on table public.employee_compensation from service_role;
revoke all on table public.employee_employment_events from service_role;
revoke all on table public.commission_rules from service_role;
revoke all on table public.commission_operation_attributions from service_role;
revoke all on table public.commission_sale_item_attributions from service_role;
revoke all on table public.commission_terminal_events from service_role;
revoke all on table public.commission_refund_events from service_role;
revoke all on table public.earned_commissions from service_role;
revoke all on table public.payroll_runs from service_role;
revoke all on table public.payroll_entries from service_role;
revoke all on table public.payroll_entry_commissions from service_role;
revoke all on table public.payroll_adjustments from service_role;
revoke all on table public.payroll_payments from service_role;

grant select, insert, update, delete on table public.employee_compensation to service_role;
grant select on table public.employee_employment_events to service_role;
grant select, insert, update, delete on table public.commission_rules to service_role;
grant select on table public.commission_operation_attributions to service_role;
grant select on table public.commission_sale_item_attributions to service_role;
grant select on table public.commission_terminal_events to service_role;
grant select on table public.commission_refund_events to service_role;
grant select on table public.earned_commissions to service_role;
grant select, insert, update, delete on table public.payroll_runs to service_role;
grant select, insert, update, delete on table public.payroll_entries to service_role;
grant select, insert on table public.payroll_entry_commissions to service_role;
grant select, insert on table public.payroll_adjustments to service_role;
grant select, insert on table public.payroll_payments to service_role;

revoke all on function public.calculate_earned_commissions(uuid, date, date, uuid)
from public, anon, authenticated;
grant execute on function public.calculate_earned_commissions(uuid, date, date, uuid)
to authenticated, service_role;

revoke all on function public.generate_payroll_run_atomic(uuid, date, date, text, uuid)
from public, anon, authenticated;
grant execute on function public.generate_payroll_run_atomic(uuid, date, date, text, uuid)
to authenticated;

revoke all on function public.approve_payroll_run_atomic(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.approve_payroll_run_atomic(uuid, uuid)
to authenticated;

revoke all on function public.pay_payroll_entry_atomic(
  uuid, uuid, uuid, numeric, text, date, text, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.pay_payroll_entry_atomic(
  uuid, uuid, uuid, numeric, text, date, text, uuid, text, text
) to authenticated;

revoke all on function public.set_payroll_updated_at()
from public, anon, authenticated;
revoke all on function public.validate_employee_compensation_period()
from public, anon, authenticated;
revoke all on function public.validate_commission_rule_period()
from public, anon, authenticated;
revoke all on function public.capture_employee_employment_event()
from public, anon, authenticated;
revoke all on function public.capture_commission_operation_attribution()
from public, anon, authenticated;
revoke all on function public.capture_commission_sale_item_attribution()
from public, anon, authenticated;
revoke all on function public.capture_commission_terminal_event()
from public, anon, authenticated;
revoke all on function public.capture_commission_refund_event()
from public, anon, authenticated;
revoke all on function public.payroll_organization_date(uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.protect_approved_commission_rule()
from public, anon, authenticated;
revoke all on function public.prevent_payroll_append_only_mutation()
from public, anon, authenticated;
revoke all on function public.protect_approved_payroll_run()
from public, anon, authenticated;
revoke all on function public.protect_approved_payroll_entry()
from public, anon, authenticated;
revoke all on function public.validate_payroll_adjustment_insert()
from public, anon, authenticated;
revoke all on function public.validate_earned_commission_insert()
from public, anon, authenticated;
revoke all on function public.validate_payroll_entry_scope()
from public, anon, authenticated;
revoke all on function public.validate_payroll_entry_commission_insert()
from public, anon, authenticated;
revoke all on function public.validate_payroll_payment_insert()
from public, anon, authenticated;
revoke all on function public.sync_payroll_entry_from_payment()
from public, anon, authenticated;
revoke all on function public.post_payroll_cash_movement_from_payment()
from public, anon, authenticated;
revoke all on function public.protect_payroll_cash_movement()
from public, anon, authenticated;
revoke all on function public.validate_payroll_cash_movement_insert()
from public, anon, authenticated;
revoke all on function public.protect_used_employee_compensation()
from public, anon, authenticated;
revoke all on function public.sync_payroll_entry_from_adjustment()
from public, anon, authenticated;

commit;
