export type OrganizationEditValues = {
  name: string; slug: string; plan: string; status: string; currency: string; timezone: string;
  business_vertical: string; operating_model: string; enabled_modules: string[] | null; cancel_at_period_end: boolean;
}
type Original = { name: string; slug: string; plan: string; subscription_status?: string | null } & Partial<{ [K in Exclude<keyof OrganizationEditValues, 'name' | 'slug' | 'plan' | 'status'>]: OrganizationEditValues[K] | null }>
export function organizationEditDefaults(original: Original): OrganizationEditValues {
  return {
    name: original.name, slug: original.slug, plan: (original.plan || 'FREE').toUpperCase(),
    status: original.subscription_status === 'canceled' ? 'cancelled' : original.subscription_status || 'sin_registro', currency: original.currency || 'PYG', timezone: original.timezone || 'America/Asuncion',
    business_vertical: original.business_vertical || 'general', operating_model: original.operating_model || 'retail',
    enabled_modules: original.enabled_modules ?? null, cancel_at_period_end: Boolean(original.cancel_at_period_end),
  }
}
export function buildOrganizationPatch(original: Original, draft: OrganizationEditValues): Partial<OrganizationEditValues> {
  const before = organizationEditDefaults(original)
  const patch: Record<string, unknown> = {}
  for (const key of Object.keys(before) as (keyof OrganizationEditValues)[]) {
    const value = key === 'name' || key === 'slug' ? draft[key].trim() : draft[key]
    if (key === 'enabled_modules') {
      // The current API accepts an explicit list; omitted means preserve inheritance.
      if (value === null) continue
      if (before.enabled_modules !== null && JSON.stringify([...value as string[]].sort()) === JSON.stringify([...before.enabled_modules].sort())) continue
    } else if (value === before[key]) continue
    patch[key] = value
  }
  return patch
}
export function normalizeOrganizationSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}
export const ORGANIZATION_FIELD_LABELS: Record<keyof OrganizationEditValues, string> = {
  name: 'Nombre', slug: 'Dirección pública', plan: 'Plan', status: 'Estado de suscripción', currency: 'Moneda', timezone: 'Zona horaria',
  business_vertical: 'Rubro', operating_model: 'Tipo de negocio', enabled_modules: 'Funciones', cancel_at_period_end: 'Cancelar al terminar el período',
}
