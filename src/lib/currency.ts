export const SUPPORTED_CURRENCY_CODES = [
  'PYG',
  'USD',
  'BRL',
  'ARS',
  'UYU',
  'CLP',
  'BOB',
  'PEN',
  'COP',
  'MXN',
  'EUR',
] as const

export type SupportedCurrencyCode = typeof SUPPORTED_CURRENCY_CODES[number]

export const SUPPORTED_LANGUAGE_CODES = ['es', 'en', 'pt'] as const
export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGE_CODES[number]

export interface CurrencyDefinition {
  code: SupportedCurrencyCode
  name: string
  region: string
  fractionDigits: 0 | 2
}

export const SUPPORTED_CURRENCIES: readonly CurrencyDefinition[] = [
  { code: 'PYG', name: 'Guaraní paraguayo', region: 'Paraguay', fractionDigits: 0 },
  { code: 'USD', name: 'Dólar estadounidense', region: 'Internacional', fractionDigits: 2 },
  { code: 'BRL', name: 'Real brasileño', region: 'Brasil', fractionDigits: 2 },
  { code: 'ARS', name: 'Peso argentino', region: 'Argentina', fractionDigits: 2 },
  { code: 'UYU', name: 'Peso uruguayo', region: 'Uruguay', fractionDigits: 2 },
  { code: 'CLP', name: 'Peso chileno', region: 'Chile', fractionDigits: 0 },
  { code: 'BOB', name: 'Boliviano', region: 'Bolivia', fractionDigits: 2 },
  { code: 'PEN', name: 'Sol peruano', region: 'Perú', fractionDigits: 2 },
  { code: 'COP', name: 'Peso colombiano', region: 'Colombia', fractionDigits: 2 },
  { code: 'MXN', name: 'Peso mexicano', region: 'México', fractionDigits: 2 },
  { code: 'EUR', name: 'Euro', region: 'Unión Europea', fractionDigits: 2 },
] as const

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

export function isSupportedCurrency(value: string): value is SupportedCurrencyCode {
  return (SUPPORTED_CURRENCY_CODES as readonly string[]).includes(value)
}

export function isSupportedLanguage(value: string): value is SupportedLanguageCode {
  return (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(value)
}

export function getCurrencyDefinition(code: string): CurrencyDefinition {
  return SUPPORTED_CURRENCIES.find((currency) => currency.code === code) ?? SUPPORTED_CURRENCIES[0]
}

export function getCurrencyFractionDigits(code: string): number {
  return getCurrencyDefinition(code).fractionDigits
}

export function getLocaleForLanguage(language: string): string {
  return SUPPORTED_LANGUAGES.find((item) => item.code === language)?.locale ?? DEFAULT_LOCALE
}

export function setRegionalFormatConfig(config: { currency?: string; language?: string }) {
  if (config.currency && isSupportedCurrency(config.currency)) runtimeCurrency = config.currency
  if (config.language && isSupportedLanguage(config.language)) runtimeLanguage = config.language
}

export const getLocaleConfig = () => {
  const environmentCurrency = process.env.NEXT_PUBLIC_CURRENCY
  const environmentLanguage = process.env.NEXT_PUBLIC_LANGUAGE
  const currency = runtimeCurrency
    ?? (environmentCurrency && isSupportedCurrency(environmentCurrency) ? environmentCurrency : DEFAULT_CURRENCY)
  const language = runtimeLanguage
    ?? (environmentLanguage && isSupportedLanguage(environmentLanguage) ? environmentLanguage : DEFAULT_LANGUAGE)
  const locale = runtimeLanguage
    ? getLocaleForLanguage(language)
    : process.env.NEXT_PUBLIC_LOCALE || getLocaleForLanguage(language)

  return { locale, currency, language }
}

export type CurrencyFormatOptions = Omit<Intl.NumberFormatOptions, 'currency'> & {
  currency?: string
  language?: string
  locale?: string
}

export const formatCurrency = (amount: number, options: CurrencyFormatOptions = {}): string => {
  const defaults = getLocaleConfig()
  const currency = options.currency && isSupportedCurrency(options.currency)
    ? options.currency
    : defaults.currency
  const locale = options.locale || (options.language ? getLocaleForLanguage(options.language) : defaults.locale)
  const fractionDigits = getCurrencyFractionDigits(currency)
  const intlOptions: CurrencyFormatOptions = { ...options }
  delete intlOptions.language
  delete intlOptions.locale

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    ...intlOptions,
  }).format(amount)
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
  const currency = currencyCode && isSupportedCurrency(currencyCode) ? currencyCode : defaults.currency
  const locale = language ? getLocaleForLanguage(language) : defaults.locale
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0)

  return parts.find((part) => part.type === 'currency')?.value || currency
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
