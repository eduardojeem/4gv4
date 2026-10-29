import {
  REGIONAL_CURRENCIES,
  REGIONAL_CURRENCY_CODES,
  formatCurrencyAmount,
  getCurrencyFractionDigits as getRegionalCurrencyFractionDigits,
  getRegionalCurrencySymbol,
  normalizeCurrencyCode,
  normalizeCountryCode,
  normalizeLocaleCode,
  resolveEffectiveLocale,
  type CurrencyCode,
  type LocaleCode,
} from './regional/contract'

export const SUPPORTED_CURRENCY_CODES = REGIONAL_CURRENCY_CODES

export type SupportedCurrencyCode = CurrencyCode

export const SUPPORTED_LANGUAGE_CODES = ['es', 'en', 'pt'] as const
export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGE_CODES[number]

export type CurrencyDefinition = (typeof REGIONAL_CURRENCIES)[number]

export const SUPPORTED_CURRENCIES: readonly CurrencyDefinition[] = REGIONAL_CURRENCIES

export const SUPPORTED_LANGUAGES = [
  { code: 'es', name: 'Español', locale: 'es-PY' },
  { code: 'en', name: 'English', locale: 'en-US' },
  { code: 'pt', name: 'Português', locale: 'pt-BR' },
] as const

const DEFAULT_LOCALE = 'es-PY'
const DEFAULT_CURRENCY: SupportedCurrencyCode = 'PYG'
const DEFAULT_LANGUAGE: SupportedLanguageCode = 'es'

let runtimeCurrency: SupportedCurrencyCode | null = null
let runtimeLanguage: SupportedLanguageCode | null = null
let runtimeLocale: LocaleCode | null = null
let runtimeCountryCode: string | null = null

export function isSupportedCurrency(value: string): value is SupportedCurrencyCode {
  return normalizeCurrencyCode(value) !== null
}

export function isSupportedLanguage(value: string): value is SupportedLanguageCode {
  return (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(value)
}

export function getCurrencyDefinition(code: string): CurrencyDefinition {
  return SUPPORTED_CURRENCIES.find((currency) => currency.code === code) ?? SUPPORTED_CURRENCIES[0]
}

export function getCurrencyFractionDigits(code: string): number {
  return getRegionalCurrencyFractionDigits(code)
}

export function getLocaleForLanguage(language: string): string {
  return resolveEffectiveLocale({ language, fallbackLocale: DEFAULT_LOCALE })
}

export function setRegionalFormatConfig(config: {
  currency?: string | null
  language?: string | null
  locale?: string | null
  countryCode?: string | null
}) {
  if ('currency' in config) runtimeCurrency = config.currency ? normalizeCurrencyCode(config.currency) : null
  if ('language' in config) runtimeLanguage = config.language && isSupportedLanguage(config.language) ? config.language : null
  if ('locale' in config) runtimeLocale = normalizeLocaleCode(config.locale)
  if ('countryCode' in config) runtimeCountryCode = normalizeCountryCode(config.countryCode)
}

export const getLocaleConfig = () => {
  const environmentCurrency = process.env.NEXT_PUBLIC_CURRENCY
  const environmentLanguage = process.env.NEXT_PUBLIC_LANGUAGE
  const configuredLanguage = runtimeLanguage
    ?? (environmentLanguage && isSupportedLanguage(environmentLanguage) ? environmentLanguage : null)
  const currency = runtimeCurrency
    ?? (environmentCurrency && isSupportedCurrency(environmentCurrency) ? environmentCurrency : DEFAULT_CURRENCY)
  const language = configuredLanguage ?? DEFAULT_LANGUAGE
  const locale = resolveEffectiveLocale({
    locale: runtimeLocale,
    countryCode: runtimeCountryCode,
    language: configuredLanguage,
    fallbackLocale: process.env.NEXT_PUBLIC_LOCALE || getLocaleForLanguage(language),
  })

  return { locale, currency, language }
}

/**
 * Idioma con el que se muestran fechas y numeros.
 *
 * Existe para no repetir un locale fijo por el codigo: la plataforma admite
 * espanol, ingles y portugues, asi que un 'es-AR' escrito a mano mostraba
 * fechas en espanol argentino incluso en una instalacion brasilena.
 */
export const getDisplayLocale = (): string => getLocaleConfig().locale

export type CurrencyFormatOptions = Omit<Intl.NumberFormatOptions, 'currency'> & {
  currency?: string
  language?: string
  locale?: string
}

export const formatCurrency = (amount: number, options: CurrencyFormatOptions = {}): string => {
  const defaults = getLocaleConfig()
  const currency = normalizeCurrencyCode(options.currency) ?? defaults.currency
  const locale = options.locale || (options.language ? getLocaleForLanguage(options.language) : defaults.locale)
  const { currency: _currency, language: _language, locale: _locale, ...intlOptions } = options

  return formatCurrencyAmount(amount, currency, normalizeLocaleCode(locale) ?? 'es-PY' as LocaleCode, intlOptions)
}

export const formatCurrencyCompact = (
  amount: number,
  options: Pick<CurrencyFormatOptions, 'currency' | 'language' | 'locale'> = {}
): string => formatCurrency(amount, {
  ...options,
  notation: 'compact',
  maximumFractionDigits: 1,
})

export const formatCurrencyValue = (
  amount: number,
  options: Pick<CurrencyFormatOptions, 'currency' | 'language' | 'locale'> = {}
): string => {
  const defaults = getLocaleConfig()
  const currency = options.currency && isSupportedCurrency(options.currency)
    ? options.currency
    : defaults.currency
  const locale = options.locale || (options.language ? getLocaleForLanguage(options.language) : defaults.locale)
  const fractionDigits = getCurrencyFractionDigits(currency)

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount)
}

export const parseCurrency = (value: string): number => {
  const cleaned = value.replace(/[^\d.-]/g, '')
  return parseFloat(cleaned) || 0
}

export const getCurrencySymbol = (currencyCode?: string, language?: string): string => {
  const defaults = getLocaleConfig()
  const currency = currencyCode ? normalizeCurrencyCode(currencyCode) ?? defaults.currency : defaults.currency
  const locale = language ? getLocaleForLanguage(language) : defaults.locale
  return getRegionalCurrencySymbol(currency, normalizeLocaleCode(locale) ?? 'es-PY')
}

export const isValidCurrency = (value: string | number): boolean => {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0
  const parsed = parseCurrency(value)
  return Number.isFinite(parsed) && parsed >= 0
}

/** Formatea un valor numérico o texto a miles con puntos para visualización en Paraguay (ej: 1000000 -> "1.000.000") */
export const formatThousands = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return ''
  const clean = String(value).replace(/\D/g, '')
  if (!clean) return ''
  const num = parseInt(clean, 10)
  return isNaN(num) ? '' : num.toLocaleString('es-PY')
}

/** Parsea un texto con puntos/comas/letras a un número entero limpio (ej: "1.000.000" -> 1000000) */
export const parseThousands = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : 0
  const clean = String(value).replace(/\D/g, '')
  if (!clean) return 0
  const parsed = parseInt(clean, 10)
  return isNaN(parsed) ? 0 : parsed
}
