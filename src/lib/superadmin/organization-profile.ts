/**
 * La ficha general de una organizacion.
 *
 * El expediente mostraba dos tarjetas de metadatos —nombre, slug, moneda, zona
 * horaria, UUID— repitiendo lo que ya decia el encabezado. Un superadmin que
 * necesitaba llamar al cliente, facturarle, o saber si termino de configurar la
 * cuenta no tenia donde mirar: esos datos existen en la base, repartidos en
 * cuatro lugares distintos, y ninguno llegaba a la pantalla.
 */

/** De donde salio el valor. Un telefono heredado de la sucursal no es lo mismo
 *  que uno que el cliente cargo en su configuracion. */
export type FieldSource = 'admin' | 'branch' | 'website' | 'billing' | 'owner' | null

export interface ResolvedField {
  value: string | null
  source: FieldSource
}

export const SOURCE_LABELS: Record<Exclude<FieldSource, null>, string> = {
  admin: 'Configuración del negocio',
  branch: 'Sucursal principal',
  website: 'Sitio público',
  billing: 'Datos de facturación',
  owner: 'Perfil del propietario',
}

const clean = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** El primer candidato con valor gana, y se recuerda de cual se trata. */
function firstOf(candidates: Array<[FieldSource, unknown]>): ResolvedField {
  for (const [source, raw] of candidates) {
    const value = clean(raw)
    if (value) return { value, source }
  }
  return { value: null, source: null }
}

export interface ContactSources {
  /** `organization_settings.modules.admin_settings` */
  adminSettings?: Record<string, unknown> | null
  /** `website_settings` con key `company_info` */
  companyInfo?: Record<string, unknown> | null
  /** La sucursal marcada como predeterminada. */
  defaultBranch?: Record<string, unknown> | null
  /** `billing_profiles` */
  billing?: Record<string, unknown> | null
  /** El perfil del dueño de la organizacion. */
  owner?: Record<string, unknown> | null
}

export interface OrganizationContact {
  phone: ResolvedField
  address: ResolvedField
  city: ResolvedField
  email: ResolvedField
  ruc: ResolvedField
  legalName: ResolvedField
  billingEmail: ResolvedField
  mapsUrl: ResolvedField
}

/**
 * El orden de preferencia es el mismo que usa `/api/onboarding/status` para
 * decidir si la cuenta tiene datos de contacto: lo que el admin cargo pesa mas
 * que lo que quedo en la sucursal o en el sitio publico.
 */
export function resolveOrganizationContact(sources: ContactSources): OrganizationContact {
  const admin = sources.adminSettings ?? {}
  const web = sources.companyInfo ?? {}
  const branch = sources.defaultBranch ?? {}
  const billing = sources.billing ?? {}
  const owner = sources.owner ?? {}

  return {
    phone: firstOf([
      ['admin', admin.companyPhone],
      ['branch', branch.phone],
      ['website', web.phone],
      ['billing', billing.phone],
    ]),
    address: firstOf([
      ['admin', admin.companyAddress],
      ['branch', branch.address],
      ['website', web.address],
      ['billing', billing.fiscal_address],
    ]),
    city: firstOf([
      ['admin', admin.city],
      ['branch', branch.city],
    ]),
    // El correo del propietario NO entra aca: es su cuenta personal, no el
    // correo del negocio. Contarlo como cargado haria que `countMissingContact`
    // dijera que no falta nada cuando el negocio no tiene correo publico.
    // El propietario se muestra en su propio renglon.
    email: firstOf([
      ['admin', admin.companyEmail],
      ['website', web.email],
      ['branch', branch.email],
    ]),
    ruc: firstOf([
      ['admin', admin.companyRuc],
      ['billing', billing.ruc],
    ]),
    legalName: firstOf([
      ['billing', billing.business_name],
      ['admin', admin.companyName],
    ]),
    billingEmail: firstOf([
      ['billing', billing.billing_email],
      ['owner', owner.email],
    ]),
    mapsUrl: firstOf([['website', web.mapsUrl]]),
  }
}

/** Cuantos de los datos de contacto estan cargados. Sirve para decir «faltan 3»
 *  en vez de dejar tres renglones vacios sin explicacion. */
export function countMissingContact(contact: OrganizationContact): number {
  const requeridos: Array<keyof OrganizationContact> = ['phone', 'address', 'city', 'email', 'ruc']
  return requeridos.filter((k) => contact[k].value === null).length
}

/**
 * Cuanto factura por venta. `null` sin ventas cobradas: un promedio de cero
 * pesos se leeria como «vende barato», no como «no vendio».
 */
export function averageTicket(revenueTotal: number, completedSales: number): number | null {
  if (!Number.isFinite(revenueTotal) || completedSales <= 0) return null
  return Math.round(revenueTotal / completedSales)
}

export interface AccountAge {
  days: number
  /** «3 años», «8 meses», «12 días». */
  label: string
}

/** Una fecha de alta obliga a hacer la cuenta mentalmente. */
export function accountAge(createdAt: string | null | undefined, now: number = Date.now()): AccountAge | null {
  if (!createdAt) return null
  const start = new Date(createdAt).getTime()
  if (!Number.isFinite(start)) return null

  const days = Math.max(0, Math.floor((now - start) / 86_400_000))
  if (days < 31) return { days, label: days === 1 ? '1 día' : `${days} días` }

  // Meses de calendario, no `days / 30.44`: con el promedio, una cuenta abierta
  // hace exactamente dos años se mostraba como «1 a. 11 m.».
  const desde = new Date(start)
  const hasta = new Date(now)
  let months =
    (hasta.getUTCFullYear() - desde.getUTCFullYear()) * 12 +
    (hasta.getUTCMonth() - desde.getUTCMonth())
  if (hasta.getUTCDate() < desde.getUTCDate()) months -= 1
  months = Math.max(0, months)

  if (months < 12) return { days, label: months === 1 ? '1 mes' : `${months} meses` }

  const years = Math.floor(months / 12)
  const restoMeses = months % 12
  const label = restoMeses === 0
    ? years === 1 ? '1 año' : `${years} años`
    : `${years} a. ${restoMeses} m.`
  return { days, label }
}

export interface OnboardingState {
  completed: boolean
  completedAt: string | null
}

/** `organization_settings.modules.onboarding`, la misma marca que lee
 *  `/api/onboarding/status`. */
export function resolveOnboardingState(modules: unknown): OnboardingState {
  const root = modules && typeof modules === 'object' && !Array.isArray(modules)
    ? (modules as Record<string, unknown>)
    : {}
  const onboarding = root.onboarding && typeof root.onboarding === 'object'
    ? (root.onboarding as Record<string, unknown>)
    : {}

  return {
    completed: onboarding.status === 'completed',
    completedAt: clean(onboarding.completed_at),
  }
}

/**
 * Un valor que la organizacion nunca configuro se mostraba igual que uno
 * elegido: `settings?.currency || 'PYG'` no distingue «guaranies porque asi lo
 * pidieron» de «guaranies porque es el default».
 */
export function configuredOr(value: unknown, fallback: string): { value: string; isDefault: boolean } {
  const limpio = clean(value)
  return limpio ? { value: limpio, isDefault: false } : { value: fallback, isDefault: true }
}
