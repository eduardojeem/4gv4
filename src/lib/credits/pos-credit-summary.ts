import { buildCreditInstallmentPlan, type CreditFrequency } from './installments'

export type PosCreditTerms = {
  count: number
  frequency: CreditFrequency
  interestRate: number
}

export type PosCreditSummary = {
  baseTotal: number
  interestAmount: number
  financedTotal: number
  installmentCount: number
  installmentAmount: number
  frequency: CreditFrequency
  firstDueDate: string
}

export function buildPosCreditSummary(
  baseTotal: number,
  terms: PosCreditTerms,
  options: { now?: Date } = {},
): PosCreditSummary {
  const plan = buildCreditInstallmentPlan({
    principalAmount: baseTotal,
    interestRate: terms.interestRate,
    installmentCount: terms.count,
    frequency: terms.frequency,
    now: options.now,
  })

  return {
    baseTotal: plan.principalAmount,
    interestAmount: plan.interestAmount,
    financedTotal: plan.financedTotal,
    installmentCount: plan.installmentCount,
    installmentAmount: plan.installments[0]?.amount ?? 0,
    frequency: plan.frequency,
    firstDueDate: plan.installments[0].dueDate.toISOString(),
  }
}
