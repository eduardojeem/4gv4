import { createHash } from 'crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getPagoparCheckoutUrl,
  getPagoparOrderDisplayStatus,
  getPagoparPaymentMethodId,
  isValidPagoparOrderHash,
  parsePagoparNotificationAmount,
  parsePagoparPaymentMethod,
  queryPagoparOrder,
} from '@/lib/payments/pagopar'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

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

describe('Pagopar order status query', () => {
  const orderHash = 'a'.repeat(64)

  it('accepts only reasonable alphanumeric order hashes', () => {
    expect(isValidPagoparOrderHash(orderHash)).toBe(true)
    expect(isValidPagoparOrderHash('short')).toBe(false)
    expect(isValidPagoparOrderHash(`${'a'.repeat(63)}/`)).toBe(false)
  })

  it('queries Pagopar server-side with the official CONSULTA token', async () => {
    vi.stubEnv('PAGOPAR_PUBLIC_KEY', 'public-test-key')
    vi.stubEnv('PAGOPAR_PRIVATE_KEY', 'private-test-key')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      respuesta: true,
      resultado: [{
        pagado: true,
        cancelado: false,
        monto: '150.000',
        hash_pedido: orderHash,
        numero_pedido: '12345',
        forma_pago: 'Tarjeta',
        fecha_pago: '2026-08-30 12:00:00',
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await queryPagoparOrder(orderHash)
    const expectedToken = createHash('sha1').update('private-test-keyCONSULTA').digest('hex')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.pagopar.com/api/pedidos/1.1/traer',
      expect.objectContaining({ method: 'POST', cache: 'no-store' }),
    )
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toEqual({
      hash_pedido: orderHash,
      token: expectedToken,
      token_publico: 'public-test-key',
    })
    expect(result).toMatchObject({
      hash: orderHash,
      amount: 150_000,
      providerOrderId: '12345',
      status: 'approved',
    })
  })

  it('rejects a response associated with a different order hash', async () => {
    vi.stubEnv('PAGOPAR_PUBLIC_KEY', 'public-test-key')
    vi.stubEnv('PAGOPAR_PRIVATE_KEY', 'private-test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      respuesta: true,
      resultado: [{
        pagado: true,
        cancelado: false,
        monto: 150000,
        hash_pedido: 'b'.repeat(64),
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    await expect(queryPagoparOrder(orderHash)).rejects.toThrow('respuesta no corresponde al pedido solicitado')
  })

  it('normalizes the supported payment states for the result page', () => {
    expect(getPagoparOrderDisplayStatus({ pagado: true, cancelado: false })).toBe('approved')
    expect(getPagoparOrderDisplayStatus({ pagado: false, cancelado: true })).toBe('cancelled')
    expect(getPagoparOrderDisplayStatus({ pagado: false, cancelado: false, ultimo_mensaje_error: 'Rechazado' })).toBe('rejected')
    expect(getPagoparOrderDisplayStatus({ pagado: false, cancelado: false, mensaje_resultado_pago: { titulo: 'Pedido pendiente de pago' } })).toBe('pending')
    expect(getPagoparOrderDisplayStatus({ pagado: false, cancelado: false })).toBe('processing')
  })
})
