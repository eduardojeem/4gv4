import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workspace = process.cwd()
const read = (path: string) => readFileSync(resolve(workspace, path), 'utf8')

describe('admin finance API contract', () => {
  it('protects and validates obligation list and creation boundaries', () => {
    const route = read('src/app/api/admin/finances/obligations/route.ts')

    expect(route).toContain('withAdminAuth')
    expect(route).toContain('expenseInputSchema.safeParse')
    expect(route).toContain('obligationQuerySchema.safeParse')
    expect(route).toContain('resolveFinanceOrganizationId')
    expect(route).toContain('assertFinanceBranchAccess')
    expect(route).toContain("request.headers.get('x-idempotency-key')")
    expect(route).toContain('idempotencyKeySchema.safeParse')
    expect(route).toContain('idempotencyKeyResult.data')
  })

  it('keeps every service-backed finance query tenant scoped', () => {
    const server = read('src/lib/finance/server.ts')

    expect(server).toContain(".eq('organization_id', organizationId)")
    expect(server).toContain(".eq('branch_id', input.branchId)")
    expect(server).toContain('resolveBranchScopeForUser')
    expect(server).toContain('strict: true')
    expect(server).not.toContain(".from('cash_movements').insert")
    expect(server).toContain("'create_recurring_finance_obligation_atomic'")
    expect(server).not.toContain(".from('finance_expense_templates')\n+      .delete()")
  })

  it('validates update and void requests before scoped mutations', () => {
    const route = read('src/app/api/admin/finances/obligations/[id]/route.ts')

    expect(route).toContain('withAdminAuth')
    expect(route).toContain('obligationIdSchema.safeParse')
    expect(route).toContain('expenseUpdateSchema.safeParse')
    expect(route).toContain('voidObligationSchema.safeParse')
    expect(route).toContain('assertFinanceBranchAccess')
  })

  it('requires and forwards one exact HTTP idempotency key to the atomic payment RPC', () => {
    const route = read(
      'src/app/api/admin/finances/obligations/[id]/payments/route.ts',
    )

    expect(route).toContain('withAdminAuth')
    expect(route).toContain("request.headers.get('x-idempotency-key')")
    expect(route).toContain('idempotencyKeySchema.safeParse')
    expect(route).toContain('paymentInputSchema.safeParse')
    expect(route).toContain("'pay_finance_obligation_atomic'")
    expect(route).toContain('p_idempotency_key: idempotencyKeyResult.data')
    expect(route).not.toContain(".from('cash_movements').insert")
  })

  it('maps finance conflicts, invalid state, and branch denial explicitly', () => {
    const server = read('src/lib/finance/server.ts')

    expect(server).toContain('FINANCE_IDEMPOTENCY_KEY_REUSED')
    expect(server).toContain('FINANCE_OVERPAYMENT')
    expect(server).toContain('FINANCE_OBLIGATION_NOT_PAYABLE')
    expect(server).toContain('FINANCE_BRANCH_PERMISSION_DENIED')
    expect(server).toContain('status: 409')
    expect(server).toContain('status: 422')
    expect(server).toContain('status: 403')
  })

  it('does not expose raw database errors in API responses', () => {
    const server = read('src/lib/finance/server.ts')

    expect(server).not.toContain('new FinanceApiError(rawMessage')
    expect(server).toContain("code: 'FINANCE_INTERNAL_ERROR'")
  })

  it('calls only the authenticated organization-scoped recurrence generator', () => {
    const route = read(
      'src/app/api/admin/finances/recurrences/generate/route.ts',
    )

    expect(route).toContain('withAdminAuth')
    expect(route).toContain('recurrenceGenerationSchema.safeParse')
    expect(route).toContain('createClient')
    expect(route).toContain("'generate_recurring_finance_obligations'")
    expect(route).toContain('p_generation_date: bodyResult.data.generationDate')
    expect(route).toContain('p_organization_id: organizationId')
    expect(route).not.toContain('generate_all_recurring_finance_obligations')
  })

  it('protects and validates organization-shared category reads', () => {
    const route = read('src/app/api/admin/finances/categories/route.ts')

    expect(route).toContain('withAdminAuth')
    expect(route).toContain('categoryQuerySchema.safeParse')
    expect(route).toContain('resolveFinanceOrganizationId')
  })
})
