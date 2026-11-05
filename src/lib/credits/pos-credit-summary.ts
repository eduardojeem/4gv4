import {
  buildCreditInstallmentPlan,
  buildCreditInstallmentPlanFromAmounts,
  creditBusinessDate,
  fixedInstallmentAmounts,
  normalizeInstallmentCount,
  type CreditFrequency,
  type CreditScheduleMode,
  type FirstInstallmentTiming,
} from './installments'
import type { FirstInstallmentPayment } from './first-payment'

export type PosCreditTerms = {
  count: number
  frequency: CreditFrequency
  interestRate: number
  firstInstallmentTiming?: FirstInstallmentTiming
  startDate?: string
  firstPayment?: FirstInstallmentPayment
  /** Cómo se arman las cuotas. Sin valor: por recargo %. */
  scheduleMode?: CreditScheduleMode
  /** Valor de cada cuota en modo 'installment_amount'. */
  installmentAmount?: number
  /** Monto de cada cuota en modo 'custom' (uno por cuota). */
  customAmounts?: number[]
}

/**
 * Montos por cuota que se mandan al servidor, o null si el plan es por
 * recargo %. En modo manual, mientras la lista no tenga una fila por cuota,
 * se completa con el reparto en partes iguales.
 */
export function posCreditInstallmentAmounts(terms: PosCreditTerms, baseTotal: number): number[] | null {
  const count = normalizeInstallmentCount(terms.count)
  if (terms.scheduleMode === 'installment_amount') {
    return fixedInstallmentAmounts(count, Number(terms.installmentAmount) || 0)
  }
  if (terms.scheduleMode === 'custom') {
    const custom = Array.isArray(terms.customAmounts) ? terms.customAmounts : []
    if (custom.length === count) return custom.map(amount => Number(amount) || 0)
    return buildCreditInstallmentPlan({ principalAmount: baseTotal, installmentCount: count, interestRate: 0 })
      .installments.map(installment => installment.amount)
  }
  return null
}

/** Campos de cuotas por monto para el cuerpo de /api/pos/process-sale. */
export function posCreditSchedulePayload(terms: PosCreditTerms, baseTotal: number) {
  const amounts = posCreditInstallmentAmounts(terms, baseTotal)
  return amounts
    ? { schedule_mode: terms.scheduleMode, installment_amounts: amounts }
    : { schedule_mode: 'percent' as const }
}

export type PosCreditSummary = {
  baseTotal: number
  /** Recargo total %: el elegido, o el que resulta de los montos por cuota. */
  interestRate: number
  interestAmount: number
  financedTotal: number
  installmentCount: number
  installmentAmount: number
  frequency: CreditFrequency
  firstDueDate: string
  startDate: string
  firstInstallmentTiming: FirstInstallmentTiming
  lastInstallmentAmount: number
  firstPaymentAmount: number
  remainingBalance: number
  installments: Array<{ number: number; dueDate: string; amount: number }>
}

function toCalendarDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatPosCreditDueDate(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

export function buildPosCreditSummary(
  baseTotal: number,
  terms: PosCreditTerms,
  options: { now?: Date } = {},
): PosCreditSummary {
  const startDate = terms.startDate ?? (options.now ? toCalendarDate(options.now) : creditBusinessDate())
  const [year, month, day] = startDate.split('-').map(Number)
  const amounts = posCreditInstallmentAmounts(terms, baseTotal)
  const plan = amounts
    ? buildCreditInstallmentPlanFromAmounts({
      principalAmount: baseTotal,
      amounts,
      frequency: terms.frequency,
      now: new Date(year, month - 1, day, 12),
      firstInstallmentTiming: terms.firstInstallmentTiming,
    })
    : buildCreditInstallmentPlan({
      principalAmount: baseTotal,
      interestRate: terms.interestRate,
      installmentCount: terms.count,
      frequency: terms.frequency,
      now: new Date(year, month - 1, day, 12),
      firstInstallmentTiming: terms.firstInstallmentTiming,
    })

  return {
    baseTotal: plan.principalAmount,
    interestRate: plan.interestRate,
    interestAmount: plan.interestAmount,
    financedTotal: plan.financedTotal,
    installmentCount: plan.installmentCount,
    installmentAmount: plan.installments[0]?.amount ?? 0,
    frequency: plan.frequency,
    firstDueDate: toCalendarDate(plan.installments[0].dueDate),
    startDate,
    firstInstallmentTiming: terms.firstInstallmentTiming ?? 'at_start',
    lastInstallmentAmount: plan.installments[plan.installments.length - 1].amount,
    firstPaymentAmount: terms.firstPayment && terms.firstInstallmentTiming !== 'next_cycle' ? plan.installments[0].amount : 0,
    remainingBalance: plan.financedTotal - (terms.firstPayment && terms.firstInstallmentTiming !== 'next_cycle' ? plan.installments[0].amount : 0),
    installments: plan.installments.map(i => ({ number: i.installmentNumber, dueDate: toCalendarDate(i.dueDate), amount: i.amount })),
  }
}

/** Prefer the calendar actually committed by the atomic sale, including retries. */
export function withPersistedCreditSchedule<T extends { firstDueDate: string; installmentAmount: number }>(summary: T, value: unknown): T {
  if (!value || typeof value !== 'object') return summary
  const schedule = value as Partial<PosCreditSummary>
  if (!Array.isArray(schedule.installments) || schedule.installments.length === 0) return summary
  const installments = schedule.installments
  if (!installments.every(i => Number.isInteger(i.number) && typeof i.dueDate === 'string' && Number.isFinite(i.amount))) return summary
  return { ...summary, ...schedule, firstDueDate: installments[0].dueDate, installmentAmount: installments[0].amount,
    lastInstallmentAmount: installments[installments.length - 1].amount, installmentCount: installments.length }
}
