import { describe, expect, it } from 'vitest'
import {
  buildPromoApplication,
  normalizePromoCode,
  promoCodeCreateSchema,
} from '@/lib/superadmin/promo-codes'

describe('superadmin promo codes', () => {
  it('normalizes codes for reliable lookup', () => {
    expect(normalizePromoCode(' verano 2026 ')).toBe('VERANO-2026')
  })

  it('requires the benefit-specific configuration', () => {
    const result = promoCodeCreateSchema.safeParse({
      code: 'PLAN-PRO',
      name: 'Activar Pro',
      benefitType: 'activate_plan',
    })

    expect(result.success).toBe(false)
  })

  it('extends an existing future period instead of replacing it', () => {
    const result = buildPromoApplication(
      { benefit_type: 'extend_period', duration_days: 30 },
      { current_period_ends_at: '2026-07-01T00:00:00.000Z' },
      new Date('2026-06-13T00:00:00.000Z')
    )

    expect(result.subscriptionPatch).toEqual({
      status: 'active',
      payment_status: 'paid',
      current_period_ends_at: '2026-07-31T00:00:00.000Z',
      cancel_at_period_end: false,
    })
  })

  it('activates the target plan and synchronizes its period', () => {
    const result = buildPromoApplication(
      { benefit_type: 'activate_plan', target_plan: 'PRO', duration_days: 60 },
      { current_period_ends_at: null },
      new Date('2026-06-13T00:00:00.000Z')
    )

    expect(result.subscriptionPatch).toMatchObject({
      plan: 'PRO',
      status: 'active',
      current_period_starts_at: '2026-06-13T00:00:00.000Z',
      current_period_ends_at: '2026-08-12T00:00:00.000Z',
    })
  })

  it('records discounts without mutating subscription dates or plan', () => {
    const result = buildPromoApplication(
      { benefit_type: 'discount_percent', discount_percent: 25 },
      { plan: 'BASIC', status: 'active' },
      new Date('2026-06-13T00:00:00.000Z')
    )

    expect(result.subscriptionPatch).toEqual({})
    expect(result.requiresBillingAction).toBe(true)
  })
})
