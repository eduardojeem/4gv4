import { afterEach, describe, expect, it } from 'vitest'
import { setRegionalFormatConfig } from '@/lib/currency'
import { parseMoneyInput } from '../after-sales-meta'

afterEach(() => setRegionalFormatConfig({ currency: 'PYG', language: 'es' }))

describe('monto escrito a mano', () => {
  it('en guaraníes ignora los separadores de miles', () => {
    setRegionalFormatConfig({ currency: 'PYG', language: 'es' })
    expect(parseMoneyInput('150.000')).toBe(150000)
    expect(parseMoneyInput('Gs. 1.250.000')).toBe(1250000)
  })

  // Antes se borraba todo lo que no fuera dígito: «12.50» se leía como 1250.
  it('en una moneda con centavos respeta el separador decimal', () => {
    setRegionalFormatConfig({ currency: 'USD', language: 'en' })
    expect(parseMoneyInput('12.50')).toBe(12.5)
    expect(parseMoneyInput('1,234.56')).toBe(1234.56)
    setRegionalFormatConfig({ currency: 'USD', language: 'es' })
    expect(parseMoneyInput('1.234,56')).toBe(1234.56)
  })
})
