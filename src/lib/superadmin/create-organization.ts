import {
  TENANT_SLUG_MAX_LENGTH,
  normalizeTenantSlug,
  validateTenantSlug,
  type TenantSlugProblem,
} from '@/lib/saas/reserved-slugs'

/**
 * El alta de una organizacion desde superadmin.
 *
 * El registro publico ya validaba el subdominio contra las rutas del sistema y
 * la infraestructura (`validateTenantSlug`). El alta de superadmin no: solo
 * pedia `^[a-z0-9-]+$`, asi que desde este panel se podia crear una tienda
 * `admin`, `api` o `marketplace` —tapada por la pantalla del sistema e
 * inalcanzable— o con guiones al borde. Tambien aceptaba cualquier moneda y
 * zona horaria, y un plan desconocido se convertia en FREE sin avisar.
 *
 * Todo lo de este archivo es puro: lo usan la ruta y el formulario, asi que el
 * navegador y el servidor aplican exactamente las mismas reglas.
 */

export const ORGANIZATION_NAME_MAX = 120
export const OWNER_NAME_MAX = 120
export const OWNER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DAY_MS = 86_400_000

export const ORGANIZATION_CURRENCIES = [
  { value: 'PYG', label: 'Guaraní paraguayo', symbol: '₲' },
  { value: 'USD', label: 'Dólar estadounidense', symbol: 'US$' },
  { value: 'ARS', label: 'Peso argentino', symbol: 'AR$' },
  { value: 'BRL', label: 'Real brasileño', symbol: 'R$' },
] as const

/**
 * Sin el desfase escrito a mano: la lista anterior decia «Paraguay (UTC-4)» y
 * Paraguay usa UTC-3 todo el año desde octubre de 2024. El desfase se calcula
 * con los datos de zona horaria del entorno, que se actualizan solos.
 */
export const ORGANIZATION_TIMEZONES = [
  { value: 'America/Asuncion', country: 'Paraguay' },
  { value: 'America/Argentina/Buenos_Aires', country: 'Argentina' },
  { value: 'America/Sao_Paulo', country: 'Brasil' },
  { value: 'America/Montevideo', country: 'Uruguay' },
  { value: 'America/La_Paz', country: 'Bolivia' },
  { value: 'America/Santiago', country: 'Chile' },
  { value: 'America/Lima', country: 'Perú' },
  { value: 'America/Bogota', country: 'Colombia' },
  { value: 'America/Mexico_City', country: 'México' },
  { value: 'America/New_York', country: 'Estados Unidos (Este)' },
] as const

export const DEFAULT_CURRENCY = 'PYG'
export const DEFAULT_TIMEZONE = 'America/Asuncion'

export function isValidTimezone(value: string): boolean {
  if (!value) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** «UTC-3», calculado para el instante dado. `null` si la zona no existe. */
export function timezoneOffsetLabel(timeZone: string, at: Date = new Date()): string | null {
  try {
    const parte = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value
    if (!parte) return null
    return parte.replace(/^GMT/, 'UTC')
  } catch {
    return null
  }
}

/**
 * Lo que se escribe en el campo del subdominio, sin recortar los guiones del
 * borde. `normalizeTenantSlug` si los recorta, y aplicado mientras se tipea
 * volvia imposible escribir «mi-tienda»: al llegar a «mi-» el guion desaparecia.
 * La validacion final sigue rechazando un guion al principio o al final.
 */
export function sanitizeSlugTyping(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, TENANT_SLUG_MAX_LENGTH)
}

export function trialDaysFrom(value: unknown): number {
  // La columna es NOT NULL DEFAULT 14: el 14 solo cubre filas rotas. `null` se
  // trata como ausente a mano porque `Number(null)` es 0, y una fila rota se
  // habria leido como «sin prueba».
  if (value === null || value === undefined || value === '') return 14
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 14
}

export function trialEndDate(days: number, now: number = Date.now()): Date {
  return new Date(now + days * DAY_MS)
}

// ── Lo que se envia ─────────────────────────────────────────────────────────

