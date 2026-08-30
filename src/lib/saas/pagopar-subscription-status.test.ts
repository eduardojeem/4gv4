import { describe, expect, it } from 'vitest'

import { comparePagoparOrderWithLocalPayment } from './pagopar-subscription-status'

const localPayment = {
  id: 'payment-1',
  amount: 150_000,
  currency: 'PYG',
  status: 'pending',
  plan_id: 'PRO',
  provider_payment_id: '12345',
  external_reference: 'a'.repeat(64),
}

const providerOrder = {
  hash: 'a'.repeat(64),
  amount: 150_000,
  providerOrderId: '12345',
  paymentMethod: 'Tarjeta',
  paidAt: '2026-08-30 12:00:00',
  maximumPaymentDate: null,
  message: null,
  status: 'approved' as const,
}

describe('comparePagoparOrderWithLocalPayment', () => {
  it('accepts a provider order associated with the same local payment', () => {
    expect(comparePagoparOrderWithLocalPayment(localPayment, providerOrder)).toEqual({ ok: true })
  })

  it('rejects a different amount', () => {
    expect(comparePagoparOrderWithLocalPayment(localPayment, { ...providerOrder, amount: 149_000 })).toEqual({
      ok: false,
      reason: 'amount_mismatch',
    })
  })

  it('rejects a different provider order reference', () => {
    expect(comparePagoparOrderWithLocalPayment(localPayment, { ...providerOrder, providerOrderId: '99999' })).toEqual({
      ok: false,
      reason: 'reference_mismatch',
    })
  })
})
