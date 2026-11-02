import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  billingMissingFields,
  isFreePlan,
  normalizeSubscription,
  redemptionText,
  subscriptionStatus,
  visibleQuotas,
} from '../../mobile/src/lib/subscription-model'

const read = (path: string) => readFileSync(join(__dirname, '../../mobile/src', path), 'utf8')

/** Respuesta real de /api/admin/subscriptions (getCurrentOrganizationSubscription). */
const RESPONSE = {
  subscription: { id: 's', plan: 'BASIC', status: 'manual', trial_ends_at: null, current_period_starts_at: null, current_period_ends_at: '2026-12-01T00:00:00Z', cancel_at_period_end: false },
  currentPlan: {
    code: 'BASIC', name: 'Básico', price_monthly: 150000,
    limits: { users: 10, branches: 2, cashRegisters: 3, products: 500, repairs: 150, services: null },
    modules: ['pos', 'repairs'],
  },
  plans: [],
  usage: { users: 4, branches: 1, cashRegisters: 2, products: 480, categories: 3, repairs: 12, services: 0 },
  billingProfile: { business_name: 'Mi Tienda', ruc: '80012345-6', billing_email: 'a@b.py', fiscal_address: '', phone: null },
  payments: [{ id: 'p1', amount: 150000, currency: 'PYG', status: 'paid', payment_method: 'card', provider: 'pagopar', receipt_url: null, paid_at: '2026-11-01T00:00:00Z', created_at: null }],
  promoRedemptions: [{ id: 'r1', redeemed_at: '2026-10-01T00:00:00Z', benefit_snapshot: { benefit_type: 'discount_percent', discount_percent: 20 } }],
}

describe('suscripción en la app', () => {
  it('lee el plan de currentPlan y las cajas de cashRegisters, como manda el servidor', () => {
    const details = normalizeSubscription(RESPONSE)
    expect(details.plan).toMatchObject({ name: 'Básico', price_monthly: 150000 })
    expect(details.plan?.limits.cashRegisters).toBe(3)
    expect(details.usage.cashRegisters).toBe(2)
    expect(details.payments).toHaveLength(1)
  })

  it('muestra Reparaciones solo si el plan la incluye, con su límite real', () => {
    const quotas = visibleQuotas(normalizeSubscription(RESPONSE))
    expect(quotas.map((q) => q.key)).toEqual(['branches', 'users', 'cashRegisters', 'products', 'repairs'])
    expect(quotas.find((q) => q.key === 'products')).toMatchObject({ current: 480, max: 500 })
  })

  it('un plan manual no se pinta como deuda y el gratis no se renueva', () => {
    expect(subscriptionStatus('manual')).toEqual({ label: 'Activo (asignado)', tone: 'success' })
    expect(subscriptionStatus('past_due').tone).toBe('danger')
    expect(isFreePlan({ code: 'FREE', name: 'Gratis', price_monthly: 0, limits: {}, modules: [] })).toBe(true)
    expect(isFreePlan(normalizeSubscription(RESPONSE).plan)).toBe(false)
  })

  it('cupones y datos de facturación faltantes', () => {
    expect(redemptionText({ benefit_type: 'discount_percent', discount_percent: 20 }, String)).toBe('Descuento de 20%')
    expect(billingMissingFields(RESPONSE.billingProfile)).toEqual(['Teléfono', 'Dirección fiscal'])
  })

  it('en el celular no se compra: pagar, cambiar de plan y transferir quedan para la web', () => {
    const screen = read('app/admin/subscriptions.tsx')
    expect(screen).toContain("const PURCHASES_IN_APP = Platform.OS === 'web'")
    expect(screen).toMatch(/PURCHASES_IN_APP \? \(\s*<>[\s\S]*SubscriptionTransferCard[\s\S]*\) : \(/)
  })
})
