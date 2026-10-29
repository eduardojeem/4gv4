import { getRegionalDefaults, getSupportedRegionalCountries, normalizeLocaleCode, type LocaleCode } from './contract'

/** Nombre de cada país admitido, tomado del catálogo regional (la única fuente). */
export const REGIONAL_COUNTRY_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  getSupportedRegionalCountries().map(({ code, label }) => [code, label]),
)

export function countryLabel(code: string | null | undefined): string {
  if (!code) return ''
  return REGIONAL_COUNTRY_LABELS[code] ?? code
}

/**
 * El `locale` que guarda el onboarding (es-PY) es el idioma de los formatos más
 * el país. Configuración cambia los dos por separado: esto vuelve a armarlo
 * para que no queden diciendo cosas distintas.
 */
export function localeForRegion(language: string, countryCode: string | null | undefined): LocaleCode | null {
  if (!countryCode) return null
  return normalizeLocaleCode(`${language}-${countryCode}`)
}

/** Lo habitual de cada país (moneda, zona horaria, idioma de formatos), si se conoce. */
export function regionalSuggestion(countryCode: string | null | undefined) {
  if (!countryCode) return null
  const defaults = getRegionalDefaults(countryCode)
  if (!defaults) return null
  return {
    currency: defaults.baseCurrency,
    timeZone: defaults.timezone,
    language: defaults.locale.split('-')[0],
  }
}
