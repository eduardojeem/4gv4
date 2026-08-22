import { describe, expect, it } from 'vitest'
import { buildCreditInstallmentPlan } from './installments'
import { buildPosCreditSummary } from './pos-credit-summary'

describe('buildCreditInstallmentPlan', () => {
  it('splits the financed total including interest into installments', () => {
    const plan = buildCreditInstallmentPlan({
      principalAmount: 100000,
      interestRate: 10,
      installmentCount: 4,
      frequency: 'monthly',
      now: new Date('2026-06-15T00:00:00.000Z'),
    })

    expect(plan.financedTotal).toBe(110000)
    expect(plan.interestAmount).toBe(10000)
    expect(plan.installments).toHaveLength(4)
    expect(plan.installments.map(installment => installment.amount)).toEqual([27500, 27500, 27500, 27500])
    expect(plan.installments.reduce((sum, installment) => sum + installment.amount, 0)).toBe(110000)
  })

  it('calculates five monthly installments with ten percent interest', () => {
    const plan = buildCreditInstallmentPlan({
      principalAmount: 100000,
      interestRate: 10,
      installmentCount: 5,
      frequency: 'monthly',
      now: new Date('2026-06-15T00:00:00.000Z'),
    })

    expect(plan.interestAmount).toBe(10000)
    expect(plan.financedTotal).toBe(110000)
    expect(plan.installments.map(installment => installment.amount)).toEqual([22000, 22000, 22000, 22000, 22000])
    expect(plan.installments[0].dueDate.toISOString()).toBe('2026-07-15T00:00:00.000Z')
  })

  it('builds the POS credit total used by summary and receipt', () => {
    const summary = buildPosCreditSummary(100000, {
      count: 5,
      frequency: 'monthly',
      interestRate: 10,
    }, { now: new Date('2026-06-15T00:00:00.000Z') })

    expect(summary.baseTotal).toBe(100000)
    expect(summary.interestAmount).toBe(10000)
    expect(summary.financedTotal).toBe(110000)
    expect(summary.installmentAmount).toBe(22000)
    expect(summary.firstDueDate).toBe('2026-07-15T00:00:00.000Z')
  })

  it.each([
    ['weekly', '2026-06-22T00:00:00.000Z'],
    ['biweekly', '2026-06-30T00:00:00.000Z'],
    ['monthly', '2026-07-15T00:00:00.000Z'],
  ] as const)('exposes the first %s due date for the checkout and receipt', (frequency, expectedDate) => {
    const summary = buildPosCreditSummary(100000, {
      count: 3,
      frequency,
      interestRate: 0,
    }, { now: new Date('2026-06-15T00:00:00.000Z') })

    expect(summary.firstDueDate).toBe(expectedDate)
  })

  it('keeps rounding remainders in the last installment', () => {
    const plan = buildCreditInstallmentPlan({
      principalAmount: 100,
      interestRate: 10,
      installmentCount: 3,
      frequency: 'weekly',
      now: new Date('2026-06-15T00:00:00.000Z'),
    })

    expect(plan.installments.map(installment => installment.amount)).toEqual([36.66, 36.66, 36.68])
    expect(plan.installments.reduce((sum, installment) => Number((sum + installment.amount).toFixed(2)), 0)).toBe(110)
  })

  it('starts on the provided due date when one is selected', () => {
    const plan = buildCreditInstallmentPlan({
      principalAmount: 900,
      installmentCount: 2,
      frequency: 'biweekly',
      firstDueDate: new Date('2026-07-01T00:00:00.000Z'),
      startInstallmentNumber: 5,
    })

    expect(plan.installments[0].installmentNumber).toBe(5)
    expect(plan.installments[0].dueDate.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(plan.installments[1].dueDate.toISOString()).toBe('2026-07-16T00:00:00.000Z')
  })
})
