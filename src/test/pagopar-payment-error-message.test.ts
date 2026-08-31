import { describe, expect, it } from 'vitest'
import { getPagoparCheckoutErrorMessage } from '@/components/admin/subscriptions/PagoparPaymentButton'

describe('getPagoparCheckoutErrorMessage', () => {
  it('keeps a safe backend message', () => {
    expect(getPagoparCheckoutErrorMessage(
      { error: 'Pagopar rechazó la transacción.' },
      '11111111-1111-4111-8111-111111111111',
    )).toBe('Pagopar rechazó la transacción.')
  })

  it('uses the request correlation id for an unexpected response', () => {
    expect(getPagoparCheckoutErrorMessage(
      null,
      '11111111-1111-4111-8111-111111111111',
    )).toBe('No se pudo iniciar el pago. Código: 11111111-1111-4111-8111-111111111111')
  })
})
