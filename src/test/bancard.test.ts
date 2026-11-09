import { createHash } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BancardError,
  chargeBancardCard,
  createBancardSingleBuy,
  formatBancardAmount,
  getBancardAmountInPyg,
  getBancardCheckoutScriptUrl,
  getBancardConfirmToken,
  getBancardConfirmation,
  isBancardConfirmationApproved,
  isValidBancardShopProcessId,
  listBancardCards,
  pickBancardCard,
  queryBancardPayment,
  rollbackBancardPayment,
  validateBancardConfirmToken,
} from '@/lib/payments/bancard'

const md5 = (value: string) => createHash('md5').update(value).digest('hex')
const PUBLIC_KEY = 'public-test-key'
const PRIVATE_KEY = 'private-test-key'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.stubEnv('BANCARD_PUBLIC_KEY', PUBLIC_KEY)
  vi.stubEnv('BANCARD_PRIVATE_KEY', PRIVATE_KEY)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('formato y validaciones', () => {
  it('formatea montos con dos decimales', () => {
    expect(formatBancardAmount(150000)).toBe('150000.00')
    expect(formatBancardAmount(99.5)).toBe('99.50')
  })

  it('convierte USD solo con tipo de cambio configurado', () => {
    expect(getBancardAmountInPyg(150000.4, 'PYG')).toBe(150000)
    expect(() => getBancardAmountInPyg(10, 'USD')).toThrow(/no está configurada/)
    vi.stubEnv('BANCARD_USD_TO_PYG', '7300')
    expect(getBancardAmountInPyg(10, 'USD')).toBe(73000)
  })

  it('valida el shop_process_id', () => {
    expect(isValidBancardShopProcessId('100001')).toBe(true)
    expect(isValidBancardShopProcessId('abc')).toBe(false)
    expect(isValidBancardShopProcessId('1'.repeat(16))).toBe(false)
  })

  it('usa el ambiente de pruebas salvo que se pida producción', () => {
    expect(getBancardCheckoutScriptUrl()).toContain('https://vpos.infonet.com.py:8888/')
    vi.stubEnv('BANCARD_ENVIRONMENT', 'production')
    expect(getBancardCheckoutScriptUrl()).toBe('https://vpos.infonet.com.py/checkout/javascript/dist/bancard-checkout-4.0.0.js')
  })

  it('aprueba solo response S con código 00', () => {
    expect(isBancardConfirmationApproved({ response: 'S', responseCode: '00' })).toBe(true)
    expect(isBancardConfirmationApproved({ response: 'N', responseCode: '05' })).toBe(false)
    expect(isBancardConfirmationApproved({ response: 'S', responseCode: '12' })).toBe(false)
  })
})

describe('single_buy', () => {
  it('firma la operación con md5(privada + id + monto + moneda)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'success', process_id: 'i5fn*lx6niQel0QzWK1g' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createBancardSingleBuy({
      shopProcessId: '100001',
      amountPyg: 150000,
      description: 'Plan Profesional mensual',
      returnUrl: 'https://app.test/admin/subscriptions/payments?ref=100001',
      cancelUrl: 'https://app.test/admin/subscriptions/payments?ref=100001',
    })

    expect(result.processId).toBe('i5fn*lx6niQel0QzWK1g')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://vpos.infonet.com.py:8888/vpos/api/0.3/single_buy')
    const body = JSON.parse(init.body)
    expect(body.public_key).toBe(PUBLIC_KEY)
    expect(body.operation).toMatchObject({
      token: md5(`${PRIVATE_KEY}100001150000.00PYG`),
      shop_process_id: 100001,
      amount: '150000.00',
      currency: 'PYG',
    })
    expect(body.operation.description.length).toBeLessThanOrEqual(20)
  })

  it('propaga el rechazo de Bancard como error rechazado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      status: 'error',
      messages: [{ key: 'InvalidPublicKeyError', level: 'error', dsc: 'Clave pública inválida.' }],
    }, 401)))

    const error = await createBancardSingleBuy({
      shopProcessId: '100001', amountPyg: 1000, description: 'x', returnUrl: 'https://a.test', cancelUrl: 'https://a.test',
    }).catch((caught) => caught)

    expect(error).toBeInstanceOf(BancardError)
    expect(error).toMatchObject({ rejected: true, key: 'InvalidPublicKeyError', message: 'Clave pública inválida.' })
  })

  it('un timeout o error de red no es un rechazo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    const error = await createBancardSingleBuy({
      shopProcessId: '100001', amountPyg: 1000, description: 'x', returnUrl: 'https://a.test', cancelUrl: 'https://a.test',
    }).catch((caught) => caught)
    expect(error).toMatchObject({ rejected: false })
  })
})

