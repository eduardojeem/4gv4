import { describe, expect, it } from 'vitest'

import {
  isValidCreditInterestRate,
  MAX_CREDIT_INSTALLMENTS,
  MAX_CREDIT_INTEREST_RATE,
  minimumCreditPrincipal,
  roundToCurrencyUnit,
} from './installments'
import { getProductCreditPlans } from '@/app/dashboard/pos/lib/product-credit'
import { productSchema } from '@/lib/validations/product-schema'
import { CreditPlanDefaultSchema } from '@/lib/validation/website-settings'

describe('topes de crédito compartidos', () => {
  it('coinciden con los del servidor (0–100 %, 1–60 cuotas)', () => {
    expect(MAX_CREDIT_INTEREST_RATE).toBe(100)
    expect(MAX_CREDIT_INSTALLMENTS).toBe(60)
    expect(isValidCreditInterestRate(0)).toBe(true)
    expect(isValidCreditInterestRate(100)).toBe(true)
    expect(isValidCreditInterestRate(100.01)).toBe(false)
    expect(isValidCreditInterestRate(-1)).toBe(false)
    expect(isValidCreditInterestRate(Number.NaN)).toBe(false)
  })

  it('el POS descarta planes que el servidor rechazaría', () => {
    const plans = getProductCreditPlans({
      installments_enabled: true,
      installments_plans: [{ count: 6, rate: 100 }, { count: 12, rate: 150 }],
    }, 1_000_000)
    expect(plans.map(plan => plan.count)).toEqual([6])
  })

  it('los formularios no dejan guardar recargos por encima del tope', () => {
    expect(CreditPlanDefaultSchema.safeParse({ count: 12, rate: 101 }).success).toBe(false)
    expect(CreditPlanDefaultSchema.safeParse({ count: 12, rate: 100 }).success).toBe(true)
    const plans = productSchema.shape.installments_plans
    expect(plans.safeParse([{ count: 12, rate: 101 }]).success).toBe(false)
    expect(plans.safeParse([{ count: 12, rate: 100 }]).success).toBe(true)
  })
})

describe('unidad de la moneda', () => {
  it('redondea a guaraníes enteros', () => {
    expect(roundToCurrencyUnit(33_333.33, 0)).toBe(33_333)
    expect(roundToCurrencyUnit(66_666.67, 0)).toBe(66_667)
    expect(roundToCurrencyUnit(10.005, 2)).toBeCloseTo(10.01, 2)
  })

  it('exige al menos una unidad por cuota', () => {
    expect(minimumCreditPrincipal(12, 0)).toBe(12)
    expect(minimumCreditPrincipal(12, 2)).toBe(0.12)
  })
})
