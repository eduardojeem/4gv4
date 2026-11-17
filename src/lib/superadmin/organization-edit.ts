export type OrganizationEditValues = {
  name: string; slug: string; plan: string; status: string; currency: string; timezone: string;
  business_vertical: string; operating_model: string; enabled_modules: string[] | null; cancel_at_period_end: boolean;
  /** Fechas como «AAAA-MM-DD» (lo que muestra el campo de fecha); null sin fecha. */
  trial_ends_at: string | null; current_period_ends_at: string | null;
}
type Original = { name: string; slug: string; plan: string; subscription_status?: string | null } & Partial<{ [K in Exclude<keyof OrganizationEditValues, 'name' | 'slug' | 'plan' | 'status'>]: OrganizationEditValues[K] | null }>

/** «2026-11-23T03:34:59Z» → «2026-11-23» en la hora del navegador. */
export function toDateInput(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** «2026-11-23» → fin de ese día en la hora del navegador, en ISO. */
export function fromDateInput(value: string | null): string | null {
  if (!value) return null
  const date = new Date(`${value}T23:59:59`)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

export function organizationEditDefaults(original: Original): OrganizationEditValues {
  return {
    name: original.name, slug: original.slug, plan: (original.plan || 'FREE').toUpperCase(),
    status: original.subscription_status === 'canceled' ? 'cancelled' : original.subscription_status || 'sin_registro', currency: original.currency || 'PYG', timezone: original.timezone || 'America/Asuncion',
    business_vertical: original.business_vertical || 'general', operating_model: original.operating_model || 'retail',
    enabled_modules: original.enabled_modules ?? null, cancel_at_period_end: Boolean(original.cancel_at_period_end),
    trial_ends_at: toDateInput(original.trial_ends_at), current_period_ends_at: toDateInput(original.current_period_ends_at),
  }
}

export function buildOrganizationPatch(original: Original, draft: OrganizationEditValues): Partial<OrganizationEditValues> {
  const before = organizationEditDefaults(original)
  const patch: Record<string, unknown> = {}
  for (const key of Object.keys(before) as (keyof OrganizationEditValues)[]) {
    const value = key === 'name' || key === 'slug' ? (draft[key] as string).trim() : draft[key]
    if (key === 'enabled_modules') {
      // null = funciones del plan. Solo se manda si cambia: personalizar, o volver al plan.
      if (value === null) {
        if (before.enabled_modules !== null) patch[key] = null
        continue
      }
      if (before.enabled_modules !== null && JSON.stringify([...value as string[]].sort()) === JSON.stringify([...before.enabled_modules].sort())) continue
    } else if (value === before[key]) continue
    patch[key] = value
  }
  return patch
}

/** Lo que viaja a la API: las fechas del campo pasan a ISO (fin del día). */
export function organizationPatchPayload(patch: Partial<OrganizationEditValues>): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...patch }
  for (const key of ['trial_ends_at', 'current_period_ends_at'] as const) {
    if (key in patch) payload[key] = fromDateInput(patch[key] ?? null)
  }
  return payload
}

export function normalizeOrganizationSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}
export const ORGANIZATION_FIELD_LABELS: Record<keyof OrganizationEditValues, string> = {
  name: 'Nombre', slug: 'Dirección pública', plan: 'Plan', status: 'Estado de suscripción', currency: 'Moneda', timezone: 'Zona horaria',
  business_vertical: 'Rubro', operating_model: 'Tipo de negocio', enabled_modules: 'Funciones', cancel_at_period_end: 'Cancelar al terminar el período',
  trial_ends_at: 'Prueba hasta', current_period_ends_at: 'Activa hasta',
}
