/**
 * Reglas del listado `/superadmin/organizations`: a quién hay que atender,
 * cómo se ordena, qué se filtra y qué se exporta. Sin React, para poder
 * probarlas aparte de la vista.
 */
import type { EditableOrganization } from '@/components/superadmin/organizations/EditOrganizationDialog'
import { describeLastAccess } from './last-access'
import { getSubscriptionTiming } from './organization-directory'
import { planLabel, type PlanNames } from './plan-names'

export type SuperAdminOrganization = {
  id: string
  name: string
  slug: string
  plan: string
  logo_url: string | null
  owner_id: string | null
  owner_name: string | null
  owner_email: string | null
  created_at: string | null
  updated_at: string | null
  subscription_status: string | null
  payment_status: string | null
  subscription_provider: string | null
  trial_ends_at: string | null
  current_period_ends_at: string | null
  cancel_at_period_end: boolean
  members_total: number
  members_active: number
  members_invited: number
  members_suspended: number
  staff_total: number
  staff_active: number
  staff_invited: number
  staff_suspended: number
  customers_total: number
  business_vertical?: string | null
  operating_model?: string | null
  enabled_modules?: string[] | null
  /** `false` cuando no se pudo leer el acceso o no hay equipo: no se afirma nada. */
  last_access_known?: boolean
  /** El acceso más reciente del equipo o del dueño. */
  last_access_at?: string | null
  last_sale_at?: string | null
  /** `false` cuando no se pudo leer la actividad: «Sin dato», nunca «Sin ventas». */
  activity_known?: boolean
  /** `null` cuando no se pudieron contar. */
  products_total?: number | null
  /** De `organization_settings`; sin fila, el valor por defecto de la tabla. */
  currency?: string | null
  timezone?: string | null
  storefront_public?: boolean | null
  /** Baja definitiva: la fila queda anonimizada y no se opera más. */
  erased_at?: string | null
}

/** Zona horaria de la plataforma: el SSR corre en UTC y el navegador en Paraguay. */
export const PLATFORM_TIME_ZONE = 'America/Asuncion'

const DAY = 86_400_000

/** Días hasta el vencimiento a partir del cual se avisa. */
export const DUE_SOON_DAYS = 7

export const PLAN_RANK: Record<string, number> = { FREE: 0, BASIC: 1, PRO: 2, ENTERPRISE: 3 }

/** Del peor al mejor: lo primero es lo que hay que resolver. */
export const STATUS_SEVERITY: Record<string, number> = {
  unpaid: 0,
  past_due: 1,
  suspended: 2,
  trialing: 3,
  active: 4,
  canceled: 5,
  expired: 6,
}

export function normalizeSubscriptionStatus(status: string | null | undefined) {
  if (!status) return null
  return status === 'cancelled' ? 'canceled' : status
}

const BLOCKING_STATUSES = new Set(['past_due', 'unpaid', 'suspended'])
type BillingFields = Pick<SuperAdminOrganization, 'plan' | 'subscription_status' | 'payment_status' | 'trial_ends_at' | 'current_period_ends_at'>

/**
 * La prueba terminó sin pago: `expire_trials()` la pasa a `past_due` con
 * `payment_status = 'unpaid'`. No es un cobro rechazado, es un cliente que
 * todavía no pagó nunca.
 */
export function isExpiredTrial(org: BillingFields, now: number) {
  if (normalizeSubscriptionStatus(org.subscription_status) !== 'past_due') return false
  const trialEnd = timeOf(org.trial_ends_at)
  if (trialEnd === null || trialEnd > now) return false
  const periodEnd = timeOf(org.current_period_ends_at)
  // Si tuvo un período pago después de la prueba, el vencido es ese período.
  return periodEnd === null || periodEnd <= trialEnd
}

/**
 * Problema de cobro: un período pago que venció, quedó impago o se suspendió,
 * o un pago rechazado con la suscripción vigente.
 *
 * No cuentan: el plan gratis (no se cobra), una prueba que terminó sin pagar
 * (se marca aparte) ni un `payment_status = 'unpaid'` que quedó de antes:
 * reactivar desde el superadmin no lo limpia, y marcaba como morosas a
 * empresas activas.
 */
export function hasBillingProblem(org: BillingFields, now = Date.now()) {
  if (org.plan?.toUpperCase() === 'FREE') return false
  const status = normalizeSubscriptionStatus(org.subscription_status)
  if (status && BLOCKING_STATUSES.has(status)) return !isExpiredTrial(org, now)
  return (status === 'active' || status === 'trialing') && org.payment_status?.toLowerCase() === 'failed'
}