describe('confirmación', () => {
  it('valida el token del webhook', () => {
    const token = getBancardConfirmToken(PRIVATE_KEY, '100001', '150000.00', 'PYG')
    expect(token).toBe(md5(`${PRIVATE_KEY}100001confirm150000.00PYG`))
    expect(validateBancardConfirmToken({ shopProcessId: '100001', amount: '150000.00', currency: 'PYG', token })).toBe(true)
    expect(validateBancardConfirmToken({ shopProcessId: '100001', amount: '1.00', currency: 'PYG', token })).toBe(false)
  })

  it('get_confirmation devuelve null mientras el pago no existe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      status: 'error',
      messages: [{ key: 'PaymentNotFoundError', level: 'error', dsc: 'Pago no encontrado' }],
    })))
    await expect(getBancardConfirmation('100001')).resolves.toBeNull()
  })

  it('queryBancardPayment: aprobado, pendiente y abandonado', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      status: 'success',
      confirmation: {
        token: 'x', shop_process_id: 100001, response: 'S', response_code: '00', amount: '150000.00',
        currency: 'PYG', authorization_number: '123456', ticket_number: '987', response_description: 'Transacción aprobada',
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(queryBancardPayment('100001')).resolves.toMatchObject({
      status: 'approved', amount: 150000, authorizationNumber: '123456',
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.operation.token).toBe(md5(`${PRIVATE_KEY}100001get_confirmation`))

    const notFound = () => jsonResponse({ status: 'error', messages: [{ key: 'PaymentNotFoundError' }] })
    fetchMock.mockResolvedValueOnce(notFound()).mockResolvedValueOnce(notFound())
    const now = new Date('2026-11-07T12:00:00Z')
    // A los 10 minutos sigue pendiente; pasada la media hora sin pago se da por abandonado.
    await expect(queryBancardPayment('100001', '2026-11-07T11:50:00Z', now)).resolves.toMatchObject({ status: 'pending' })
    await expect(queryBancardPayment('100001', '2026-11-07T11:00:00Z', now)).resolves.toMatchObject({ status: 'cancelled' })
  })

  it('un pago rechazado por la tarjeta queda rechazado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      status: 'success',
      confirmation: { shop_process_id: '100001', response: 'N', response_code: '05', amount: '150000.00', currency: 'PYG', response_description: 'No autorizado' },
    })))
    await expect(queryBancardPayment('100001')).resolves.toMatchObject({ status: 'rejected', message: 'No autorizado' })
  })
})

describe('tarjetas guardadas', () => {
  it('lista las tarjetas del usuario con el token oficial', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      status: 'success',
      cards: [
        { alias_token: 'tok-1', card_masked_number: '541863******2272', card_brand: 'Mastercard', card_id: 1, card_type: 'credit', expiration_date: '08/28' },
        { alias_token: 'tok-2', card_masked_number: '411111******1111', card_brand: 'Visa', card_id: 7, card_type: 'debit', expiration_date: '01/29' },
      ],
    }))
    vi.stubGlobal('fetch', fetchMock)

    const cards = await listBancardCards(42)

    expect(fetchMock.mock.calls[0][0]).toBe('https://vpos.infonet.com.py:8888/vpos/api/0.3/users/42/cards')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).operation.token).toBe(md5(`${PRIVATE_KEY}42request_user_cards`))
    expect(pickBancardCard(cards)?.aliasToken).toBe('tok-2')
    expect(pickBancardCard(cards, '541863******2272')?.aliasToken).toBe('tok-1')
  })

  it('debita con charge y devuelve la confirmación (viene en «operation»)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      operation: { process_id: null, shop_process_id: '100002', response: 'S', response_code: '00', amount: 150000, currency: 'PYG', authorization_number: '654321' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const charge = await chargeBancardCard({ shopProcessId: '100002', amountPyg: 150000, aliasToken: 'tok-2', description: 'Plan Pro', returnUrl: 'https://tienda.test/admin/subscriptions/autopay' })

    expect(charge.kind).toBe('result')
    expect(charge.kind === 'result' && isBancardConfirmationApproved(charge.confirmation)).toBe(true)
    const operation = JSON.parse(fetchMock.mock.calls[0][1].body).operation
    expect(operation.token).toBe(md5(`${PRIVATE_KEY}100002charge150000.00PYGtok-2`))
    // El manual pide enviar siempre estos dos campos.
    expect(operation.extra_response_attributes).toEqual(['confirmation.process_id'])
    expect(operation.return_url).toBe('https://tienda.test/admin/subscriptions/autopay')
  })

  it('charge detecta el flujo 3D Secure: datos vacíos y un process_id para el iframe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      operation: { token: null, process_id: 'i5fn*lx6niQel0QzWK1g', shop_process_id: null, response: null, response_code: null, amount: null },
    })))

    const charge = await chargeBancardCard({ shopProcessId: '100003', amountPyg: 150000, aliasToken: 'tok-2', description: 'Plan Pro', returnUrl: 'https://tienda.test/x' })

    expect(charge).toEqual({ kind: 'requires_3ds', processId: 'i5fn*lx6niQel0QzWK1g' })
  })

  it('rollback: PaymentNotFoundError es correcto y un cobro ya cuponado pide anular desde el portal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'error', messages: [{ key: 'PaymentNotFoundError', level: 'error', dsc: 'Payment not found' }] })))
    await expect(rollbackBancardPayment('100004')).resolves.toBe('not_paid')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'success', messages: [{ key: 'RollbackSuccessful', level: 'info', dsc: 'Rollback correcto.' }] })))
    await expect(rollbackBancardPayment('100004')).resolves.toBe('rolled_back')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'error', messages: [{ key: 'TransactionAlreadyConfirmed', level: 'error', dsc: 'Cuponada' }] })))
    await expect(rollbackBancardPayment('100004')).rejects.toThrow(/portal de comercios/)
  })
})
