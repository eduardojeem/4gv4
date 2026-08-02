import {
  SystemSettingsPartialSchema,
  type SystemSettingsPartial,
} from '@/lib/validations/system-settings'

export const TENANT_ADMIN_SETTINGS_KEY = 'admin_settings'

export type OrganizationModules = Record<string, unknown>

export function normalizeOrganizationModules(value: unknown): OrganizationModules {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as OrganizationModules
    : {}
}

export function getTenantAdminSettings(modules: unknown): SystemSettingsPartial {
  const normalized = normalizeOrganizationModules(modules)
  const parsed = SystemSettingsPartialSchema.safeParse(normalized[TENANT_ADMIN_SETTINGS_KEY])
  return parsed.success ? parsed.data : {}
}

export function mergeTenantAdminSettings(
  modules: unknown,
  updates: SystemSettingsPartial
): OrganizationModules {
  const normalized = normalizeOrganizationModules(modules)
  return {
    ...normalized,
    [TENANT_ADMIN_SETTINGS_KEY]: {
      ...getTenantAdminSettings(normalized),
      ...updates,
    },
  }
}

export interface OnboardingCompanySettings {
  displayName: string
  email?: string
  phone: string
  ruc?: string
  address: string
  city: string
  currency: SystemSettingsPartial['currency']
  timezone: string
  language: SystemSettingsPartial['language']
}

export function toOnboardingAdminSettings(
  input: OnboardingCompanySettings
): SystemSettingsPartial {
  return {
    companyName: input.displayName,
    companyEmail: input.email ?? '',
    companyPhone: input.phone,
    companyRuc: input.ruc ?? '',
    companyAddress: input.address,
    city: input.city,
    currency: input.currency,
    timeZone: input.timezone,
    language: input.language,
  }
}
