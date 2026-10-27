export const REGIONAL_CURRENCIES = [
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

export const REGIONAL_CURRENCY_CODES = REGIONAL_CURRENCIES.map(({ code }) => code) as [
  (typeof REGIONAL_CURRENCIES)[number]['code'],
  ...(typeof REGIONAL_CURRENCIES)[number]['code'][],
]

export type CountryCode = string & { readonly __countryCode: unique symbol }
export type CurrencyCode = (typeof REGIONAL_CURRENCIES)[number]['code']
export type LocaleCode = string & { readonly __localeCode: unique symbol }
export type IanaTimeZone = string & { readonly __ianaTimeZone: unique symbol }

export interface RegionalSettings {
  /** null means a legacy organization still needs to confirm its country. */
  countryCode: CountryCode | null
  /** Maps to organization_settings.currency in the current database contract. */
  baseCurrency: CurrencyCode
  timezone: IanaTimeZone
  /** null preserves a legacy organization without an explicit locale. */
  locale: LocaleCode | null
}

export interface RegionalDefaults {
  countryCode: CountryCode
  baseCurrency: CurrencyCode
  locale: LocaleCode
  /** A suggested timezone; null means the user must explicitly select one. */
  timezone: IanaTimeZone | null
  timezoneSelectionRequired: boolean
}

export interface TaxProfileReference {
  countryCode: CountryCode
  profileCode: string | null
}

/** Generic fiscal boundary; detailed country rules belong to a later phase. */
export interface FiscalBehaviorBoundary {
  taxProfile: TaxProfileReference | null
  defaultRate: number | null
  pricesIncludeTax: boolean | null
}

export const REGIONAL_DEFAULT_COUNTRIES = ['PY', 'BR', 'AR', 'US'] as const

const COUNTRY_DEFAULTS: Record<(typeof REGIONAL_DEFAULT_COUNTRIES)[number], Omit<RegionalDefaults, 'countryCode'>> = {
  PY: {
    baseCurrency: 'PYG',
    timezone: 'America/Asuncion' as IanaTimeZone,
    locale: 'es-PY' as LocaleCode,
    timezoneSelectionRequired: false,
  },
  BR: {
    baseCurrency: 'BRL',
    timezone: 'America/Sao_Paulo' as IanaTimeZone,
    locale: 'pt-BR' as LocaleCode,
    timezoneSelectionRequired: false,
  },
  AR: {
    baseCurrency: 'ARS',
    timezone: 'America/Argentina/Buenos_Aires' as IanaTimeZone,
    locale: 'es-AR' as LocaleCode,
    timezoneSelectionRequired: false,
  },
  US: {
    baseCurrency: 'USD',
    timezone: null,
    locale: 'en-US' as LocaleCode,
    timezoneSelectionRequired: true,
  },
}

/** Normalizes an ISO 3166-1 alpha-2 code and rejects values unknown to the runtime's region catalog. */
export function normalizeCountryCode(value: unknown): CountryCode | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(normalized)) return null
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(normalized)
    return name && name !== normalized && name !== 'Unknown Region' ? normalized as CountryCode : null
  } catch {
    return null
  }
}

export function normalizeCurrencyCode(value: unknown): CurrencyCode | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return REGIONAL_CURRENCIES.find(({ code }) => code === normalized)?.code ?? null
}

export function normalizeLocaleCode(value: unknown): LocaleCode | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const [locale] = Intl.getCanonicalLocales(value.trim())
    return locale ? locale as LocaleCode : null
  } catch {
    return null
  }
}

export function normalizeTimeZone(value: unknown): IanaTimeZone | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const timezone = new Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).resolvedOptions().timeZone
    return timezone as IanaTimeZone
  } catch {
    return null
  }
}

export function getRegionalDefaults(countryCode: CountryCode | string): RegionalDefaults | null {
  const normalized = normalizeCountryCode(countryCode)
  if (!normalized || !REGIONAL_DEFAULT_COUNTRIES.includes(normalized as (typeof REGIONAL_DEFAULT_COUNTRIES)[number])) {
    return null
  }

  return {
    countryCode: normalized,
    ...COUNTRY_DEFAULTS[normalized as (typeof REGIONAL_DEFAULT_COUNTRIES)[number]],
  }
}

export function getCurrencyFractionDigits(currencyCode: CurrencyCode | string): number {
  const normalized = normalizeCurrencyCode(currencyCode)
  return REGIONAL_CURRENCIES.find(({ code }) => code === normalized)?.fractionDigits
    ?? REGIONAL_CURRENCIES[0].fractionDigits
}

export function getRegionalCurrencySymbol(currencyCode: CurrencyCode, locale: LocaleCode | string): string {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0)
  return parts.find((part) => part.type === 'currency')?.value ?? currencyCode
}

export function formatCurrencyAmount(
  amount: number,
  currencyCode: CurrencyCode,
  locale: LocaleCode | string,
  options: Intl.NumberFormatOptions = {},
): string {
  const normalizedLocale = normalizeLocaleCode(locale)
  if (!normalizedLocale) throw new RangeError('Invalid locale code')

  const { currency: _currency, style: _style, ...formatOptions } = options
  const fractionDigits = getCurrencyFractionDigits(currencyCode)

  return new Intl.NumberFormat(normalizedLocale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    ...formatOptions,
  }).format(amount)
}
