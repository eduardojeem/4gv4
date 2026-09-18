import { describe, expect, it } from 'vitest'
import {
  benefitSummary,
  buildPromoApplication,
  codeStatus,
  normalizePromoCode,
  promoCodeCreateSchema,
  promoCodeUpdateSchema,
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

  it('validates promo code updates correctly', () => {
    const valid = promoCodeUpdateSchema.safeParse({
      name: 'Nuevo Nombre Campaña',
      description: 'Notas de actualización',
      maxRedemptions: 50,
      expiresAt: '2026-12-31T23:59:59.000Z',
      isActive: false,
    })

    expect(valid.success).toBe(true)
    if (valid.success) {
      expect(valid.data.name).toBe('Nuevo Nombre Campaña')
      expect(valid.data.maxRedemptions).toBe(50)
      expect(valid.data.isActive).toBe(false)
    }

    const invalid = promoCodeUpdateSchema.safeParse({
      name: 'ab', // too short (< 3)
      maxRedemptions: -5,
    })
    expect(invalid.success).toBe(false)
  })

  it('classifies promo code statuses accurately', () => {
    const basePromo = {
      id: 'test-1',
      code: 'VERANO-2026',
      name: 'Promo Verano',
      description: null,
      benefit_type: 'discount_percent',
      discount_percent: 30,
      discount_amount: null,
      target_plan: null,
      duration_days: null,
      duration_unit: 'days',
      max_redemptions: 10,
      starts_at: null,
      expires_at: null,
      is_active: true,
      created_at: new Date().toISOString(),
      redemption_count: 3,
    }

    expect(codeStatus(basePromo).label).toBe('Vigente')
    expect(codeStatus({ ...basePromo, is_active: false }).label).toBe('Inactivo')
    expect(codeStatus({ ...basePromo, redemption_count: 10 }).label).toBe('Agotado')
    expect(codeStatus({ ...basePromo, expires_at: '2020-01-01T00:00:00.000Z' }).label).toBe('Vencido')

    expect(benefitSummary(basePromo)).toBe('30% de descuento')
    expect(
      benefitSummary({
        benefit_type: 'activate_plan',
        target_plan: 'PRO',
        duration_days: 3,
        duration_unit: 'months',
      })
    ).toBe('Plan PRO por 3 mes(es)')
  })
})
