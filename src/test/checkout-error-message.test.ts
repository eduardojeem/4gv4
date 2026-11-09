import { describe, expect, it } from 'vitest'
import { getCheckoutErrorMessage } from '@/components/admin/subscriptions/SubscriptionPaymentPanel'

describe('getCheckoutErrorMessage', () => {
  it('keeps a safe backend message', () => {
    expect(getCheckoutErrorMessage(
      { error: 'Bancard rechazó el pago: Fondos insuficientes.' },
      '11111111-1111-4111-8111-111111111111',
    )).toBe('Bancard rechazó el pago: Fondos insuficientes.')
  })

  it('uses the request correlation id for an unexpected response', () => {
    expect(getCheckoutErrorMessage(
      null,
      '11111111-1111-4111-8111-111111111111',
    )).toBe('No se pudo iniciar el pago. Código: 11111111-1111-4111-8111-111111111111')
  })
})
