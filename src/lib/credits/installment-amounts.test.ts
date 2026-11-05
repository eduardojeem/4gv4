import { describe, expect, it } from 'vitest'

import {
  buildCreditInstallmentPlanFromAmounts,
  fixedInstallmentAmounts,
  impliedInterestRate,
  installmentAmountsError,
} from './installments'
import { buildPosCreditSummary, posCreditSchedulePayload } from './pos-credit-summary'
import {
  creditPlanOptions,
  creditPosPolicyViolation,
  DEFAULT_CREDIT_POS_POLICY,
  normalizeCreditPosPolicy,
} from './pos-credit-policy'

describe('cuotas por monto', () => {
  it('arma 10 cuotas de Gs. 150.000 y deriva el recargo', () => {
    const plan = buildCreditInstallmentPlanFromAmounts({
      principalAmount: 1_200_000,
      amounts: fixedInstallmentAmounts(10, 150_000, 0),
      frequency: 'monthly',
      now: new Date(2026, 0, 31, 12),
      fractionDigits: 0,
    })
    expect(plan.financedTotal).toBe(1_500_000)
    expect(plan.interestAmount).toBe(300_000)
    expect(plan.interestRate).toBe(25)
    expect(plan.installments.every(installment => installment.amount === 150_000)).toBe(true)
    // El recargo y el capital de cada cuota cierran contra los totales.
    expect(plan.installments.reduce((sum, row) => sum + row.interestComponent, 0)).toBe(300_000)
    expect(plan.installments.reduce((sum, row) => sum + row.principalComponent, 0)).toBe(1_200_000)
    expect(plan.installments.every(row => row.principalComponent + row.interestComponent === row.amount)).toBe(true)
    // Mismo calendario que el plan por porcentaje (31/1 → 28/2 → 31/3).
    expect(plan.installments[1].dueDate.getDate()).toBe(28)
    expect(plan.installments[2].dueDate.getDate()).toBe(31)
  })

  it('acepta montos distintos por cuota', () => {
    const plan = buildCreditInstallmentPlanFromAmounts({ principalAmount: 100_000, amounts: [50_000, 30_000, 30_001], fractionDigits: 0 })
    expect(plan.financedTotal).toBe(110_001)
    expect(plan.installments.map(row => row.amount)).toEqual([50_000, 30_000, 30_001])
    expect(plan.installments.every(row => row.interestComponent >= 0 && row.interestComponent <= row.amount)).toBe(true)
  })

  it('rechaza cuotas que no cubren lo financiado, en cero, con decimales o con recargo excesivo', () => {
    expect(installmentAmountsError(100_000, [30_000, 30_000, 30_000], 0)).toContain('no cubren')
    expect(installmentAmountsError(100_000, [100_000, 0], 0)).toContain('mayor a cero')
    expect(installmentAmountsError(100_000, [50_000.5, 50_000], 0)).toContain('entero')
    expect(installmentAmountsError(100_000, [150_000, 60_000], 0)).toContain('100%')
    expect(installmentAmountsError(100_000, [50_000, 50_000], 0)).toBeNull()
  })

  it('calcula el recargo implícito con cuatro decimales', () => {
    expect(impliedInterestRate(300_000, 400_000)).toBe(33.3333)
    expect(impliedInterestRate(0, 10)).toBe(0)
  })

  it('el resumen del POS y el cuerpo de la venta usan los montos', () => {
    const terms = { count: 4, frequency: 'monthly' as const, interestRate: 0, scheduleMode: 'installment_amount' as const, installmentAmount: 30_000, startDate: '2026-11-04' }
    const summary = buildPosCreditSummary(100_000, terms)
    expect(summary.financedTotal).toBe(120_000)
    expect(summary.interestRate).toBe(20)
    expect(posCreditSchedulePayload(terms, 100_000)).toEqual({ schedule_mode: 'installment_amount', installment_amounts: [30_000, 30_000, 30_000, 30_000] })
    expect(posCreditSchedulePayload({ ...terms, scheduleMode: 'percent' }, 100_000)).toEqual({ schedule_mode: 'percent' })
  })
})

describe('política de crédito del POS', () => {
  const terms = { installmentCount: 12, interestRate: 20, frequency: 'monthly' as const, mode: 'percent' as const, downPaymentPercent: 0 }

  it('sin configurar no cambia nada', () => {
    expect(normalizeCreditPosPolicy(undefined)).toEqual(DEFAULT_CREDIT_POS_POLICY)
    expect(creditPosPolicyViolation(DEFAULT_CREDIT_POS_POLICY, terms, [])).toBeNull()
  })

  it('acota valores guardados fuera de rango', () => {
    const policy = normalizeCreditPosPolicy({ maxInterestRate: 500, maxInstallments: 0, allowedFrequencies: ['otro'], minDownPaymentPercent: 99 })
    expect(policy.maxInterestRate).toBe(100)
    expect(policy.maxInstallments).toBe(1)
    expect(policy.allowedFrequencies).toEqual(DEFAULT_CREDIT_POS_POLICY.allowedFrequencies)
    expect(policy.minDownPaymentPercent).toBe(90)
  })

  it('aplica topes, frecuencias, entrega mínima y cuotas por monto', () => {
    const policy = normalizeCreditPosPolicy({ maxInterestRate: 15, maxInstallments: 6, allowedFrequencies: ['monthly'], minDownPaymentPercent: 20, allowInstallmentAmounts: false })
    expect(creditPosPolicyViolation(policy, { ...terms, downPaymentPercent: 10 }, [])).toContain('20%')
    expect(creditPosPolicyViolation(policy, { ...terms, downPaymentPercent: 20 }, [])).toContain('6 cuotas')
    expect(creditPosPolicyViolation(policy, { ...terms, installmentCount: 6, downPaymentPercent: 20 }, [])).toContain('15%')
    expect(creditPosPolicyViolation(policy, { ...terms, installmentCount: 6, interestRate: 10, frequency: 'weekly', downPaymentPercent: 20 }, [])).toContain('semanal')
    expect(creditPosPolicyViolation(policy, { ...terms, installmentCount: 6, interestRate: 10, mode: 'installment_amount', downPaymentPercent: 20 }, [])).toContain('por monto')
    expect(creditPosPolicyViolation(policy, { ...terms, installmentCount: 6, interestRate: 10, downPaymentPercent: 20 }, [])).toBeNull()
  })

  it('sin condiciones libres solo acepta planes configurados', () => {
    const policy = normalizeCreditPosPolicy({ allowCustomTerms: false })
    const plans = creditPlanOptions({
      products: [{ installments_enabled: true, installments_plans: [{ count: 12, rate: 20 }, { count: 6, rate: 500 }] }],
      defaults: { plans: [{ count: 3, rate: 0 }], frequency: 'biweekly' },
    })
    expect(plans).toEqual([
      { count: 3, rate: 0, frequency: 'biweekly' },
      { count: 12, rate: 20, frequency: 'monthly' },
    ])
    expect(creditPosPolicyViolation(policy, terms, plans)).toBeNull()
    expect(creditPosPolicyViolation(policy, { ...terms, interestRate: 0 }, plans)).toContain('planes')
    expect(creditPosPolicyViolation(policy, { ...terms, mode: 'custom' }, plans)).toContain('planes configurados')
  })
})
