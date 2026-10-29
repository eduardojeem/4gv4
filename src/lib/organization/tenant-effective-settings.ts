import {
  mapDBToSettings,
  type SystemSettingsPartial,
} from '@/lib/validations/system-settings'
import { getTenantAdminSettings } from '@/lib/organization/admin-settings'

/**
 * Datos que identifican a un comercio. La fila global `system_settings` es de
 * la plataforma: si una organización todavía no cargó su email o su RUC, la
 * pantalla mostraba los de la plataforma como si fueran suyos, y al guardar
 * quedaban copiados. Ahora esos campos arrancan vacíos y solo se completan con
 * lo propio de la organización.
 */
export const ORGANIZATION_IDENTITY_KEYS = [
  'companyName',
  'companyEmail',
  'companyPhone',
  'companyRuc',
  'companyAddress',
  'city',
] as const

export type TenantOrganizationSettingsRow = {
  display_name?: string | null
  currency?: string | null
  timezone?: string | null
  modules?: unknown
  repair_max_discount_percent?: number | null
  repair_labor_tax_rate?: number | null
} | null | undefined

export type TenantDefaultBranchRow = {
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
} | null | undefined

/**
 * Lo que ve y guarda un comercio: valores generales de la plataforma (IVA,
 * formatos) + lo suyo encima. Lo usan la carga (/api/settings/shared) y el
 * guardado (/api/admin/system/settings) para que digan lo mismo.
 */
export function resolveTenantEffectiveSettings(input: {
  globalRow: Record<string, unknown>
  orgSettings: TenantOrganizationSettingsRow
  organizationName?: string | null
  defaultBranch?: TenantDefaultBranchRow
}): SystemSettingsPartial {
  const effective: SystemSettingsPartial = mapDBToSettings(input.globalRow as Parameters<typeof mapDBToSettings>[0])
  for (const key of ORGANIZATION_IDENTITY_KEYS) effective[key] = ''

  const tenantOverrides = getTenantAdminSettings(input.orgSettings?.modules)
  Object.assign(effective, tenantOverrides)

  const displayName = input.orgSettings?.display_name || tenantOverrides.companyName || input.organizationName
  if (displayName) effective.companyName = displayName
  if (input.orgSettings?.currency) effective.currency = input.orgSettings.currency as SystemSettingsPartial['currency']
  if (input.orgSettings?.timezone) effective.timeZone = input.orgSettings.timezone
  effective.repairMaxDiscountPercent = Number(input.orgSettings?.repair_max_discount_percent ?? 20)
  effective.repairLaborTaxRate = (input.orgSettings?.repair_labor_tax_rate ?? 10) as 0 | 5 | 10

  // Compatibilidad con organizaciones creadas antes de que el contacto de
  // empresa se guardara en admin_settings. Una vez configurado, la sucursal ya
  // no vuelve a sobrescribir estos datos.
  const branch = input.defaultBranch
  if (tenantOverrides.companyEmail === undefined && branch?.email) effective.companyEmail = branch.email
  if (tenantOverrides.companyPhone === undefined && branch?.phone) effective.companyPhone = branch.phone
  if (tenantOverrides.companyAddress === undefined && branch?.address) effective.companyAddress = branch.address
  if (tenantOverrides.city === undefined && branch?.city) effective.city = branch.city

  return effective
}

type ContactKey = 'companyPhone' | 'companyEmail' | 'companyAddress' | 'city'

const BRANCH_COLUMN_BY_KEY: Record<ContactKey, 'phone' | 'email' | 'address' | 'city'> = {
  companyPhone: 'phone',
  companyEmail: 'email',
  companyAddress: 'address',
  city: 'city',
}

/**
 * El contacto de la empresa y el de la sucursal principal son el mismo dato
 * para casi todos los comercios (el onboarding los carga juntos). Al cambiarlo
 * en Configuración se actualiza también la sucursal, pero solo los campos que
 * estaban vacíos o seguían igual al valor anterior: una sucursal con un
 * teléfono propio, distinto del de la empresa, no se toca.
 */
export function branchContactPatch(
  changes: SystemSettingsPartial,
  previous: SystemSettingsPartial,
  branch: TenantDefaultBranchRow,
): Record<string, string | null> {
  if (!branch) return {}
  const patch: Record<string, string | null> = {}
  for (const key of Object.keys(BRANCH_COLUMN_BY_KEY) as ContactKey[]) {
    const next = changes[key]
    if (next === undefined) continue
    const column = BRANCH_COLUMN_BY_KEY[key]
    const current = (branch[column] ?? '').trim()
    const before = (previous[key] ?? '').trim()
    if (current && current !== before) continue
    if (current === next.trim()) continue
    // En la sucursal, «sin dato» es null.
    patch[column] = next.trim() || null
  }
  return patch
}

const COMPANY_INFO_KEY_BY_SETTING: Partial<Record<keyof SystemSettingsPartial, string>> = {
  companyPhone: 'phone',
  companyEmail: 'email',
  companyAddress: 'address',
  companyRuc: 'ruc',
}

/**
 * Lo mismo para la ficha pública de la tienda (`website_settings.company_info`):
 * la web, la lista «Configurá tu negocio» y los tickets leen el RUC y el
 * contacto de ahí. Mismo criterio que la sucursal: solo se pisa lo que estaba
 * vacío o era igual al valor anterior.
 */
export function companyInfoContactPatch(
  changes: SystemSettingsPartial,
  previous: SystemSettingsPartial,
  companyInfo: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!companyInfo) return {}
  const patch: Record<string, string> = {}
  for (const [settingKey, infoKey] of Object.entries(COMPANY_INFO_KEY_BY_SETTING) as Array<[keyof SystemSettingsPartial, string]>) {
    const next = changes[settingKey]
    if (typeof next !== 'string') continue
    const current = typeof companyInfo[infoKey] === 'string' ? (companyInfo[infoKey] as string).trim() : ''
    const before = typeof previous[settingKey] === 'string' ? (previous[settingKey] as string).trim() : ''
    if (current && current !== before) continue
    if (current === next.trim()) continue
    patch[infoKey] = next.trim()
  }
  return patch
}
