import type { SuperAdminSubscription } from './types'

export const PLAN_STYLES: Record<string, string> = {
  FREE: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
  BASIC: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300',
  PRO: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300',
  ENTERPRISE: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
}

export const STATUS_STYLES: Record<string, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  trialing: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300',
  past_due: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300',
  canceled: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300',
  suspended: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
  expired: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
  unpaid: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
  sin_estado: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
}

export function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(value))
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat('es-PY', {
    currency: 'USD',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value)
}

export function toDateTimeLocalValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export function daysUntil(value: string | null): number | null {
  if (!value) return null
  const today = new Date()
  const target = new Date(value)
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

export function periodProgress(subscription: SuperAdminSubscription) {
  if (!subscription.current_period_starts_at || !subscription.current_period_ends_at) return 0
  const start = new Date(subscription.current_period_starts_at).getTime()
  const end = new Date(subscription.current_period_ends_at).getTime()
  const now = Date.now()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
}

export function periodLabel(subscription: SuperAdminSubscription) {
  if (!subscription.current_period_starts_at && !subscription.current_period_ends_at) return 'Sin periodo'
  return `${formatDate(subscription.current_period_starts_at)} – ${formatDate(subscription.current_period_ends_at)}`
}

export function getRecommendation(subscription: SuperAdminSubscription) {
  const renewalDays = daysUntil(subscription.current_period_ends_at)
  const trialDays = daysUntil(subscription.trial_ends_at)

  if (['past_due', 'unpaid'].includes(subscription.status)) return 'Contactar por cobro pendiente'
  if (subscription.cancel_at_period_end) return 'Revisar retención antes del cierre'
  if (subscription.status === 'trialing' && trialDays !== null && trialDays <= 7 && trialDays >= 0) return 'Convertir trial a plan pago'
  if (renewalDays !== null && renewalDays <= 7 && renewalDays >= 0) return 'Confirmar renovación'
  if (renewalDays !== null && renewalDays < 0) return 'Actualizar periodo o estado'
  return 'Sin acción crítica'
}

export function isAttention(subscription: SuperAdminSubscription) {
  const renewalDays = daysUntil(subscription.current_period_ends_at)
  const trialDays = daysUntil(subscription.trial_ends_at)
  return (
    ['past_due', 'unpaid'].includes(subscription.status) ||
    subscription.cancel_at_period_end ||
    (renewalDays !== null && renewalDays <= 14) ||
    (trialDays !== null && trialDays >= 0 && trialDays <= 14)
  )
}

export function normalizeLimitValue(value: unknown) {
  if (value === null) return 'Ilimitado'
  if (typeof value === 'number') return new Intl.NumberFormat('es-PY').format(value)
  if (typeof value === 'string') return value
  return 'No definido'
}

export function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function daysLabel(days: number | null, type: 'renewal' | 'trial' = 'renewal') {
  if (days === null) return type === 'trial' ? 'No aplica' : 'Sin vencimiento'
  if (days < 0) return type === 'trial' ? 'Finalizado' : `${Math.abs(days)}d vencido`
  if (days === 0) return 'Hoy'
  return `${days}d`
}
