import { afterEach, describe, expect, it, vi } from 'vitest'
import { isStripeCheckoutEnabled, isStripeConfigured } from '@/lib/payments/stripe'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isStripeCheckoutEnabled', () => {
  it('con las claves cargadas Stripe sigue apagado como forma de pago', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_x')
    vi.stubEnv('STRIPE_SUBSCRIPTIONS_ENABLED', '')

    expect(isStripeConfigured()).toBe(true)
    expect(isStripeCheckoutEnabled()).toBe(false)
  })

  it('se enciende solo con el interruptor y las claves', () => {
    vi.stubEnv('STRIPE_SUBSCRIPTIONS_ENABLED', 'true')
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
    expect(isStripeCheckoutEnabled()).toBe(false)

    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x')
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_x')
    expect(isStripeCheckoutEnabled()).toBe(true)
  })
})
