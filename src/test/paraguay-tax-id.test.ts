import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computeRucCheckDigit,
  parseParaguayTaxId,
  validateParaguayTaxId,
} from '@/lib/billing/paraguay-tax-id'

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
})
