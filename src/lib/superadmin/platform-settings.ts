/**
 * Valores por defecto de la plataforma (fila `system_settings` id='system') que
 * edita /superadmin/settings. Sin dependencias de servidor: lo usan la página,
 * la ruta /api/superadmin/settings, el componente y los tests.
 */

import type { PlatformDefaultsKey } from '@/lib/validations/system-settings'

export type PlatformDefaults = {
  companyName: string
  companyEmail: string
  companyPhone: string
  companyRuc: string
  companyAddress: string
  currency: string
  taxRate: number
  timeZone: string
}

/** Zonas horarias que ofrece la pantalla (y cuyo uso cuenta la página). */
export const SETTINGS_TIMEZONES = [
  'America/Asuncion', 'America/Argentina/Buenos_Aires', 'America/Sao_Paulo', 'America/Montevideo',
  'America/Santiago', 'America/La_Paz', 'America/Lima', 'America/Bogota', 'America/Mexico_City', 'Europe/Madrid', 'UTC',
] as const

/** Columna de `system_settings` de cada clave que edita la pantalla. */
export const PLATFORM_DEFAULTS_COLUMNS: Record<PlatformDefaultsKey, string> = {
  companyName: 'company_name',
  companyRuc: 'company_ruc',
  companyEmail: 'company_email',
  companyPhone: 'company_phone',
  companyAddress: 'company_address',
  currency: 'currency',
  taxRate: 'tax_rate',
  timeZone: 'time_zone',
}

export const PLATFORM_SETTINGS_SELECT = ['updated_at', 'updated_by', ...Object.values(PLATFORM_DEFAULTS_COLUMNS)].join(', ')

export function toPlatformDefaults(row: Record<string, unknown> | null | undefined): PlatformDefaults {
  const s = row ?? {}
  const str = (key: string, fallback = '') => (typeof s[key] === 'string' ? (s[key] as string) : fallback)
  const tax = Number(s.tax_rate ?? 10)
  return {
    companyName: str('company_name'),
    companyEmail: str('company_email'),
    companyPhone: str('company_phone'),
    companyRuc: str('company_ruc'),
    companyAddress: str('company_address'),
    currency: str('currency', 'PYG'),
    taxRate: Number.isFinite(tax) ? tax : 10,
    timeZone: str('time_zone', 'America/Asuncion'),
  }
}

/** Códigos de respuesta de PUT /api/superadmin/settings que la pantalla distingue. */
export const PLATFORM_SETTINGS_CODES = {
  conflict: 'SETTINGS_REVISION_CONFLICT',
  taxRateConfirmation: 'TAX_RATE_CHANGE_CONFIRMATION_REQUIRED',
  mfaRequired: 'MFA_REQUIRED',
} as const

export const PLATFORM_SETTINGS_CONFLICT_MESSAGE =
  'Otra persona cambió la configuración mientras la editabas; recargá para ver los valores actuales. Tus cambios siguen en pantalla.'

const CONSTRAINT_MESSAGES: Record<string, string> = {
  system_settings_currency_check: 'Moneda: la base de datos todavía no acepta esa moneda.',
  system_settings_company_email_check: 'Email: la base de datos no acepta ese formato de email.',
  system_settings_tax_rate_check: 'IVA: tiene que estar entre 0 y 100.',
}

/**
 * Un CHECK de Postgres (código 23514) que rechazó el guardado, en castellano y
 * con el campo que falló. Devuelve null si el error es de otro tipo.
 */
export function describeSettingsConstraintError(error: { code?: unknown; message?: unknown; details?: unknown } | null | undefined): string | null {
  if (!error || error.code !== '23514') return null
  const text = `${typeof error.message === 'string' ? error.message : ''} ${typeof error.details === 'string' ? error.details : ''}`
  const constraint = text.match(/constraint "([^"]+)"/)?.[1] ?? null
  if (constraint && CONSTRAINT_MESSAGES[constraint]) return CONSTRAINT_MESSAGES[constraint]
  return constraint
    ? `Un valor no cumple una regla de la base de datos (${constraint}).`
    : 'Un valor no cumple una regla de la base de datos.'
}
