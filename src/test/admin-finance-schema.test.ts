import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260811190000_create_finance_foundation.sql',
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

describe('admin finance database foundation', () => {
  it('creates the organization- and branch-scoped finance ledger', () => {
    expect(sql).toContain('create table if not exists public.finance_categories')
    expect(sql).toContain('create table if not exists public.finance_expense_templates')
    expect(sql).toContain('create table if not exists public.finance_obligations')
    expect(sql).toContain('create table if not exists public.finance_payments')
    expect(sql).toContain('create table if not exists public.finance_audit_events')
    expect(sql).toContain('numeric(14, 2)')
    expect(sql).toContain('foreign key (organization_id, branch_id)')
    expect(sql).toContain('references public.branches (organization_id, id)')
    expect(sql).toContain('from public.organization_settings settings')
    expect(sql).toContain('due_date is null or due_date >= accounting_date')
    expect(tableDefinition('finance_categories')).toContain(
      'references public.organizations(id) on delete cascade',
    )
    expect(tableDefinition('finance_audit_events')).toContain(
      'references public.organizations(id) on delete cascade',
    )
  })

  it('enforces lifecycle, recurrence, and private receipt invariants', () => {
    expect(sql).toContain(
      "status in ('draft', 'pending', 'partially_paid', 'paid', 'overdue', 'voided')",
    )
    expect(sql).toContain('unique (organization_id, template_id, recurrence_period)')
    expect(sql).toContain('receipt_storage_path')
    expect(sql).toContain('receipt_mime_type')
    expect(sql).toContain('receipt_size_bytes')
    expect(sql).toContain(
      'foreign key (organization_id, branch_id, finance_payment_id)',
    )
    expect(sql).toContain(
      'receipt_storage_path is null and receipt_original_name is null',
    )
    expect(sql).toContain('prevent_paid_finance_obligation_delete')
    expect(sql).toContain('prevent_finance_audit_event_mutation')
    expect(sql).toContain('target_actor_id := coalesce(')
    expect(sql).toContain('auth.uid(),')
    expect(sql).toContain('function public.void_finance_obligation_atomic')
    expect(sql).toContain("direction in ('payment', 'reversal')")
    expect(sql).toContain('reverses_payment_id')
  })

  it('generates recurring obligations idempotently', () => {
    expect(sql).toContain('function public.generate_recurring_finance_obligations')
    expect(sql).toContain('on conflict (organization_id, template_id, recurrence_period) do nothing')
    expect(sql).toContain('pg_advisory_xact_lock')
  })

  it('pays an obligation and posts cash atomically within one tenant branch', () => {
    expect(sql).toContain('function public.pay_finance_obligation_atomic')
    expect(sql).toContain("has_org_permission(p_organization_id, 'finances.pay')")
    expect(sql).toContain('user_has_branch_access(p_branch_id)')
    expect(sql).toContain('for update')
    expect(sql).toContain('open_cash_session_not_found')
    expect(sql).toContain('finance_overpayment')
    expect(sql).toContain('insert into public.cash_movements')
    expect(sql).toContain('finance_payment_id')
    expect(sql).toContain('function public.post_finance_cash_movement_from_payment')
    expect(sql).toContain('finance_payments_post_cash_movement')
    expect(sql).toContain("get_user_role(actor_id) = 'super_admin'")
  })

  it('uses explicit authenticated privileges and tenant RLS', () => {
    expect(sql).toContain('organization_id = public.current_organization_id()')
    expect(sql).toContain('to authenticated')
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('grant select')
    expect(sql).toContain('revoke all on function public.pay_finance_obligation_atomic')
    expect(sql).not.toContain('or public.current_organization_id() is null')
  })

  it('makes finance-linked cash movements immutable while preserving legacy rows', () => {
    expect(sql).toContain('function public.protect_finance_cash_movement()')
    expect(sql).toContain('old.finance_payment_id is not null')
    expect(sql).toContain('before update or delete on public.cash_movements')
    expect(sql).toContain('cash_movements_authenticated_source_guard')
    expect(sql).toContain('finance_payment_id is null')
  })

  it('hides finance cash details from POS-only readers', () => {
    expect(sql).toContain('cash_movements_finance_aware_read')
    expect(sql).toMatch(
      /finance_payment_id is not null\s+and public\.has_org_permission\(organization_id, 'finances\.read'\)/,
    )
    expect(sql).toContain('drop policy if exists "tenant members can read cash movements"')
    expect(sql).toContain('drop policy if exists "cash_movements_select_org"')
  })

  it('freezes ever-paid obligation identity and makes void terminal', () => {
    expect(sql).toContain('finance_ever_paid_obligation_immutable')
    expect(sql).toContain('new.branch_id is distinct from old.branch_id')
    expect(sql).toContain('new.accounting_date is distinct from old.accounting_date')
    expect(sql).toContain("old.status = 'voided'")
    expect(sql).toContain('new.void_reason is distinct from old.void_reason')
    expect(sql).toContain('finance_voided_obligation_is_terminal')
  })

  it('allows only FK-driven audit lifecycle changes and preserves rows after actor deletion', () => {
    expect(sql).toContain('pg_trigger_depth() > 1')
    expect(tableDefinition('finance_expense_templates')).toContain(
      'created_by uuid references auth.users(id) on delete set null',
    )
    expect(tableDefinition('finance_obligations')).toContain(
      'created_by uuid references auth.users(id) on delete set null',
    )
    expect(tableDefinition('finance_payments')).toContain(
      'created_by uuid references auth.users(id) on delete set null',
    )
  })

  it('uses explicit service privileges without ledger truncation rights', () => {
    expect(sql).not.toContain('grant all on table public.finance_')
    expect(sql).toContain(
      'grant select, insert, update, delete on table public.finance_obligations to service_role',
    )
    expect(sql).toContain(
      'grant select, insert on table public.finance_payments to service_role',
    )
    expect(sql).toContain(
      'revoke truncate, references, trigger on table public.cash_movements',
    )
  })

  it('keeps template and reversal references branch-safe', () => {
    expect(tableDefinition('finance_expense_templates')).toContain(
      'unique (organization_id, branch_id, id)',
    )
    expect(tableDefinition('finance_obligations')).toContain(
      'foreign key (organization_id, branch_id, template_id)',
    )
    expect(tableDefinition('finance_payments')).toContain(
      'foreign key (organization_id, branch_id, reverses_payment_id)',
    )
  })

  it('anchors every recurrence cadence to starts_on', () => {
    expect(sql).toContain('elapsed_months integer')
    expect(sql).toContain('make_interval(months => elapsed_months)')
    expect(sql).not.toContain("when 'monthly' then date_trunc('month'")
    expect(sql).not.toContain("when 'quarterly' then date_trunc('quarter'")
    expect(sql).not.toContain("when 'yearly' then date_trunc('year'")
  })

  it('separates branch-authorized generation from global service generation', () => {
    expect(sql).toContain('function public.generate_all_recurring_finance_obligations')
    expect(sql).toContain('user_has_branch_access(template.branch_id, actor_id)')
    expect(sql).not.toContain('p_organization_id uuid default null')
    expect(sql).toContain(
      'grant execute on function public.generate_all_recurring_finance_obligations(date)\nto service_role',
    )
  })

  it('indexes actor foreign keys, audit branches, and recurrence generation', () => {
    expect(sql).toContain('finance_categories_created_by_idx')
    expect(sql).toContain('finance_templates_created_by_idx')
    expect(sql).toContain('finance_obligations_voided_by_idx')
    expect(sql).toContain('finance_payments_created_by_idx')
    expect(sql).toContain('finance_audit_events_actor_idx')
    expect(sql).toContain('finance_audit_events_branch_idx')
    expect(sql).toContain('finance_templates_generation_idx')
  })

  it('requires payment idempotency and safely replays matching requests', () => {
    expect(tableDefinition('finance_payments')).toContain(
      'idempotency_key text not null',
    )
    expect(tableDefinition('finance_payments')).toContain(
      'unique (organization_id, obligation_id, idempotency_key)',
    )
    expect(sql).toContain('p_idempotency_key text')
    expect(sql).toContain('finance_idempotency_key_reused')
    expect(sql).toContain('if found then\n    return jsonb_build_object(')
  })

  it('refreshes cash-session activity for finance cash postings', () => {
    expect(sql).toContain('set last_activity_at = now(), updated_at = now()')
    expect(sql).toContain('where id = new.cash_session_id')
  })
})
