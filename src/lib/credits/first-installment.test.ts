import { describe, expect, it } from 'vitest'
import { buildCreditInstallmentPlan } from './installments'
import { buildPosCreditSummary, withPersistedCreditSchedule } from './pos-credit-summary'

describe('inicio de cuotas', () => {
  const now = new Date(2026, 0, 31, 12)
  it('vence al inicio por defecto', () => {
    const plan = buildCreditInstallmentPlan({ principalAmount: 100000, installmentCount: 3, now })
    expect(plan.installments[0].dueDate.getTime()).toBe(now.getTime())
  })
  it.each([['weekly', 7], ['biweekly', 15]] as const)('difiere un ciclo %s', (frequency, days) => {
    const plan = buildCreditInstallmentPlan({ principalAmount: 100000, frequency, firstInstallmentTiming: 'next_cycle', now })
    expect(plan.installments[0].dueDate.getDate()).toBe(days)
  })
  it('conserva fin de mes y no cambia los montos al diferir', () => {
    const terms = { count: 3, frequency: 'monthly' as const, interestRate: 10, startDate: '2026-01-31' }
    const today = buildPosCreditSummary(100000, terms)
    const later = buildPosCreditSummary(100000, { ...terms, firstInstallmentTiming: 'next_cycle' })
    expect(today.firstDueDate).toBe('2026-01-31')
    expect(later.firstDueDate).toBe('2026-02-28')
    expect(later.installments.map(i => i.dueDate)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30'])
    expect(later.financedTotal).toBe(today.financedTotal)
    expect(later.installments.reduce((sum, i) => sum + i.amount, 0)).toBe(later.financedTotal)
    expect(later.lastInstallmentAmount).not.toBe(later.installmentAmount)
  })
  it('mantiene una fecha explicita de un flujo anterior', () => {
    const date = new Date(2026, 6, 10, 12)
    expect(buildCreditInstallmentPlan({ principalAmount: 100, firstDueDate: date, firstInstallmentTiming: 'next_cycle' }).installments[0].dueDate).toEqual(date)
  })
  it('el comprobante usa el calendario confirmado por la base, no uno recalculado', () => {
    const preview = buildPosCreditSummary(100000, { count: 3, frequency: 'monthly', interestRate: 0, startDate: '2026-01-31' })
    const persisted = withPersistedCreditSchedule(preview, { firstInstallmentTiming: 'next_cycle', installments: [{ number: 1, dueDate: '2026-02-28', amount: 33333 }, { number: 2, dueDate: '2026-03-31', amount: 33333 }, { number: 3, dueDate: '2026-04-30', amount: 33334 }] })
    expect(persisted.firstDueDate).toBe('2026-02-28')
    expect(persisted.lastInstallmentAmount).toBe(33334)
    expect(persisted.firstInstallmentTiming).toBe('next_cycle')
  })
})