export type CreateOrganizationField =
  | 'name'
  | 'slug'
  | 'plan'
  | 'currency'
  | 'timezone'
  | 'ownerEmail'
  | 'ownerName'

export interface CreateOrganizationInput {
  name: string
  slug: string
  /** En mayusculas: FREE, BASIC, PRO, ENTERPRISE. */
  plan: string
  currency: string
  timezone: string
  ownerEmail: string | null
  ownerName: string | null
}

export type ParseFailure = {
  ok: false
  field: CreateOrganizationField
  message: string
  slugReason?: TenantSlugProblem
}

export type ParseCreateResult = { ok: true; value: CreateOrganizationInput } | ParseFailure

const texto = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const falla = (field: CreateOrganizationField, message: string): ParseFailure => ({ ok: false, field, message })

export type ParseOwnerResult =
  | { ok: true; email: string | null; name: string | null }
  | ParseFailure

export function parseOwnerInput(body: unknown): ParseOwnerResult {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const email = texto(b.owner_email).toLowerCase()
  const name = texto(b.owner_name)

  if (email && !OWNER_EMAIL_PATTERN.test(email)) {
    return falla('ownerEmail', 'El correo del propietario no es válido.')
  }
  if (name.length > OWNER_NAME_MAX) {
    return falla('ownerName', `El nombre no puede superar ${OWNER_NAME_MAX} caracteres.`)
  }
  return { ok: true, email: email || null, name: name || null }
}

export function parseCreateOrganizationInput(
  body: unknown,
  activePlanCodes: readonly string[]
): ParseCreateResult {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}

  const name = texto(b.name)
  if (!name) return falla('name', 'Ingresá el nombre de la organización.')
  if (name.length > ORGANIZATION_NAME_MAX) {
    return falla('name', `El nombre no puede superar ${ORGANIZATION_NAME_MAX} caracteres.`)
  }

  // La misma normalizacion y las mismas reservas que el registro publico.
  const slug = normalizeTenantSlug(texto(b.slug) || name)
  const slugCheck = validateTenantSlug(slug)
  if (slugCheck.ok === false) {
    return { ok: false, field: 'slug', message: slugCheck.message, slugReason: slugCheck.reason }
  }

  // Un plan desconocido antes se convertia en FREE sin avisar.
  const plan = texto(b.plan).toUpperCase()
  if (!plan) return falla('plan', 'Elegí un plan.')
  const planes = activePlanCodes.map((code) => String(code).toUpperCase())
  if (!planes.includes(plan)) {
    return falla('plan', `El plan «${plan}» no existe o no está activo.`)
  }

  const currency = texto(b.currency).toUpperCase() || DEFAULT_CURRENCY
  if (!ORGANIZATION_CURRENCIES.some((c) => c.value === currency)) {
    return falla('currency', `La moneda «${currency}» no está admitida.`)
  }

  const timezone = texto(b.timezone) || DEFAULT_TIMEZONE
  if (!isValidTimezone(timezone)) {
    return falla('timezone', `La zona horaria «${timezone}» no existe.`)
  }

  const owner = parseOwnerInput(b)
  if (owner.ok === false) return owner

  return {
    ok: true,
    value: { name, slug, plan, currency, timezone, ownerEmail: owner.email, ownerName: owner.name },
  }
}

// ── El propietario ──────────────────────────────────────────────────────────

export type OwnerFailureReason =
  | 'lookup_incomplete'
  | 'suspended'
  | 'already_registered'
  | 'invite_failed'
  | 'assign_failed'

export type OwnerOutcome =
  | { status: 'none' }
  /** No tenia cuenta: se le envio una invitacion. */
  | { status: 'invited'; email: string }
  /** Ya tenia cuenta: se la asigno sin enviarle correo. */
  | { status: 'assigned_existing'; email: string }
  | { status: 'failed'; email: string; reason: OwnerFailureReason; message: string }

