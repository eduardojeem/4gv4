import { REGIONAL_DEFAULT_COUNTRIES, getRegionalDefaults, normalizeLocaleCode, type LocaleCode } from './contract'

/** Los países que hoy se pueden elegir, con su nombre: los mismos en el onboarding y en Configuración. */
export const REGIONAL_COUNTRY_LABELS: Record<(typeof REGIONAL_DEFAULT_COUNTRIES)[number], string> = {
  PY: 'Paraguay',
  BR: 'Brasil',
  AR: 'Argentina',
  US: 'Estados Unidos',
}

export function countryLabel(code: string | null | undefined): string {
  if (!code) return ''
  return REGIONAL_COUNTRY_LABELS[code as keyof typeof REGIONAL_COUNTRY_LABELS] ?? code
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
