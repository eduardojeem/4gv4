import { afterEach, describe, expect, it } from 'vitest'
import {
  SUPPORTED_CURRENCIES,
  formatCurrency,
  getCurrencyFractionDigits,
  getLocaleForLanguage,
  isSupportedCurrency,
  getLocaleConfig,
  setRegionalFormatConfig,
} from '@/lib/currency'

afterEach(() => setRegionalFormatConfig({ currency: null, language: null, locale: null, countryCode: null }))

describe('currency configuration', () => {
  it('supports the main currencies used by regional organizations', () => {
    const codes = SUPPORTED_CURRENCIES.map(({ code }) => code)

    expect(codes).toEqual(expect.arrayContaining([
      'PYG', 'USD', 'BRL', 'ARS', 'UYU', 'CLP', 'BOB', 'PEN', 'COP', 'MXN', 'EUR',
    ]))
    expect(isSupportedCurrency('PYG')).toBe(true)
    expect(isSupportedCurrency('INVALID')).toBe(false)
  })

  it('uses practical fraction digits for each currency', () => {
    expect(getCurrencyFractionDigits('PYG')).toBe(0)
    expect(getCurrencyFractionDigits('CLP')).toBe(0)
    expect(getCurrencyFractionDigits('USD')).toBe(2)
  })

  it('formats using the selected interface language and currency', () => {
    expect(getLocaleForLanguage('es')).toBe('es-PY')
    expect(getLocaleForLanguage('en')).toBe('en-US')
    expect(getLocaleForLanguage('pt')).toBe('pt-BR')

    const formatted = formatCurrency(1250.5, { currency: 'USD', language: 'en' })
    expect(formatted).toContain('$')
    expect(formatted).toContain('1,250.50')
  })

  it('uses the canonical organization locale without deriving its currency', () => {
    setRegionalFormatConfig({ countryCode: 'AR', locale: 'es-AR', language: 'es', currency: 'USD' })
    expect(getLocaleConfig()).toMatchObject({ locale: 'es-AR', currency: 'USD' })
    const formatted = formatCurrency(1250.5)
    expect(formatted).toContain('1.250,50')
    expect(formatted).not.toContain('PYG')
  })

  it('keeps legacy null country and locale compatible with language fallback', () => {
    setRegionalFormatConfig({ countryCode: null, locale: null, language: 'pt', currency: 'BRL' })
    expect(getLocaleConfig()).toMatchObject({ locale: 'pt-BR', currency: 'BRL' })
  })
})