/** Días sin vender a partir de los cuales una empresa sin accesos se considera sin uso. */
const RECENT_SALE_DAYS = 30

/** La fecha que importa según el estado: fin de prueba o fin del período. */
export function dueDateOf(org: Pick<SuperAdminOrganization, 'subscription_status' | 'trial_ends_at' | 'current_period_ends_at'>) {
  const status = normalizeSubscriptionStatus(org.subscription_status)
  if (status === 'trialing') return org.trial_ends_at
  if (status === 'active') return org.current_period_ends_at
  return null
}

/** Días hasta el vencimiento (negativo si ya venció); `null` sin fecha. */
export function daysUntilDue(org: SuperAdminOrganization, now: number) {
  const due = dueDateOf(org)
  if (!due) return null
  const time = new Date(due).getTime()
  if (!Number.isFinite(time)) return null
  return Math.ceil((time - now) / DAY)
}

export type AttentionReason = 'billing' | 'trial_expired' | 'due' | 'inactive' | 'no_subscription'

export type OrganizationAttention = {
  erased: boolean
  billingProblem: boolean
  /** La prueba terminó y no pagó. */
  trialExpired: boolean
  /** Vence (o venció) dentro de `DUE_SOON_DAYS`. */
  dueSoon: boolean
  /**
   * Más de un mes sin que nadie del equipo entre (o nunca entró) y sin ventas
   * en ese tiempo. Solo con el dato.
   */
  inactive: boolean
  noSubscription: boolean
  /** 0 = lo más urgente; 4 = sin alertas. */
  rank: number
  reasons: AttentionReason[]
}

export function getOrganizationAttention(org: SuperAdminOrganization, now: number): OrganizationAttention {
  const erased = Boolean(org.erased_at)
  const billingProblem = !erased && hasBillingProblem(org, now)
  const trialExpired = !erased && org.plan?.toUpperCase() !== 'FREE' && isExpiredTrial(org, now)
  const days = daysUntilDue(org, now)
  const dueSoon = !erased && days !== null && days <= DUE_SOON_DAYS && !org.cancel_at_period_end
  // Vender es usar el sistema: una caja que factura todos los días con la
  // sesión abierta no está abandonada aunque nadie haya vuelto a iniciar sesión.
  const lastSale = timeOf(org.last_sale_at)
  const sellsRecently = lastSale !== null && now - lastSale <= RECENT_SALE_DAYS * DAY
  const inactive = !erased && Boolean(org.last_access_known) && describeLastAccess(org.last_access_at, now).stale && !sellsRecently
  const noSubscription = !erased && !org.subscription_status
  const reasons: AttentionReason[] = []
  if (billingProblem) reasons.push('billing')
  if (trialExpired) reasons.push('trial_expired')
  if (dueSoon) reasons.push('due')
  if (inactive) reasons.push('inactive')
  if (noSubscription) reasons.push('no_subscription')
  const rank = billingProblem ? 0 : trialExpired || dueSoon ? 1 : inactive ? 2 : noSubscription ? 3 : 4
  return { erased, billingProblem, trialExpired, dueSoon, inactive, noSubscription, rank, reasons }
}

export function needsAttention(org: SuperAdminOrganization, now: number) {
  return getOrganizationAttention(org, now).rank < 4
}

// ---------------------------------------------------------------------------
// Orden
// ---------------------------------------------------------------------------

export type OrganizationSortKey = 'attention' | 'name' | 'plan' | 'status' | 'due' | 'access' | 'members' | 'created'

export const ORGANIZATION_SORT_KEYS: readonly OrganizationSortKey[] = ['attention', 'name', 'plan', 'status', 'due', 'access', 'members', 'created']

/** El sentido con el que arranca cada columna al elegirla. */
export const DEFAULT_SORT_DIRECTION: Record<OrganizationSortKey, 'asc' | 'desc'> = {
  attention: 'asc',
  name: 'asc',
  plan: 'desc',
  status: 'asc',
  due: 'asc',
  access: 'desc',
  members: 'desc',
  created: 'desc',
}

function timeOf(value: string | null | undefined) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

