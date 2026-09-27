import { getPlanLimit, type OrganizationUsage, type PlanRecord, type ResourceType } from '@/lib/saas/subscription-service'

/**
 * Como se muestra una suscripcion.
 *
 * La pantalla del servidor y la del cliente tenian cada una su copia de los
 * rotulos, los colores, el formato de plata y el calculo de cupos. Las dos
 * listas de recursos ya no coincidian del todo, asi que el «uso promedio» del
 * encabezado y el desglose de abajo podian contar cosas distintas.
 */

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  trialing: 'Prueba',
  past_due: 'Pago vencido',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
  expired: 'Expirado',
  unpaid: 'Impago',
  manual: 'Manual',
  paid: 'Pagado',
  pending: 'Pendiente',
  failed: 'Fallido',
  refunded: 'Reembolsado',
  sin_estado: 'Sin estado',
}

export function subscriptionStatusLabel(status?: string | null) {
  if (!status) return SUBSCRIPTION_STATUS_LABELS.sin_estado
  return SUBSCRIPTION_STATUS_LABELS[status] || status
}

/** Que tan bien va algo. El color sale de aca, nunca de una clase suelta. */
export type SubscriptionTone = 'ok' | 'info' | 'warn' | 'danger' | 'neutral'

export function subscriptionStatusTone(status?: string | null): SubscriptionTone {
  if (status === 'active' || status === 'paid') return 'ok'
  if (status === 'trialing') return 'info'
  if (status === 'past_due' || status === 'pending') return 'warn'
  if (status === 'suspended' || status === 'unpaid' || status === 'failed') return 'danger'
  return 'neutral'
}

/** Pastilla de estado. */
export const TONE_BADGE: Record<SubscriptionTone, string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
  info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300',
  warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
  danger: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300',
  neutral: 'border-border bg-muted text-muted-foreground',
}

/** El puntito o la barra: solo el color de fondo. */
export const TONE_DOT: Record<SubscriptionTone, string> = {
  ok: 'bg-emerald-500',
  info: 'bg-sky-500',
  warn: 'bg-amber-500',
  danger: 'bg-rose-500',
  neutral: 'bg-muted-foreground/40',
}

/** El numero grande cuando hay que mirarlo. */
export const TONE_TEXT: Record<SubscriptionTone, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  info: 'text-sky-600 dark:text-sky-400',
  warn: 'text-amber-600 dark:text-amber-400',
  danger: 'text-rose-600 dark:text-rose-400',
  neutral: 'text-foreground',
}

export function money(value: number, currency = 'PYG') {
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

export function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(value))
}

/** Dias que faltan para una fecha. Negativo si ya paso. */
export function daysUntil(value?: string | null, now = Date.now()): number | null {
  if (!value) return null
  const target = new Date(value).getTime()
  if (!Number.isFinite(target)) return null
  return Math.ceil((target - now) / 86_400_000)
}

/** Los recursos que ocupan cupo, en el orden en que se muestran. */
export const QUOTA_RESOURCES: ResourceType[] = ['users', 'branches', 'cashRegisters', 'products', 'categories']

/**
 * Cuanto se uso de un cupo. `null` es ilimitado: no es 0% ni 100%, es otra cosa.
 *
 * Un cupo en 0 con algo cargado da 100: antes daba 0% y la tarjeta decia
 * «Disponible» junto a «0 libres».
 */
export function usagePercent(current: number, limit: number | null): number | null {
  if (limit === null) return null
  if (limit <= 0) return current > 0 ? 100 : 0
  return Math.min(100, Math.round((current / limit) * 100))
}

export function quotaTone(percent: number | null): SubscriptionTone {
  if (percent === null) return 'ok'
  if (percent >= 100) return 'danger'
  if (percent >= 80) return 'warn'
  return 'neutral'
}

/** Promedio sobre los cupos que tienen tope. Los ilimitados no promedian. */
export function averageUsagePercent(plan: PlanRecord, usage: OrganizationUsage): number {
  const percents = QUOTA_RESOURCES
    .map((resource) => usagePercent(usage[resource] ?? 0, getPlanLimit(plan, resource)))
    .filter((percent): percent is number => percent !== null)

  if (percents.length === 0) return 0
  return Math.round(percents.reduce((sum, percent) => sum + percent, 0) / percents.length)
}

/** Cuantos cupos estan al 80% o mas. Es el numero que dispara el aviso. */
export function quotasNeedingAttention(plan: PlanRecord, usage: OrganizationUsage): number {
  return QUOTA_RESOURCES.filter((resource) => {
    const percent = usagePercent(usage[resource] ?? 0, getPlanLimit(plan, resource))
    return percent !== null && percent >= 80
  }).length
}
