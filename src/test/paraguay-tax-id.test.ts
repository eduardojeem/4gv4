import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computeRucCheckDigit,
  parseParaguayTaxId,
  validateParaguayTaxId,
} from '@/lib/billing/paraguay-tax-id'
import { createPagoparOrder } from '@/lib/payments/pagopar'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('RUC y cédula de Paraguay', () => {
  it('calcula el dígito verificador con el módulo 11 de la SET', () => {
    expect(computeRucCheckDigit('80012345')).toBe(0)
    expect(computeRucCheckDigit('1234567')).toBe(9)
  })

  it('separa número y dígito, aceptando puntos y espacios', () => {
    expect(parseParaguayTaxId('80.012.345-0')).toEqual({ number: '80012345', checkDigit: '0' })
    expect(parseParaguayTaxId(' 1234567 ')).toEqual({ number: '1234567', checkDigit: null })
    expect(parseParaguayTaxId('abc')).toBeNull()
  })

  it('rechaza un dígito verificador que no coincide', () => {
    expect(validateParaguayTaxId('80012345-0')).toBeNull()
    expect(validateParaguayTaxId('1234567')).toBeNull()
    expect(validateParaguayTaxId('80012345-1')).toMatch(/no coincide/)
    expect(validateParaguayTaxId('')).toMatch(/Ingresá/)
  })

  it('a Pagopar le manda el número sin el dígito y el RUC completo aparte', async () => {
    vi.stubEnv('PAGOPAR_PUBLIC_KEY', 'public-test-key')
    vi.stubEnv('PAGOPAR_PRIVATE_KEY', 'private-test-key')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ respuesta: true, resultado: [{ data: 'a'.repeat(64), pedido: '1' }] }), {
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'info').mockImplementation(() => {})

    await createPagoparOrder({
      amountPyg: 100000,
      buyer: { ruc: '80012345-0', document: '80012345-0', name: 'Empresa', email: 'a@b.test' },
      description: 'Suscripción',
      externalReference: 'SUB1',
      itemId: 1,
      paymentMethod: 'card',
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.comprador.documento).toBe('80012345')
    expect(body.comprador.ruc).toBe('80012345-0')
  })
})
