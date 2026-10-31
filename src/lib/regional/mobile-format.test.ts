import { afterEach, describe, expect, it } from 'vitest'
import {
  formatMobileCurrency,
  formatMobileDate,
  getMobileDisplayLocale,
  setMobileRegionalFormatConfig,
} from '../../../mobile/src/lib/regional-format'
import { formatQuoteAmount } from '../../../mobile/src/lib/quote-display'

afterEach(() => setMobileRegionalFormatConfig({ locale: null, countryCode: null, language: null }))

describe('mobile regional formatting', () => {
  it('uses canonical locale before country defaults and legacy language', () => {
    setMobileRegionalFormatConfig({ locale: 'es-AR', countryCode: 'AR', language: 'es' })
    expect(getMobileDisplayLocale()).toBe('es-AR')
    setMobileRegionalFormatConfig({ locale: null, countryCode: 'BR', language: 'pt' })
    expect(getMobileDisplayLocale()).toBe('pt-BR')
  })

  it('formats a currency independently from the organization locale', () => {
    setMobileRegionalFormatConfig({ locale: 'es-AR', countryCode: 'AR', language: 'es' })
    const formatted = formatMobileCurrency(1250.5, 'USD')
    expect(formatted).toContain('1.250,50')
    expect(formatted).not.toContain('PYG')
    expect(formatQuoteAmount(1250.5, 'USD')).toContain('1.250,50')
  })

  it('uses the resolved locale for mobile date presentation', () => {
    setMobileRegionalFormatConfig({ locale: 'pt-BR', countryCode: 'BR', language: 'pt' })
    expect(formatMobileDate(new Date('2026-03-01T12:00:00.000Z'), { month: 'long', timeZone: 'UTC' }).toLowerCase()).toContain('março')
  })

  it('preserves legacy null country and locale values with language fallback', () => {
    setMobileRegionalFormatConfig({ locale: null, countryCode: null, language: 'en' })
    expect(getMobileDisplayLocale()).toBe('en-US')
  })
})
