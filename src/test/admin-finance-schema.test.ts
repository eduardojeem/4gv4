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
})
