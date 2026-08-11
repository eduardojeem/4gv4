import type {
  CommissionContext,
  CommissionRule,
  CoverageWarning,
  FinanceSummary,
  FinancialPayableLine,
  FinancialSummaryInput,
} from './types'

const sumAmounts = (lines: FinancialPayableLine[]): number =>
  lines.reduce((total, line) => total + line.amount, 0)

const sumPaidAmounts = (lines: FinancialPayableLine[]): number =>
  lines.reduce((total, line) => total + line.paidAmount, 0)

export function calculateFinancialSummary(
  input: FinancialSummaryInput,
): FinanceSummary {
  const revenue = input.revenue.reduce((total, line) => total + line.amount, 0)
  const collected = input.revenue.reduce(
    (total, line) => total + line.cashAmount,
    0,
  )
  const directCosts = sumAmounts(input.directCosts)
  const operatingExpenses = sumAmounts(input.expenses)
  const payrollCost = sumAmounts(input.payroll)
  const paid =
    sumPaidAmounts(input.directCosts) +
    sumPaidAmounts(input.expenses) +
    sumPaidAmounts(input.payroll)
  const coverageWarnings: CoverageWarning[] = input.revenue.flatMap(
    (line, index) =>
      line.hasCost
        ? []
        : [
            {
              code: 'MISSING_DIRECT_COST',
              message: 'El ingreso no tiene un costo directo registrado.',
              sourceId: line.id ?? `revenue-${index + 1}`,
            },
          ],
  )
  const grossProfit = revenue - directCosts

  return {
    accrued: {
      revenue,
      directCosts,
      grossProfit,
      operatingExpenses,
      payrollCost,
      netProfit: grossProfit - operatingExpenses - payrollCost,
    },
    cash: {
      collected,
      paid,
      netCashFlow: collected - paid,
    },
    complete: coverageWarnings.length === 0,
    coverageWarnings,
  }
}

function matchesCommissionRule(
  rule: CommissionRule,
  input: CommissionContext,
): boolean {
  if (rule.source !== input.source || rule.effectiveFrom > input.occurredOn) {
    return false
  }

  if (rule.effectiveTo && rule.effectiveTo < input.occurredOn) {
    return false
  }

  if (rule.branchId && rule.branchId !== input.branchId) {
    return false
  }

  return rule.scopeType === 'employee'
    ? rule.employeeId === input.employeeId
    : rule.role === input.role
}

function commissionRulePriority(rule: CommissionRule): [number, number, string] {
  return [
    rule.scopeType === 'employee' ? 1 : 0,
    rule.branchId ? 1 : 0,
    rule.effectiveFrom,
  ]
}

export function resolveCommissionRule(
  rules: CommissionRule[],
  input: CommissionContext,
): CommissionRule | null {
  const matchingRules = rules.filter((rule) => matchesCommissionRule(rule, input))

  if (matchingRules.length === 0) {
    return null
  }

  return matchingRules.sort((left, right) => {
    const leftPriority = commissionRulePriority(left)
    const rightPriority = commissionRulePriority(right)

    for (let index = 0; index < leftPriority.length; index += 1) {
      if (leftPriority[index] !== rightPriority[index]) {
        return leftPriority[index] < rightPriority[index] ? 1 : -1
      }
    }

    return left.id.localeCompare(right.id)
  })[0]
}