export const OWNER_FAILURE_MESSAGES: Record<OwnerFailureReason, string> = {
  lookup_incomplete:
    'No se pudo confirmar si ya existe una cuenta con ese correo, así que no se envió la invitación: invitar a una cuenta existente falla.',
  suspended: 'La cuenta existe pero está suspendida. Reactivala antes de asignarla como propietaria.',
  already_registered:
    'Ya existe una cuenta con ese correo pero no se pudo ubicar para asignarla. Probá de nuevo en unos minutos.',
  invite_failed: 'No se pudo enviar la invitación. Revisá la configuración de correo e intentá de nuevo.',
  assign_failed: 'La cuenta está lista pero no se pudo asignar como propietaria. Intentá de nuevo.',
}

/** Lo que la ruta devuelve al consultar un correo antes de crear. */
export interface OwnerLookup {
  email: string
  exists: boolean
  suspended: boolean
  superAdmin: boolean
  /** En cuantas organizaciones ya forma parte del equipo. */
  organizations: number
  /** El barrido de cuentas se agoto: no se puede afirmar que no exista. */
  lookupIncomplete: boolean
}

/** Lo que la ruta devuelve al consultar un subdominio. */
export interface SlugAvailability {
  slug: string
  available: boolean
  reason?: TenantSlugProblem | 'taken'
  message?: string
  suggestion?: string | null
}

// ── Los planes que se ofrecen ───────────────────────────────────────────────

export interface PlanOption {
  code: string
  name: string
  price: number
  priceNote: string | null
  description: string | null
  isPopular: boolean
  trialDays: number
  /** Los limites que el sistema aplica, no los de la ficha comercial. */
  limits: Record<string, unknown> | null
  limitsSource: 'technical' | 'commercial' | 'missing'
  /** Cuantos modulos habilita. `null` si el plan no esta en la tabla tecnica. */
  moduleCount: number | null
}

const esObjeto = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Las tarjetas de plan mostraban `subscription_plans.limits` —la ficha
 * comercial— y cuando faltaba la clave decian «Colaboradores ilimitados». Los
 * limites que se aplican viven en `plans`, que es la que gana en
 * `mergeCommercialPlans`: un Free podia anunciarse sin tope de colaboradores y
 * frenar al tercero.
 */
export function buildPlanOptions(
  commercial: Array<Record<string, unknown>>,
  technical: Array<Record<string, unknown>>
): PlanOption[] {
  return commercial
    .map((row) => {
      const code = String(row.tier ?? '').toUpperCase()
      const tecnico = technical.find((t) => String(t.code ?? '').toUpperCase() === code)
      const limits = esObjeto(tecnico?.limits) ? tecnico.limits : esObjeto(row.limits) ? row.limits : null

      return {
        code,
        name: String(row.name ?? code),
        price: Number(row.price) || 0,
        priceNote: typeof row.price_note === 'string' && row.price_note ? row.price_note : null,
        description: typeof row.description === 'string' && row.description ? row.description : null,
        isPopular: row.is_popular === true,
        trialDays: trialDaysFrom(row.trial_days),
        limits,
        limitsSource: esObjeto(tecnico?.limits) ? 'technical' : esObjeto(row.limits) ? 'commercial' : 'missing',
        moduleCount: Array.isArray(tecnico?.modules) ? (tecnico.modules as unknown[]).length : null,
      } satisfies PlanOption
    })
    .filter((plan) => plan.code)
    .sort((a, b) => a.price - b.price)
}

export type PlanLimitDescription =
  | { kind: 'number'; value: number }
  | { kind: 'unlimited' }
  /** El plan no tiene esa clave cargada: no se puede afirmar «sin tope». */
  | { kind: 'undefined' }

export function describePlanLimit(limits: Record<string, unknown> | null, key: string): PlanLimitDescription {
  if (!limits || !(key in limits)) return { kind: 'undefined' }
  const valor = limits[key]
  // En la tabla de planes, `null` significa «sin tope».
  if (valor === null) return { kind: 'unlimited' }
  const n = Number(valor)
  if (!Number.isFinite(n)) return { kind: 'undefined' }
  return n > 0 ? { kind: 'number', value: n } : { kind: 'unlimited' }
}
