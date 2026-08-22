import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import * as financeServer from '@/lib/finance/server'

const { toFinanceApiError } = financeServer

const workspace = process.cwd()
const read = (path: string) => readFileSync(resolve(workspace, path), 'utf8')

describe('admin payroll API contract', () => {
  it('protects employee, compensation, and commission boundaries with scoped validation', () => {
    const employeesRoute = read('src/app/api/admin/finances/employees/route.ts')
    const compensationRoute = read(
      'src/app/api/admin/finances/compensation/route.ts',
    )
    const commissionRulesRoute = read(
      'src/app/api/admin/finances/commission-rules/route.ts',
    )

    for (const route of [employeesRoute, compensationRoute, commissionRulesRoute]) {
      expect(route).toContain('withAdminAuth')
      expect(route).toContain('resolveFinanceOrganizationId')
    }

    expect(compensationRoute).toContain('compensationInputSchema.safeParse')
    expect(compensationRoute).toContain('assertFinanceEmployeeMembership')
    expect(commissionRulesRoute).toContain('commissionRuleInputSchema.safeParse')
    expect(commissionRulesRoute).toContain('assertFinanceEmployeeMembership')
    expect(commissionRulesRoute).toContain('assertFinanceBranchAccess')
  })

  it('generates deterministic payroll previews and requires an idempotency key for runs', () => {
    const route = read('src/app/api/admin/finances/payroll/route.ts')

    expect(route).toContain('withAdminAuth')
    expect(route).toContain('payrollPreviewQuerySchema.safeParse')
    expect(route).toContain('payrollGenerationInputSchema.safeParse')
    expect(route).toContain("request.headers.get('x-idempotency-key')")
    expect(route).toContain('getPayrollPreview')
    expect(route).toContain('generatePayrollRun')
  })

  it('approves and pays payroll only through the Task 4 atomic RPCs', () => {
    const approvalRoute = read(
      'src/app/api/admin/finances/payroll/[id]/approve/route.ts',
    )
    const paymentRoute = read(
      'src/app/api/admin/finances/payroll/[id]/payments/route.ts',
    )

    expect(approvalRoute).toContain('withAdminAuth')
    expect(approvalRoute).toContain('payrollRunIdSchema.safeParse')
    expect(approvalRoute).toContain("'approve_payroll_run_atomic'")
    expect(paymentRoute).toContain('withAdminAuth')
    expect(paymentRoute).toContain('payrollPaymentInputSchema.safeParse')
    expect(paymentRoute).toContain("'pay_payroll_entry_atomic'")
    expect(paymentRoute).toContain("request.headers.get('x-idempotency-key')")
    expect(paymentRoute).toContain('getPayrollEntryBranch')
    expect(paymentRoute).toContain('if (entry.branch_id) await assertFinanceBranchAccess')
    expect(paymentRoute).toContain('branchId: entry.branch_id')
    expect(paymentRoute).not.toContain('branchId: body.data.branchId')
    expect(paymentRoute).not.toContain(".from('cash_movements').insert")

    const server = read('src/lib/finance/server.ts')
    expect(server).toContain('if (entry.branch_id !== run.branch_id)')
    expect(server).toContain('p_branch_id: params.branchId')
  })

  it('keeps payroll data organization scoped and records adjustments append-only', () => {
    const server = read('src/lib/finance/server.ts')

    expect(server).toContain(".from('organization_members')")
    expect(server).toContain(".eq('organization_id', organizationId)")
    expect(server).toContain(".from('payroll_adjustments')")
    expect(server).toContain('.insert({')
    expect(server).not.toContain(".from('payroll_entries').update")
    expect(server).toContain('PAYROLL_GENERATION_IDEMPOTENCY_KEY_REUSED')
    expect(server).toContain('PAYROLL_ENTRY_NOT_PAYABLE')
    expect(server).toContain('PAYROLL_BRANCH_PERMISSION_DENIED')
    expect(server).toContain('getCommissionRuleBranch')
  })

  it('returns an invalid-state error for an adjustment that would reduce payable payroll', () => {
    const error = toFinanceApiError({
      message: 'PAYROLL_ADJUSTMENT_BELOW_PAID_AMOUNT',
    })

    expect(error.status).toBe(422)
    expect(error.code).toBe('PAYROLL_INVALID_STATE')
  })

  it('derives a branch preview from the same payroll eligibility sources as generation', () => {
    const server = read('src/lib/finance/server.ts')

    expect(server).toContain("'calculate_earned_commissions'")
    expect(server).toContain(".from('user_branch_assignments')")
    expect(server).toContain(".eq('is_primary', true)")
    expect(server).toContain(".from('employee_employment_events')")
    expect(server).toContain('legacy_cutover_on')
    expect(server).toContain(".from('payroll_runs')")
    expect(server).toContain(".lte('occurred_on', input.periodTo)")
    expect(server).not.toContain(".gte('occurred_on', input.periodFrom)")
  })

  it('keeps an employee whose current membership is customer when historical employment is eligible', () => {
    expect(
      financeServer.shouldIncludePayrollPreviewMember({
        currentMembershipRole: 'customer',
        hasActiveEmployment: true,
        receivesSalaryAtBranch: true,
        hasUnclaimedCommission: false,
      }),
    ).toBe(true)
  })

  it.each([
    ['PAYROLL_PERIOD_ALREADY_GENERATED', 409, 'PAYROLL_CONFLICT'],
    ['PAYROLL_COMMISSION_RULE_PERIOD_OVERLAP', 409, 'PAYROLL_CONFLICT'],
    ['PAYROLL_ENTRY_NOT_PAYABLE', 422, 'PAYROLL_INVALID_STATE'],
    ['PAYROLL_BRANCH_NOT_IN_ORGANIZATION', 422, 'PAYROLL_INVALID_STATE'],
    ['PAYROLL_BRANCH_PERMISSION_DENIED', 403, 'PAYROLL_FORBIDDEN'],
    ['PAYROLL_RUN_NOT_FOUND', 404, 'PAYROLL_NOT_FOUND'],
  ])('maps %s to its public payroll error contract', (message, status, code) => {
    const error = toFinanceApiError({ message })

    expect(error.status).toBe(status)
    expect(error.code).toBe(code)
    expect(error.message).not.toContain('obligacion')
  })
})
