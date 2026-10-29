import {
  normalizeCountryCode,
  normalizeLocaleCode,
  type CountryCode,
  type LocaleCode,
} from './contract'

export type RegionalSettingsPatch = {
  countryCode?: CountryCode | null
  locale?: LocaleCode | null
}

export type RegionalSettingsPatchResult =
  | { success: true; data: RegionalSettingsPatch }
  | { success: false; field: 'countryCode' | 'locale' }

/** Derives the onboarding state; legacy NULL remains valid and needs no locale. */
export function needsCountryConfirmation(countryCode: string | null | undefined): boolean {
  return countryCode == null
}

/** Normalizes only supplied fields so omitted values never overwrite stored data. */
export function normalizeRegionalSettingsPatch(input: unknown): RegionalSettingsPatchResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, field: 'countryCode' }
  }

  const values = input as Record<string, unknown>
  const result: RegionalSettingsPatch = {}

  if (Object.prototype.hasOwnProperty.call(values, 'countryCode')) {
    const value = values.countryCode
    if (value === null) result.countryCode = null
    else {
      const countryCode = normalizeCountryCode(value)
      if (!countryCode) return { success: false, field: 'countryCode' }
      result.countryCode = countryCode
    }
  }

  if (Object.prototype.hasOwnProperty.call(values, 'locale')) {
    const value = values.locale
    if (value === null) result.locale = null
    else {
      const locale = normalizeLocaleCode(value)
      if (!locale) return { success: false, field: 'locale' }
      result.locale = locale
    }
  }

  return { success: true, data: result }
}
