import { describe, expect, it } from 'vitest'
import {
  formatCurrencyAmount,
  getCurrencyFractionDigits,
  getRegionalCurrencySymbol,
  getRegionalDefaults,
  normalizeCountryCode,
  normalizeCurrencyCode,
  normalizeLocaleCode,
  normalizeTimeZone,
  REGIONAL_CURRENCY_CODES,
  type RegionalSettings,
} from './contract'
import { needsCountryConfirmation, normalizeRegionalSettingsPatch } from './settings'
import { CURRENCIES as mobileCurrencies } from '../../../mobile/src/lib/settings-model'

describe('regional contract', () => {
  it('normalizes ISO alpha-2 country-code shape and rejects malformed input', () => {
    expect(normalizeCountryCode('py')).toBe('PY')
    expect(normalizeCountryCode('PY')).toBe('PY')
    expect(normalizeCountryCode('ca')).toBe('CA')
    expect(normalizeCountryCode('ZZ')).toBeNull()
    expect(normalizeCountryCode('Paraguay')).toBeNull()
    expect(normalizeCountryCode('P')).toBeNull()
    expect(normalizeCountryCode(null)).toBeNull()
  })

  it('normalizes supported ISO 4217 currency codes and rejects unsupported values', () => {
    expect(normalizeCurrencyCode('pyg')).toBe('PYG')
    expect(normalizeCurrencyCode('BRL')).toBe('BRL')
    expect(normalizeCurrencyCode('US$')).toBeNull()
    expect(normalizeCurrencyCode('ZZZ')).toBeNull()
  })

  it('exposes the same currency catalog to the mobile settings contract', () => {
    expect(mobileCurrencies.map(({ code }) => code)).toEqual(REGIONAL_CURRENCY_CODES)
  })

  it('provides the initial country defaults without limiting country-code extensibility', () => {
    expect(getRegionalDefaults('PY')).toMatchObject({
      baseCurrency: 'PYG',
      locale: 'es-PY',
      timezone: 'America/Asuncion',
    })
    expect(getRegionalDefaults('BR')).toMatchObject({
      baseCurrency: 'BRL',
      locale: 'pt-BR',
      timezone: 'America/Sao_Paulo',
    })
    expect(getRegionalDefaults('AR')).toMatchObject({
      baseCurrency: 'ARS',
      locale: 'es-AR',
      timezone: 'America/Argentina/Buenos_Aires',
    })
    expect(getRegionalDefaults('US')).toMatchObject({
      baseCurrency: 'USD',
      locale: 'en-US',
      timezone: null,
      timezoneSelectionRequired: true,
    })
    expect(getRegionalDefaults('CA')).toBeNull()
  })

  it('normalizes locale and IANA timezone independently from the selected currency', () => {
    expect(normalizeLocaleCode('es-py')).toBe('es-PY')
    expect(['es-PY', 'pt-BR', 'es-AR', 'en-US'].map((locale) => normalizeLocaleCode(locale))).toEqual(['es-PY', 'pt-BR', 'es-AR', 'en-US'])
    expect(normalizeLocaleCode('not a locale')).toBeNull()
    expect(normalizeTimeZone('America/Sao_Paulo')).toBe('America/Sao_Paulo')
    expect(normalizeTimeZone('Not/A_Timezone')).toBeNull()

    const settings: RegionalSettings = {
      countryCode: normalizeCountryCode('PY'),
      baseCurrency: normalizeCurrencyCode('USD')!,
      locale: normalizeLocaleCode('es-PY')!,
      timezone: normalizeTimeZone('America/Asuncion')!,
    }
    expect(settings.baseCurrency).toBe('USD')
    expect(settings.locale).toBe('es-PY')

    const legacySettings: RegionalSettings = {
      countryCode: null,
      baseCurrency: normalizeCurrencyCode('PYG')!,
      locale: normalizeLocaleCode('es-PY')!,
      timezone: normalizeTimeZone('America/Asuncion')!,
    }
    expect(legacySettings.countryCode).toBeNull()
  })

  it('keeps country confirmation derived and accepts legacy regional nulls', () => {
    expect(needsCountryConfirmation(null)).toBe(true)
    expect(needsCountryConfirmation(normalizeCountryCode('PY'))).toBe(false)
    expect(normalizeRegionalSettingsPatch({ countryCode: null, locale: null })).toEqual({
      success: true,
      data: { countryCode: null, locale: null },
    })
  })

  it('normalizes regional write values and rejects malformed country or locale', () => {
    expect(normalizeRegionalSettingsPatch({ countryCode: ' py ', locale: 'es-py' })).toEqual({
      success: true,
      data: { countryCode: 'PY', locale: 'es-PY' },
    })
    expect(normalizeRegionalSettingsPatch({ countryCode: 'P1' }).success).toBe(false)
    expect(normalizeRegionalSettingsPatch({ countryCode: 'PRY' }).success).toBe(false)
    expect(normalizeRegionalSettingsPatch({ locale: 'not a locale' }).success).toBe(false)
  })

  it('formats currency using the explicit currency and locale, with ISO fraction digits', () => {
    const guarani = formatCurrencyAmount(1250.5, 'PYG', 'es-PY')
    const brazilianReal = formatCurrencyAmount(1250.5, 'BRL', 'pt-BR')
    const usDollarsInSpanish = formatCurrencyAmount(1250.5, 'USD', 'es-PY')

    expect(guarani).toContain('1.251')
    expect(guarani).not.toMatch(/[,\.]\d{2}\b/)
    expect(brazilianReal).toContain('1.250,50')
    expect(usDollarsInSpanish).toContain('1.250,50')
    expect(usDollarsInSpanish).not.toContain('€')
    expect(getCurrencyFractionDigits('unsupported')).toBe(0)
  })

  // Hermes en iOS (Expo Go) no trae NumberFormat.formatToParts: la app móvil
  // se caía al cargar con «undefined is not a function».
  it('resolves currency symbols without NumberFormat.formatToParts', () => {
    const expected = REGIONAL_CURRENCY_CODES.map((code) => getRegionalCurrencySymbol(code, 'es-PY'))
    const original = Intl.NumberFormat.prototype.formatToParts
    try {
      // @ts-expect-error simulate Hermes on iOS
      delete Intl.NumberFormat.prototype.formatToParts
      expect(REGIONAL_CURRENCY_CODES.map((code) => getRegionalCurrencySymbol(code, 'es-PY'))).toEqual(expected)
    } finally {
      Intl.NumberFormat.prototype.formatToParts = original
    }
    expect(getRegionalCurrencySymbol('PYG', 'es-PY')).toBe('₲')
  })
})
