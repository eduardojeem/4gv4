import type {
  CommissionContext,
  CommissionRule,
  CoverageWarning,
  FinanceSummary,
  FinancialPayableLine,
  FinancialRefundLine,
  FinancialSummaryInput,
  FinancialRevenueLine,
} from './types'
import { isFinanceAmount } from './types'

function assertFinanceAmount(value: number, field: string): void {
  if (!isFinanceAmount(value)) {
    throw new RangeError(`${field} must be a numeric(14,2) amount.`)
  }
}

function assertRevenueLine(line: FinancialRevenueLine, index: number): void {
  assertFinanceAmount(line.amount, `revenue[${index}].amount`)
  assertFinanceAmount(line.cashAmount, `revenue[${index}].cashAmount`)

  if (line.cashAmount > line.amount) {
    throw new RangeError(
      `revenue[${index}].cashAmount cannot exceed revenue[${index}].amount.`,
    )
  }
}

function assertPayableLine(line: FinancialPayableLine, group: string, index: number): void {
  assertFinanceAmount(line.amount, `${group}[${index}].amount`)
  assertFinanceAmount(line.paidAmount, `${group}[${index}].paidAmount`)

  if (line.paidAmount > line.amount) {
    throw new RangeError(
      `${group}[${index}].paidAmount cannot exceed ${group}[${index}].amount.`,
    )
  }
}

function assertRefundLine(line: FinancialRefundLine, index: number): void {
  assertFinanceAmount(line.amount, `refunds[${index}].amount`)
  assertFinanceAmount(line.recoveredCost, `refunds[${index}].recoveredCost`)
  assertFinanceAmount(line.cashAmount, `refunds[${index}].cashAmount`)

  if (line.cashAmount > line.amount) {
    throw new RangeError(
      `refunds[${index}].cashAmount cannot exceed refunds[${index}].amount.`,
    )
  }

  // Recuperar mas costo del que se reintegro daria margen positivo por devolver.
  if (line.recoveredCost > line.amount) {
    throw new RangeError(
      `refunds[${index}].recoveredCost cannot exceed refunds[${index}].amount.`,
    )
  }
}

function assertFinancialSummaryInput(input: FinancialSummaryInput): void {
  input.revenue.forEach(assertRevenueLine)
  input.directCosts.forEach((line, index) =>
    assertPayableLine(line, 'directCosts', index),
  )
  input.expenses.forEach((line, index) => assertPayableLine(line, 'expenses', index))
  input.payroll.forEach((line, index) => assertPayableLine(line, 'payroll', index))
  ;(input.refunds ?? []).forEach(assertRefundLine)
}

const sumAmounts = (lines: FinancialPayableLine[]): number =>
  lines.reduce((total, line) => total + line.amount, 0)

const sumPaidAmounts = (lines: FinancialPayableLine[]): number =>
  lines.reduce((total, line) => total + line.paidAmount, 0)

export function calculateFinancialSummary(
  input: FinancialSummaryInput,
): FinanceSummary {
  assertFinancialSummaryInput(input)

  const refunds = input.refunds ?? []
  const refundedAmount = refunds.reduce((total, line) => total + line.amount, 0)
  const recoveredCost = refunds.reduce((total, line) => total + line.recoveredCost, 0)
  const refundedCash = refunds.reduce((total, line) => total + line.cashAmount, 0)

  // Una devolucion revierte el ingreso de su venta, y devuelve al inventario el
  // costo solo si la mercaderia volvio vendible.
  const revenue =
    input.revenue.reduce((total, line) => total + line.amount, 0) - refundedAmount
  const collected = input.revenue.reduce(
    (total, line) => total + line.cashAmount,
    0,
  )
  const directCosts = sumAmounts(input.directCosts) - recoveredCost
  const operatingExpenses = sumAmounts(input.expenses)
  const payrollCost = sumAmounts(input.payroll)
  // El reintegro por caja es plata que salio; el saldo a favor no mueve caja.
  const paid =
    sumPaidAmounts(input.directCosts) +
    sumPaidAmounts(input.expenses) +
    sumPaidAmounts(input.payroll) +
    refundedCash
  const coverageWarnings: CoverageWarning[] = input.revenue.flatMap(
    (line, index) =>
      line.hasCost
        ? []
        : [
            {
              code: 'MISSING_DIRECT_COST',
              message: 'El ingreso no tiene un costo directo registrado.',
              sourceId: line.id ?? `revenue-${index + 1}`,
              sourceLabel: line.label,
              sourceType: line.sourceType,
            },
          ],
  )
  const complete = coverageWarnings.length === 0
  const grossProfit = complete ? revenue - directCosts : null

  return {
    accrued: {
      revenue,
      directCosts,
      grossProfit,
      operatingExpenses,
      payrollCost,
      netProfit:
        grossProfit === null
          ? null
          : grossProfit - operatingExpenses - payrollCost,
    },
    cash: {
      collected,
      paid,
      netCashFlow: collected - paid,
    },
    complete,
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
