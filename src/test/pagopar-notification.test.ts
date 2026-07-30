import { describe, expect, it } from 'vitest'
import {
  getPagoparCheckoutUrl,
  getPagoparPaymentMethodId,
  parsePagoparNotificationAmount,
  parsePagoparPaymentMethod,
} from '@/lib/payments/pagopar'

describe('parsePagoparNotificationAmount', () => {
  it('accepts numeric amounts', () => {
    expect(parsePagoparNotificationAmount(150000)).toBe(150000)
  })

  it('normalizes Paraguayan thousands separators', () => {
    expect(parsePagoparNotificationAmount('150.000')).toBe(150000)
    expect(parsePagoparNotificationAmount('1.250.000')).toBe(1250000)
  })

  it('supports decimal strings without changing their value', () => {
    expect(parsePagoparNotificationAmount('150000.50')).toBe(150000.5)
    expect(parsePagoparNotificationAmount('150.000,50')).toBe(150000.5)
  })

  it('rejects invalid and negative amounts', () => {
    expect(parsePagoparNotificationAmount('invalid')).toBeNull()
    expect(parsePagoparNotificationAmount(-1)).toBeNull()
  })
})

describe('Pagopar payment methods', () => {
  it('maps card and QR to the official Pagopar identifiers', () => {
    expect(getPagoparPaymentMethodId('card')).toBe(9)
    expect(getPagoparPaymentMethodId('qr')).toBe(24)
  })

  it('rejects payment methods outside the supported allowlist', () => {
    expect(parsePagoparPaymentMethod('card')).toBe('card')
    expect(parsePagoparPaymentMethod('qr')).toBe('qr')
    expect(parsePagoparPaymentMethod('24')).toBeNull()
    expect(parsePagoparPaymentMethod('transfer')).toBeNull()
  })

  it('builds a checkout URL that keeps the selected payment method', () => {
    expect(getPagoparCheckoutUrl('pedido-hash', 'qr')).toBe(
      'https://www.pagopar.com/pagos/pedido-hash?forma_pago=24',
    )
  })
})
