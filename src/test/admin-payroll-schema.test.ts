import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const migrationPath = resolve(
  workspace,
  'supabase/migrations/20260811193000_create_payroll_commissions.sql',
)
const sql = readFileSync(migrationPath, 'utf8').toLowerCase()

function tableDefinition(tableName: string): string {
  const definition = sql.match(
    new RegExp(
      `create table if not exists public\\.${tableName} \\([\\s\\S]*?\\n\\);`,
    ),
  )

  if (!definition) {
    throw new Error(`Missing table definition for ${tableName}`)
  }

  return definition[0]
}

function functionDefinition(functionName: string): string {
  const definition = sql.match(
    new RegExp(
      `create or replace function public\\.${functionName}[\\s\\S]*?\\n\\$\\$;`,
    ),
  )

  if (!definition) {
    throw new Error(`Missing function definition for ${functionName}`)
  }

  return definition[0]
}

describe('organization payroll and commission database', () => {
  it('creates the organization-wide payroll ledger for every active staff role', () => {
    expect(sql).toContain('create table if not exists public.employee_compensation')
    expect(sql).toContain('create table if not exists public.commission_rules')
    expect(sql).toContain('create table if not exists public.earned_commissions')
    expect(sql).toContain('create table if not exists public.payroll_runs')
    expect(sql).toContain('create table if not exists public.payroll_entries')
    expect(sql).toContain('create table if not exists public.payroll_adjustments')
    expect(sql).toContain('create table if not exists public.payroll_payments')
    expect(sql).toContain('from public.organization_members membership')
    expect(sql).toContain("employment.employment_status = 'active'")
    expect(sql).toContain("membership.role <> 'customer'")
  })

  it('keeps salary and approved commission rules effective dated and deterministic', () => {
    expect(tableDefinition('employee_compensation')).toContain('effective_from date not null')
    expect(tableDefinition('employee_compensation')).toContain('effective_to date')
    expect(tableDefinition('commission_rules')).toContain(
      "scope_type in ('role', 'employee')",
    )
    expect(tableDefinition('commission_rules')).toContain('effective_from date not null')
    expect(tableDefinition('commission_rules')).toContain('effective_to date')
    expect(sql).toContain('validate_employee_compensation_period')
    expect(sql).toContain('validate_commission_rule_period')
    expect(sql).toContain("rule.status = 'approved'")
    expect(sql.match(/new\.effective_to >= organization_today/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('gives an employee exception precedence over matching role rules', () => {
    expect(sql).toContain("case when rule.scope_type = 'employee' then 1 else 0 end desc")
    expect(sql).toContain('case when rule.branch_id is not null then 1 else 0 end desc')
    expect(sql).toContain('partition by candidate.candidate_key, rule.calculation_type')
    expect(sql).toContain("rule.employee_id = candidate.employee_id")
    expect(sql).toContain('rule.role = candidate.employee_role')
  })

  it('does not advertise goal commissions without a canonical goal event source', () => {
    expect(tableDefinition('commission_rules')).not.toContain("'goal'")
    expect(tableDefinition('earned_commissions')).not.toContain("'goal'")
    expect(sql).not.toContain('commission_goal_achievements')
  })

  it('snapshots historical staff attribution and paid repair accrual events', () => {
    const captureAttribution = functionDefinition(
      'capture_commission_operation_attribution',
    )

    expect(sql).toContain(
      'create table if not exists public.commission_operation_attributions',
    )
    expect(sql).toContain(
      'create table if not exists public.employee_employment_events',
    )
    expect(sql).toContain('capture_employee_employment_event')
    expect(sql).toContain('employment_intervals as')
    expect(sql).toContain('active_employment_in_period as')
    expect(sql).toContain("employment.employment_status = 'active'")
    expect(sql).toContain('capture_commission_operation_attribution')
    expect(sql).toContain('commission_operation_attributions_append_only')
    expect(tableDefinition('commission_operation_attributions')).toContain(
      "capture_basis in ('live_event', 'cutover_current_membership')",
    )
    expect(sql).toMatch(
      /lower\(coalesce\(new\.payment_status, ''\)\)\s+not in \('pagado', 'paid'\)/,
    )
    expect(sql).toContain("'entregado'::text, repair.delivered_at")
    expect(sql).toContain("'listo'::text, repair.completed_at")
    expect(captureAttribution).not.toContain('payment_became_paid')
    expect(captureAttribution).toContain(
      'from public.employee_employment_events employment',
    )
    expect(captureAttribution).not.toContain(
      'from public.organization_members membership',
    )
    expect(captureAttribution).toContain(
      'employment.occurred_at <= attribution_occurred_at',
    )
    expect(captureAttribution).toMatch(
      /new\.completed_at is not null[\s\S]*?attribution_occurred_at := new\.completed_at[\s\S]*?employment\.occurred_at <= attribution_occurred_at/,
    )
    expect(captureAttribution).toMatch(
      /new\.delivered_at is not null[\s\S]*?attribution_occurred_at := new\.delivered_at[\s\S]*?employment\.occurred_at <= attribution_occurred_at/,
    )
    expect(sql).toContain('from public.commission_operation_attributions attribution')
    expect(sql).toContain('attribution.employee_role')
    expect(functionDefinition('calculate_earned_commissions')).not.toContain(
      'join public.organization_members membership',
    )
  })

  it('materializes one immutable origin and compensates cancellation or refund events', () => {
    const calculateCommissions = functionDefinition('calculate_earned_commissions')

    expect(tableDefinition('earned_commissions')).toContain('origin_key text not null')
    expect(tableDefinition('earned_commissions')).toContain(
      "entry_kind in ('accrual', 'reversal')",
    )
    expect(tableDefinition('earned_commissions')).toContain('reverses_commission_id uuid')
    expect(sql).toContain('earned_commissions_origin_unique')
    expect(sql).toContain('on conflict (organization_id, origin_key) do nothing')
    expect(sql).toContain("|| ':' || ranked.calculation_type")
    expect(sql).not.toContain("|| ':' || ranked.commission_rule_id::text")
    expect(sql).toContain(
      "terminal_status not in ('refunded', 'cancelled', 'canceled', 'voided')",
    )
    expect(sql).toContain(
      "terminal_status not in ('cancelado', 'cancelled', 'canceled')",
    )
    expect(sql).toContain('create table if not exists public.commission_terminal_events')
    expect(sql).toContain('create table if not exists public.commission_refund_events')
    expect(tableDefinition('commission_terminal_events')).toContain(
      "timing_basis in ('live_transition', 'cutover_best_available')",
    )
    expect(tableDefinition('commission_refund_events')).toContain(
      "timing_basis in ('live_transition', 'cutover_best_available')",
    )
    expect(sql).toContain('capture_commission_terminal_event')
    expect(sql).toContain('capture_commission_refund_event')
    expect(sql).toContain('join public.commission_terminal_events terminal_event')
    expect(calculateCommissions).toContain(
      'from public.commission_refund_events refund_event',
    )
    expect(calculateCommissions).not.toContain('from public.after_sales_cases')
    expect(sql).toContain(
      'create table if not exists public.commission_sale_item_attributions',
    )
    expect(sql).toContain('capture_commission_sale_item_attribution')
    expect(calculateCommissions).toContain(
      'join public.commission_sale_item_attributions item_attribution',
    )
    expect(calculateCommissions).not.toContain('join public.sale_items')
    expect(calculateCommissions).not.toContain('join public.products')
    expect(sql).toContain('attribution.accrual_status')
    expect(sql).toContain('attribution.occurred_at')
    expect(sql).toContain("materialized_reversal.origin_key = 'after-sales:'")
    expect(sql).toContain("|| refund_event.id::text || ':' || accrual.id::text")
    expect(sql).toContain("'reversal'")
    expect(sql).toContain('validate_earned_commission_insert')
    expect(sql).toContain('payroll_commission_reversal_exceeds_accrual')
    expect(sql).toContain('prevent_payroll_append_only_mutation')
    expect(sql).toContain('commission_refund_events_append_only')
    expect(sql).not.toContain('delete from public.earned_commissions')
    expect(calculateCommissions).not.toContain(
      "membership.status = 'active'",
    )
    expect(calculateCommissions).toMatch(
      /terminal_event\.occurred_at[\s\S]{0,100}<= p_period_to/,
    )
    expect(calculateCommissions).toMatch(
      /refund_event\.occurred_at[\s\S]{0,180}<= p_period_to/,
    )
  })

  it('generates one retry-safe run with effective salary and unclaimed commissions', () => {
    expect(sql).toContain('function public.calculate_earned_commissions')
    expect(sql).toContain('function public.generate_payroll_run_atomic')
    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain("p_organization_id::text || ':earned-commissions'")
    expect(sql).toMatch(
      /generate_series\(\s*p_period_from,\s*p_period_to,\s*interval '1 day'/,
    )
    expect(sql).toContain('not exists (\n          select 1\n          from public.payroll_entry_commissions')
    expect(sql).toContain('payroll_generation_idempotency_key_reused')
    expect(sql).toContain('payroll_period_already_generated')
    expect(sql).toContain("p_organization_id::text || ':payroll-run'")
    expect(sql).toContain("run.run_type = 'standard'")
    expect(sql).toContain('as salary_eligible')
    expect(sql).toContain("daily_employment.employment_status = 'active'")
    expect(sql).toContain("daily_employment.employee_role <> 'customer'")
    expect(sql).toMatch(
      /lead\(employment\.occurred_at\)[\s\S]*?active_employment_in_period/,
    )
    expect(sql).toContain('assignment.is_primary = true')
    expect(sql).toContain('salary_allocation_conflict')
    expect(sql).toContain('allocated_entry.base_amount > 0')
    expect(sql).toContain('unclaimed_scoped_commission')
    expect(sql).toContain('left join unclaimed_scoped_commission unclaimed_commission')
    expect(sql).toContain('or unclaimed_commission.employee_id is not null')
    expect(functionDefinition('validate_payroll_entry_scope')).toContain(
      'payroll_entry_requires_staff_or_owed_commission',
    )
    expect(functionDefinition('validate_payroll_entry_scope')).toContain(
      "coalesce(employment.ended_at, 'infinity'::timestamptz)",
    )
  })

  it('uses the organization calendar for immutable payroll event dates', () => {
    const generatePayroll = functionDefinition('generate_payroll_run_atomic')
    const validateEntry = functionDefinition('validate_payroll_entry_scope')
    const protectRule = functionDefinition('protect_approved_commission_rule')
    const protectCompensation = functionDefinition(
      'protect_used_employee_compensation',
    )

    expect(sql).toContain('organization_timezone text')
    expect(sql).toContain("organization_timezone text := 'america/asuncion'")
    expect(sql).toContain('at time zone organization_timezone')
    expect(sql).not.toContain('sale.created_at::date')
    expect(sql).not.toContain('sale.updated_at::date')
    expect(sql).not.toContain('repair.updated_at::date')
    expect(sql).not.toContain(
      '(sale.updated_at at time zone organization_timezone)::date',
    )
    expect(sql).not.toContain(
      '(repair.updated_at at time zone organization_timezone)::date',
    )
    expect(sql).toContain('join pg_timezone_names timezone_record')
    expect(generatePayroll).toContain(
      "organization_timezone text := 'america/asuncion'",
    )
    expect(generatePayroll).toContain(
      '(p_period_to + 1)::timestamp at time zone organization_timezone',
    )
    expect(generatePayroll).toContain(
      'p_period_from::timestamp at time zone organization_timezone',
    )
    expect(generatePayroll).not.toContain('p_period_to::timestamptz')
    expect(generatePayroll).not.toContain('p_period_from::timestamptz')
    expect(generatePayroll).not.toContain(
      'employment.occurred_at < pay_day::date',
    )
    expect(validateEntry).toContain(
      "organization_timezone text := 'america/asuncion'",
    )
    expect(validateEntry).toContain(
      '(target_run.period_to + 1)::timestamp at time zone organization_timezone',
    )
    expect(validateEntry).toContain(
      'target_run.period_from::timestamp at time zone organization_timezone',
    )
    expect(validateEntry).not.toContain('target_run.period_to::timestamptz')
    expect(validateEntry).not.toContain('target_run.period_from::timestamptz')
    expect(protectRule).toContain('organization_today date')
    expect(protectCompensation).toContain('organization_today date')
    expect(sql).not.toContain('current_date')
    expect(sql).not.toMatch(/legacy\.(paid_at|updated_at|created_at)::date/)
  })

  it('freezes approved payroll and permits only append-only corrections', () => {
    expect(sql).toContain('function public.approve_payroll_run_atomic')
    expect(sql).toContain('protect_approved_payroll_run')
    expect(sql).toContain('protect_approved_payroll_entry')
    expect(sql).toContain('payroll_approved_run_is_immutable')
    expect(sql).toContain('payroll_run_with_claims_cannot_be_voided')
    expect(sql).toContain('before update or delete on public.payroll_adjustments')
    expect(sql).toContain('payroll_adjustments_are_append_only')
    expect(sql).toContain('reverses_adjustment_id')
    expect(sql).toContain('sync_payroll_entry_from_adjustment')
    expect(sql).toContain('after insert on public.payroll_adjustments')
    expect(tableDefinition('payroll_adjustments')).toContain(
      'included_in_net boolean not null default false',
    )
    expect(sql).toContain("target_run.status not in ('draft', 'approved')")
    expect(sql).toContain("when target_run.status = 'draft' then true")
    expect(sql).toContain('adjustment.included_in_net = false')
  })

  it('supports atomic idempotent partial cash and noncash payroll payments', () => {
    expect(sql).toContain('function public.pay_payroll_entry_atomic')
    expect(tableDefinition('payroll_payments')).toContain('idempotency_key text not null')
    expect(tableDefinition('payroll_payments')).toContain(
      "payment_method in ('cash', 'bank_transfer', 'other')",
    )
    expect(sql).toContain('payroll_payment_id')
    expect(sql).toContain('insert into public.cash_movements')
    expect(sql).toContain('open_cash_session_not_found')
    expect(sql).toContain('payroll_overpayment')
    expect(sql).toContain('payroll_payment_idempotency_key_reused')
    expect(sql).toContain('if found then\n    return jsonb_build_object(')
  })

  it('enforces organization and branch isolation with least privileges', () => {
    expect(sql).toContain('foreign key (organization_id, branch_id)')
    expect(sql).toContain('references public.branches (organization_id, id)')
    expect(sql).toContain('validate_payroll_entry_scope')
    expect(sql).toContain('payroll_entry_scope_mismatch')
    expect(sql).toContain('validate_payroll_entry_commission_insert')
    expect(sql).toContain('organization_id = public.current_organization_id()')
    expect(sql).toContain('public.user_has_branch_access(branch_id)')
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('revoke all on table public.payroll_payments from public, anon, authenticated')
    expect(sql).toContain('grant select on table public.payroll_payments to authenticated')
    expect(sql).not.toContain('grant all on table public.payroll_')
    expect(sql).not.toContain(
      'grant select, insert on table public.commission_terminal_events to service_role',
    )
    expect(sql).not.toContain(
      'grant select, insert on table public.commission_refund_events to service_role',
    )
  })

  it('indexes payroll foreign keys and tenant-period work queues', () => {
    expect(sql).toContain('employee_compensation_employee_idx')
    expect(sql).toContain('commission_rules_employee_idx')
    expect(sql).toContain('earned_commissions_rule_idx')
    expect(sql).toContain('earned_commissions_reverses_idx')
    expect(sql).toContain('payroll_entries_run_idx')
    expect(sql).toContain('payroll_adjustments_entry_idx')
    expect(sql).toContain('payroll_payments_entry_idx')
    expect(sql).toContain('payroll_runs_scope_period_idx')
    expect(sql).toContain('commission_operation_attributions_source_idx')
    expect(sql).toContain('employee_employment_events_employee_period_idx')
  })

  it('imports each legacy technician source once and marks the commission cutover', () => {
    expect(sql).toContain('from public.technician_compensation')
    expect(sql).toContain('from public.technician_payments')
    expect(sql).toContain('legacy_source_id')
    expect(sql).toContain('legacy_component')
    expect(sql).toContain('legacy_cutover_on')
    expect(sql).toContain('employee_compensation_legacy_source_unique')
    expect(sql).toContain('commission_rules_legacy_source_unique')
    expect(sql).toContain('payroll_runs_legacy_source_unique')
    expect(sql).toContain('payroll_entries_legacy_source_unique')
    expect(sql).toContain('payroll_payments_legacy_source_unique')
    expect(sql).toContain('rule.legacy_cutover_on')
    expect(tableDefinition('commission_rules')).toContain('accrual_status text')
    expect(sql).toContain('legacy.accrual_status')
    expect(sql).toContain('rule.accrual_status')
    expect(sql).toContain("('listo'::text, repair.completed_at)")
    expect(sql).toContain("('entregado'::text, repair.delivered_at)")
    expect(tableDefinition('employee_compensation')).toContain('legacy_cutover_on date')
    expect(sql).toMatch(
      /pay_day::date >= coalesce\(\s*compensation_record\.legacy_cutover_on/,
    )
  })

  it('keeps the existing technician earnings adapter compatible', () => {
    const adapter = readFileSync(
      resolve(workspace, 'src/lib/technician/earnings-server.ts'),
      'utf8',
    )

    expect(adapter).toContain(".from('technician_compensation')")
    expect(adapter).toContain(
      ".select('base_salary, commission_rate, commission_base, fixed_per_repair, accrual_status, salary_effective_from')",
    )
    expect(sql).not.toContain('drop table public.technician_compensation')
    expect(sql).not.toContain('drop table public.technician_payments')
  })

  it('keeps payroll cash rows private from POS-only readers and writers', () => {
    expect(sql).toContain('cash_movements_authenticated_source_guard')
    expect(sql).toContain('finance_payment_id is null\n  and payroll_payment_id is null')
    expect(sql).toContain('cash_movements_finance_aware_read')
    expect(sql).toContain('payroll_payment_id is not null')
    expect(sql).toContain("public.has_org_permission(organization_id, 'finances.read')")
    expect(sql).toContain('validate_payroll_cash_movement_insert')
    expect(sql).toContain('protect_payroll_cash_movement')
  })
})
