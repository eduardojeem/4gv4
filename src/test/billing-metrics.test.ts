import { describe, expect, it } from 'vitest'
import { computeBillingMetrics } from '@/lib/superadmin/billing-metrics'

const NOW = new Date('2026-11-01T12:00:00Z').getTime()
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString()
const prices = { BASIC: 100000, PRO: 200000 }

describe('computeBillingMetrics', () => {
  it('el MRR usa lo cobrado (con descuento) y marca lo que factura sin cobro', () => {
    const metrics = computeBillingMetrics(
      [
        { organization_id: 'a', plan: 'PRO', status: 'active', payment_status: 'paid' },
        { organization_id: 'b', plan: 'BASIC', status: 'active', payment_status: 'manual' },
        { organization_id: 'c', plan: 'FREE', status: 'active', payment_status: 'manual' },
      ],
      [{ organization_id: 'a', amount: 160000, status: 'paid', paid_at: daysAgo(5) }],
      prices,
      NOW,
    )

    expect(metrics.mrr).toBe(260000)
    expect(metrics.billingSubscriptions).toBe(2)
    expect(metrics.uncollectedSubscriptions).toBe(1)
    expect(metrics.mrrByPlan).toEqual({ PRO: 160000, BASIC: 100000 })
  })

  it('cuenta como baja a quien pagó el mes pasado y hoy está en Gratuito', () => {
    const metrics = computeBillingMetrics(
      [
        { organization_id: 'se-fue', plan: 'FREE', status: 'active', payment_status: 'unpaid' },
        { organization_id: 'renovo', plan: 'PRO', status: 'active', payment_status: 'paid' },
      ],
      [
        { organization_id: 'se-fue', amount: 100000, status: 'paid', paid_at: daysAgo(40) },
        { organization_id: 'renovo', amount: 200000, status: 'paid', paid_at: daysAgo(45) },
        { organization_id: 'renovo', amount: 200000, status: 'paid', paid_at: daysAgo(10) },
      ],
      prices,
      NOW,
    )

    expect(metrics.churnedOrganizations).toBe(1)
    expect(metrics.churnedMrr).toBe(100000)
    expect(metrics.churnRate).toBe(50)
  })

  it('no cuenta en el MRR un período pago que ya venció', () => {
    const metrics = computeBillingMetrics(
      [
        { organization_id: 'vencida', plan: 'PRO', status: 'active', payment_status: 'paid', current_period_ends_at: daysAgo(2) },
        { organization_id: 'vigente', plan: 'BASIC', status: 'active', payment_status: 'paid', current_period_ends_at: new Date(NOW + 86_400_000).toISOString() },
      ],
      [],
      prices,
      NOW,
    )

    expect(metrics.mrr).toBe(100000)
    expect(metrics.billingSubscriptions).toBe(1)
  })
})
