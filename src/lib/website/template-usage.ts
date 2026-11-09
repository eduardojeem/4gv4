import { STOREFRONT_STYLE_PREFERENCES, type StorefrontStylePreference } from './storefront-style'

export interface TemplateUsage {
 counts: Record<StorefrontStylePreference, number>
 total: number
 unconfigured: number
 unknown: number
}

/** Saved preference, not inferred appearance or visits. One organization per count. */
export function summarizeTemplateUsage(organizationIds: string[], settings: { organization_id: string; value: unknown }[]): TemplateUsage {
 const counts = Object.fromEntries(STOREFRONT_STYLE_PREFERENCES.map(style => [style, 0])) as TemplateUsage['counts']
 const byOrganization = new Map(settings.map(row => [row.organization_id, row.value]))
 let unconfigured = 0
 let unknown = 0
 const ids = new Set(organizationIds)
 for (const id of ids) {
  const value = byOrganization.get(id)
  const style = value && typeof value === 'object' ? (value as { storefrontStyle?: unknown }).storefrontStyle : undefined
  if (style == null || style === '') { unconfigured++; continue }
  if (typeof style === 'string' && STOREFRONT_STYLE_PREFERENCES.includes(style as StorefrontStylePreference)) counts[style as StorefrontStylePreference]++
  else unknown++
 }
 return { counts, total: ids.size, unconfigured, unknown }
}
