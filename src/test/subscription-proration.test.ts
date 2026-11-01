import { describe, expect, it } from 'vitest'
import { computeProration, prorationForChange } from '@/lib/saas/subscription-proration'

const NOW = new Date('2026-11-16T00:00:00Z').getTime()
const period = { periodStartsAt: '2026-11-01T00:00:00Z', periodEndsAt: '2026-12-01T00:00:00Z' }

describe('prorrateo', () => {
  it('al subir descuenta lo que queda del plan actual', () => {
    // Medio mes sin usar de un plan de 100.000 → crédito 50.000.
    expect(computeProration({ currentPrice: 100000, targetPrice: 200000, ...period, now: NOW })).toEqual({
      credit: 50000, chargeAmount: 150000, extraDays: 0, kind: 'upgrade',
    })
  })

  it('al bajar convierte el crédito en días extra del plan nuevo', () => {
    // Crédito 100.000 de un plan de 200.000 sobre uno de 100.000 → 30 días.
    expect(computeProration({ currentPrice: 200000, targetPrice: 100000, ...period, now: NOW })).toEqual({
      credit: 100000, chargeAmount: 100000, extraDays: 30, kind: 'downgrade',
    })
  })

  it('no prorratea sin período vigente, desde Gratuito o hacia el mismo plan', () => {
    expect(computeProration({ currentPrice: 100000, targetPrice: 200000, periodStartsAt: null, periodEndsAt: null, now: NOW })).toBeNull()
    expect(computeProration({ currentPrice: 0, targetPrice: 200000, ...period, now: NOW })).toBeNull()
    expect(computeProration({ currentPrice: 100000, targetPrice: 200000, periodStartsAt: '2026-10-01T00:00:00Z', periodEndsAt: '2026-11-01T00:00:00Z', now: NOW })).toBeNull()
    expect(prorationForChange({
      currentPlanCode: 'PRO', currentPrice: 100000, targetPlanCode: 'PRO', targetPrice: 100000,
      subscription: { status: 'active', current_period_starts_at: period.periodStartsAt, current_period_ends_at: period.periodEndsAt }, now: NOW,
    })).toBeNull()
  })

  it('una prueba gratis o un pago pendiente no generan crédito', () => {
    expect(prorationForChange({
      currentPlanCode: 'BASIC', currentPrice: 100000, targetPlanCode: 'PRO', targetPrice: 200000,
      subscription: { status: 'trialing', current_period_starts_at: period.periodStartsAt, current_period_ends_at: period.periodEndsAt }, now: NOW,
    })).toBeNull()
  })
})
