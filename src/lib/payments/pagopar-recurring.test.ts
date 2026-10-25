import { createHash } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getPagoparRecurringToken,
  getUpayCardFormUrl,
  isPagoparRecurringEnabled,
  listPagoparCards,
  parsePagoparCards,
  payPagoparOrderWithCard,
  pickPagoparCard,
  PagoparRecurringError,
  startPagoparCardForm,
} from '@/lib/payments/pagopar-recurring'

const CARD = {
  tarjeta: '3',
  tarjeta_numero: '541863******4424',
  marca: 'Mastercard',
  emisor: 'UENO HOLDING S.A.E.C.A.',
  alias_token: 'faf3e3b0def97b0bace298faef9c0b330e060230e2651eab6d2250cc8220d685',
  proveedor: 'uPay',
  tipo_tarjeta: 'Débito',
}

function mockFetch(payload: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Pagopar recurring API client', () => {
  beforeEach(() => {
    vi.stubEnv('PAGOPAR_PUBLIC_KEY', 'public-key')
    vi.stubEnv('PAGOPAR_PRIVATE_KEY', 'private-key')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('builds the token as sha1(private key + "PAGO-RECURRENTE")', () => {
    expect(getPagoparRecurringToken('private-key')).toBe(
      createHash('sha1').update('private-keyPAGO-RECURRENTE').digest('hex'),
    )
  })

  it('stays off until the contract flag is set', () => {
    expect(isPagoparRecurringEnabled()).toBe(false)
    vi.stubEnv('PAGOPAR_RECURRING_ENABLED', 'true')
    expect(isPagoparRecurringEnabled()).toBe(true)
  })

  it('requests the uPay card form and builds the iframe URL', async () => {
    const fetchMock = mockFetch({ respuesta: true, resultado: 'JIugXOLYIvpjMpN2n9GN' })
    const formId = await startPagoparCardForm({ customerId: 7, returnUrl: 'https://www.mitiendapy.com/auth/pagopar-tarjeta', provider: 'uPay' })

    expect(formId).toBe('JIugXOLYIvpjMpN2n9GN')
    expect(getUpayCardFormUrl(formId)).toBe('https://www.pagopar.com/upay-iframe/?id-form=JIugXOLYIvpjMpN2n9GN')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.pagopar.com/api/pago-recurrente/3.0/agregar-tarjeta/')
    expect(JSON.parse(init.body)).toEqual({
      token: getPagoparRecurringToken('private-key'),
      token_publico: 'public-key',
      url: 'https://www.mitiendapy.com/auth/pagopar-tarjeta',
      proveedor: 'uPay',
      identificador: 7,
    })
  })

  it('pays an existing order with the temporary card alias', async () => {
    const fetchMock = mockFetch({ respuesta: true, resultado: '' })
    await payPagoparOrderWithCard({ customerId: 7, aliasToken: CARD.alias_token, orderHash: 'abc123' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.pagopar.com/api/pago-recurrente/3.0/pagar/')
    expect(JSON.parse(init.body)).toMatchObject({ hash_pedido: 'abc123', tarjeta: CARD.alias_token, identificador: 7 })
  })

  it('marks an explicit Pagopar "no" as a rejection, not as a network error', async () => {
    mockFetch({ respuesta: false, resultado: 'Fondos insuficientes' })
    const error = await payPagoparOrderWithCard({ customerId: 7, aliasToken: 'x', orderHash: 'y' }).catch((e) => e)
    expect(error).toBeInstanceOf(PagoparRecurringError)
    expect(error).toMatchObject({ rejected: true, message: 'Fondos insuficientes', endpoint: 'pagar' })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    const networkError = await payPagoparOrderWithCard({ customerId: 7, aliasToken: 'x', orderHash: 'y' }).catch((e) => e)
    expect(networkError).toMatchObject({ rejected: false })
  })

  it('treats an unknown buyer as having no cards', async () => {
    mockFetch({ respuesta: false, resultado: 'No existe comprador' })
    await expect(listPagoparCards(7)).resolves.toEqual([])
  })

  it('parses listed cards and picks the saved one', () => {
    const other = { ...CARD, tarjeta: '4', tarjeta_numero: '411111******1111', alias_token: 'other', proveedor: 'Bancard' }
    const cards = parsePagoparCards([other, CARD, { tarjeta: '5' }])

    expect(cards).toHaveLength(2)
    expect(cards[1]).toEqual({
      cardId: '3',
      masked: '541863******4424',
      brand: 'Mastercard',
      issuer: 'UENO HOLDING S.A.E.C.A.',
      cardType: 'Débito',
      provider: 'uPay',
      aliasToken: CARD.alias_token,
    })
    expect(pickPagoparCard(cards, { provider: 'uPay' })?.cardId).toBe('3')
    expect(pickPagoparCard(cards, { provider: 'uPay', masked: '999' })?.cardId).toBe('3')
    expect(pickPagoparCard(cards, { provider: 'Bancard', masked: '411111******1111' })?.cardId).toBe('4')
    expect(pickPagoparCard([], { provider: 'uPay' })).toBeNull()
    expect(parsePagoparCards('No existe comprador')).toEqual([])
  })
})
