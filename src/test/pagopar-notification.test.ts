import { createHash } from 'crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getPagoparCheckoutUrl,
  getPagoparOrderDisplayStatus,
  getPagoparPaymentMethodId,
  isValidPagoparOrderHash,
  parsePagoparNotificationAmount,
  parsePagoparPaymentMethod,
  createPagoparOrder,
  PagoparOrderCreationError,
  queryPagoparOrder,
} from '@/lib/payments/pagopar'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
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

describe('Pagopar order creation diagnostics', () => {
  const input = {
    amountPyg: 150_000,
    buyer: {
      businessName: 'Empresa de prueba',
      document: '80012345-6',
      email: 'comprador@example.com',
      name: 'Empresa de prueba',
      phone: '0981123456',
      address: 'Dirección privada',
      ruc: '80012345-6',
    },
    description: 'Suscripción Pro',
    externalReference: 'SUB-TEST-123',
    itemId: 123,
    paymentMethod: 'qr' as const,
    correlationId: '11111111-1111-4111-8111-111111111111',
  }

  function configurePagopar() {
    vi.stubEnv('PAGOPAR_PUBLIC_KEY', 'public-test-key')
    vi.stubEnv('PAGOPAR_PRIVATE_KEY', 'private-test-key')
  }

  it('logs a sanitized HTTP rejection and exposes its correlation id', async () => {
    configurePagopar()
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      respuesta: false,
      resultado: { mensaje: 'Token no coincide', detalle: 'private-test-key' },
    }), { status: 422, headers: { 'Content-Type': 'application/json; charset=utf-8' } })))

    const rejection = await createPagoparOrder(input).catch((error) => error)

    expect(rejection).toBeInstanceOf(PagoparOrderCreationError)
    expect(rejection.correlationId).toBe(input.correlationId)
    expect(errorLog).toHaveBeenCalledWith('Pagopar order creation failed', expect.objectContaining({
      correlationId: rejection.correlationId,
      event: 'http_error',
      httpStatus: 422,
      contentType: 'application/json; charset=utf-8',
      respuesta: false,
      resultType: 'object',
      resultMessage: 'Token no coincide',
      paymentMethodId: 24,
      amountPyg: 150_000,
      externalReference: 'SUB-TEST-123',
      durationMs: expect.any(Number),
    }))
    const serializedLog = JSON.stringify(errorLog.mock.calls)
    expect(serializedLog).not.toContain('private-test-key')
    expect(serializedLog).not.toContain('comprador@example.com')
    expect(serializedLog).not.toContain('80012345')
    expect(serializedLog).not.toContain('0981123456')
    expect(serializedLog).not.toContain('Dirección privada')
  })

  it('classifies HTML and invalid JSON without exposing their body', async () => {
    configurePagopar()
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Internal secret</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    })))

    const rejection = await createPagoparOrder(input).catch((error) => error)

    expect(rejection).toBeInstanceOf(PagoparOrderCreationError)
    expect(errorLog).toHaveBeenCalledWith('Pagopar order creation failed', expect.objectContaining({
      event: 'http_error',
      resultType: 'html',
      resultMessage: 'Respuesta HTML de Pagopar',
    }))
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('Internal secret')
  })

  it('distinguishes network failures', async () => {
    configurePagopar()
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('socket contained private-test-key')))

    const rejection = await createPagoparOrder(input).catch((error) => error)

    expect(rejection).toBeInstanceOf(PagoparOrderCreationError)
    expect(errorLog).toHaveBeenCalledWith('Pagopar order creation failed', expect.objectContaining({
      event: 'network_error',
      httpStatus: null,
      resultType: 'unavailable',
    }))
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('private-test-key')
  })

  it('redacts personal data echoed inside a provider message', async () => {
    configurePagopar()
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      respuesta: false,
      resultado: 'Email comprador@example.com, documento 800123456 y teléfono 0981123456 inválidos',
    }), { status: 400, headers: { 'Content-Type': 'application/json' } })))

    await createPagoparOrder(input).catch(() => undefined)

    const serializedLog = JSON.stringify(errorLog.mock.calls)
    expect(serializedLog).not.toContain('comprador@example.com')
    expect(serializedLog).not.toContain('800123456')
    expect(serializedLog).not.toContain('0981123456')
  })

  it.each([
    ['string', JSON.stringify({ respuesta: false, resultado: 'Operación rechazada' }), 'Operación rechazada'],
    ['array', JSON.stringify({ respuesta: false, resultado: [{ mensaje: 'Dato inválido' }] }), 'Dato inválido'],
    ['empty', '', 'Respuesta vacía de Pagopar'],
    ['invalid_json', '{respuesta:', 'Respuesta JSON inválida de Pagopar'],
  ])('classifies a %s result safely', async (expectedType, responseBody, expectedMessage) => {
    configurePagopar()
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(responseBody, {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })))

    await createPagoparOrder(input).catch(() => undefined)

    expect(errorLog).toHaveBeenCalledWith('Pagopar order creation failed', expect.objectContaining({
      resultType: expectedType,
      resultMessage: expectedMessage,
    }))
  })

  it('distinguishes a request timeout', async () => {
    configurePagopar()
    vi.useFakeTimers()
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn((_url: string, request: RequestInit) => new Promise((_resolve, reject) => {
      request.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))

    const pending = createPagoparOrder(input).catch((error) => error)
    await vi.advanceTimersByTimeAsync(15_000)
    const rejection = await pending

    expect(rejection).toBeInstanceOf(PagoparOrderCreationError)
    expect(errorLog).toHaveBeenCalledWith('Pagopar order creation failed', expect.objectContaining({
      event: 'timeout',
      resultMessage: 'Tiempo de espera agotado',
    }))
  })
})