/** Valor de orden; `null` va siempre al final, en cualquier sentido. */
function sortValue(org: SuperAdminOrganization, key: OrganizationSortKey, now: number): number | string | null {
  switch (key) {
    case 'name': return org.name
    case 'plan': return PLAN_RANK[org.plan?.toUpperCase()] ?? Object.keys(PLAN_RANK).length
    case 'status': {
      const status = normalizeSubscriptionStatus(org.subscription_status)
      return status ? STATUS_SEVERITY[status] ?? 7 : 8
    }
    case 'due': return timeOf(dueDateOf(org))
    case 'access': return org.last_access_known ? timeOf(org.last_access_at) ?? 0 : null
    case 'members': return org.staff_total
    case 'created': return timeOf(org.created_at)
    case 'attention': return getOrganizationAttention(org, now).rank
  }
}

function compareValues(a: number | string, b: number | string) {
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'es', { sensitivity: 'base' })
  return Number(a) - Number(b)
}

export function sortOrganizations(
  rows: SuperAdminOrganization[],
  key: OrganizationSortKey,
  direction: 'asc' | 'desc',
  now: number,
) {
  const sign = direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const left = sortValue(a, key, now)
    const right = sortValue(b, key, now)
    if (left === null || right === null) {
      if (left !== right) return left === null ? 1 : -1
    } else {
      const cmp = compareValues(left, right)
      if (cmp !== 0) return sign * cmp
    }
    // Desempate estable y útil: en «Requiere atención», lo que vence antes;
    // en el resto, lo más reciente primero.
    if (key === 'attention') {
      const dueA = daysUntilDue(a, now) ?? Number.POSITIVE_INFINITY
      const dueB = daysUntilDue(b, now) ?? Number.POSITIVE_INFINITY
      if (dueA !== dueB) return dueA - dueB
    }
    return (timeOf(b.created_at) ?? 0) - (timeOf(a.created_at) ?? 0)
  })
}

// ---------------------------------------------------------------------------
// Filtros rápidos
// ---------------------------------------------------------------------------

export type QuickFilter = 'all' | 'attention' | 'due_soon' | 'inactive' | 'no_sub' | 'no_store' | 'erased'

export const QUICK_FILTERS: Array<{ key: QuickFilter; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'attention', label: 'Requiere atención' },
  { key: 'due_soon', label: `Vence en ${DUE_SOON_DAYS} días` },
  { key: 'inactive', label: 'Sin uso hace 30 días' },
  { key: 'no_sub', label: 'Sin suscripción' },
  { key: 'no_store', label: 'Tienda sin publicar' },
  { key: 'erased', label: 'Dadas de baja' },
]

/** Las dadas de baja solo aparecen en su propio filtro. */
export function matchesQuickFilter(org: SuperAdminOrganization, filter: QuickFilter, now: number) {
  const attention = getOrganizationAttention(org, now)
  if (filter === 'erased') return attention.erased
  if (attention.erased) return false
  switch (filter) {
    case 'all': return true
    case 'attention': return attention.rank < 4
    case 'due_soon': return attention.dueSoon
    case 'inactive': return attention.inactive
    case 'no_sub': return attention.noSubscription
    case 'no_store': return org.storefront_public === false
  }
}

export function countQuickFilters(rows: SuperAdminOrganization[], now: number) {
  const counts = Object.fromEntries(QUICK_FILTERS.map(({ key }) => [key, 0])) as Record<QuickFilter, number>
  for (const org of rows) {
    for (const { key } of QUICK_FILTERS) if (matchesQuickFilter(org, key, now)) counts[key] += 1
  }
  return counts
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

const MEDIUM_DATE = new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium', timeZone: PLATFORM_TIME_ZONE })
const SHORT_DATE = new Intl.DateTimeFormat('es-PY', { day: 'numeric', month: 'short', timeZone: PLATFORM_TIME_ZONE })
const ISO_DATE = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: PLATFORM_TIME_ZONE })

/** Siempre en hora de Paraguay: igual en el servidor y en el navegador. */
export function formatPlatformDate(value: string | null | undefined, style: 'medium' | 'short' | 'iso' = 'medium') {
  const time = timeOf(value)
  if (time === null) return style === 'iso' ? '' : '—'
  const formatter = style === 'short' ? SHORT_DATE : style === 'iso' ? ISO_DATE : MEDIUM_DATE
  return formatter.format(new Date(time))
}

