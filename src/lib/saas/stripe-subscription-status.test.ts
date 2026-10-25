import { describe, expect, it } from 'vitest'
import {
  fromStripeUnitAmount,
  isValidStripeCheckoutSessionId,
  toStripeUnitAmount,
} from '@/lib/payments/stripe'
import { getStripeSessionDisplayStatus } from '@/lib/saas/stripe-subscription-status'

describe('Stripe subscription helpers', () => {
  it('treats PYG as a zero-decimal currency and USD in cents', () => {
    expect(toStripeUnitAmount(150000, 'PYG')).toBe(150000)
    expect(fromStripeUnitAmount(150000, 'pyg')).toBe(150000)
    expect(toStripeUnitAmount(19.99, 'USD')).toBe(1999)
    expect(fromStripeUnitAmount(1999, 'usd')).toBe(19.99)
    expect(() => toStripeUnitAmount(10, 'EUR')).toThrow()
  })

  it('only accepts Checkout session ids', () => {
    expect(isValidStripeCheckoutSessionId('cs_test_a1B2c3D4e5F6g7H8')).toBe(true)
    expect(isValidStripeCheckoutSessionId('cs_live_a1B2c3D4e5F6g7H8')).toBe(true)
    expect(isValidStripeCheckoutSessionId('pi_123')).toBe(false)
    expect(isValidStripeCheckoutSessionId('cs_test_<script>')).toBe(false)
    expect(isValidStripeCheckoutSessionId(undefined)).toBe(false)
  })

  it('maps the session to a display status', () => {
    expect(getStripeSessionDisplayStatus({ status: 'complete', payment_status: 'paid' })).toBe('approved')
    expect(getStripeSessionDisplayStatus({ status: 'complete', payment_status: 'unpaid' })).toBe('pending')
    expect(getStripeSessionDisplayStatus({ status: 'open', payment_status: 'unpaid' })).toBe('pending')
    expect(getStripeSessionDisplayStatus({ status: 'expired', payment_status: 'unpaid' })).toBe('expired')
  })
})

describe('getBrowserRequestOrigin', () => {
  it('uses the Host header instead of the bind address', async () => {
    const { getBrowserRequestOrigin } = await import('@/lib/payments/stripe')
    const request = new Request('http://0.0.0.0:3000/api/x', { headers: { host: 'localhost:3000' } })
    expect(getBrowserRequestOrigin(request)).toBe('http://localhost:3000')
  })

  it('honours proxy headers', async () => {
    const { getBrowserRequestOrigin } = await import('@/lib/payments/stripe')
    const request = new Request('http://10.0.0.5/api/x', {
      headers: { host: '10.0.0.5', 'x-forwarded-host': 'www.mitiendapy.com', 'x-forwarded-proto': 'https' },
    })
    expect(getBrowserRequestOrigin(request)).toBe('https://www.mitiendapy.com')
  })
})