/** «Vence 12 dic · en 24 d», «Prueba hasta 3 dic · en 2 d», «Venció hace 3 días». */
export function describeDue(org: SuperAdminOrganization, now: number): { label: string; urgent: boolean } | null {
  const due = dueDateOf(org)
  const timing = getSubscriptionTiming(normalizeSubscriptionStatus(org.subscription_status), org.trial_ends_at, org.current_period_ends_at, new Date(now))
  if (!due || !timing) return null
  const days = daysUntilDue(org, now) ?? 0
  if (days < 0) return { label: timing.label, urgent: true }
  const prefix = normalizeSubscriptionStatus(org.subscription_status) === 'trialing' ? 'Prueba hasta' : org.cancel_at_period_end ? 'Termina' : 'Vence'
  const when = days === 0 ? 'hoy' : `en ${days} d`
  return { label: `${prefix} ${formatPlatformDate(due, 'short')} · ${when}`, urgent: timing.urgent }
}

// ---------------------------------------------------------------------------
// Edición y exportación
// ---------------------------------------------------------------------------

/**
 * Lo que necesita el modal de edición. Antes la tarjeta armaba su propia
 * versión sin vencimientos ni pago, y «Extender 30 días» contaba desde hoy.
 */
export function toEditableOrganization(org: SuperAdminOrganization): EditableOrganization {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    subscription_status: org.subscription_status,
    payment_status: org.payment_status,
    trial_ends_at: org.trial_ends_at,
    current_period_ends_at: org.current_period_ends_at,
    cancel_at_period_end: org.cancel_at_period_end,
    currency: org.currency ?? null,
    timezone: org.timezone ?? null,
    business_vertical: org.business_vertical,
    operating_model: org.operating_model,
    enabled_modules: org.enabled_modules,
  }
}

const STATUS_EXPORT_LABELS: Record<string, string> = {
  active: 'Activa', trialing: 'En prueba', past_due: 'Vencida', unpaid: 'Impaga',
  suspended: 'Suspendida', canceled: 'Cancelada', expired: 'Expirada',
}

const PAYMENT_EXPORT_LABELS: Record<string, string> = {
  paid: 'Pagado', pending: 'Pendiente', unpaid: 'Impago', failed: 'Fallido', refunded: 'Reembolsado',
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function buildOrganizationsCsv(rows: SuperAdminOrganization[], now: number, planNames?: PlanNames) {
  const header = [
    'Nombre', 'Dirección', 'Plan', 'Suscripción', 'Pago', 'Vence', 'Cancela al vencer',
    'Dueño', 'Correo del dueño', 'Rubro', 'Último acceso del equipo', 'Última venta',
    'Productos', 'Equipo activo', 'Equipo total', 'Clientes web', 'Tienda publicada', 'Alta', 'Requiere atención',
  ]
  const body = rows.map((org) => {
    const status = normalizeSubscriptionStatus(org.subscription_status)
    const attention = getOrganizationAttention(org, now)
    return [
      org.name,
      `/${org.slug}`,
      planLabel(org.plan, planNames),
      status ? STATUS_EXPORT_LABELS[status] ?? status : 'Sin suscripción',
      org.payment_status ? PAYMENT_EXPORT_LABELS[org.payment_status.toLowerCase()] ?? org.payment_status : '',
      formatPlatformDate(dueDateOf(org), 'iso'),
      org.cancel_at_period_end ? 'Sí' : 'No',
      org.owner_name ?? '',
      org.owner_email ?? '',
      org.business_vertical ?? '',
      org.last_access_known ? formatPlatformDate(org.last_access_at, 'iso') || 'Nunca' : 'Sin dato',
      org.activity_known === false ? 'Sin dato' : formatPlatformDate(org.last_sale_at, 'iso'),
      org.products_total ?? '',
      org.staff_active,
      org.staff_total,
      org.customers_total,
      org.storefront_public == null ? '' : org.storefront_public ? 'Sí' : 'No',
      formatPlatformDate(org.created_at, 'iso'),
      attention.reasons.map((reason) => ATTENTION_LABELS[reason]).join(' · '),
    ]
  })
  return [header, ...body].map((row) => row.map(csvCell).join(',')).join('\n')
}

export const ATTENTION_LABELS: Record<AttentionReason, string> = {
  billing: 'Problema de cobro',
  trial_expired: 'Prueba vencida sin pago',
  due: 'Vence pronto',
  inactive: 'Sin uso hace 30 días',
  no_subscription: 'Sin suscripción',
}
