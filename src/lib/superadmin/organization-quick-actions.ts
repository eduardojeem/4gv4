import { evaluateSubscriptionStatus } from '@/lib/saas/subscription-status'
import { toDateInput } from '@/lib/superadmin/organization-edit'

/**
 * Lo que necesita el superadmin para operar una suscripción de un vistazo:
 * cómo está hoy y atajos que dejan el estado y la fecha ya combinados (antes
 * había que armar «Activa» + fecha + pago a mano y era fácil dejarla bloqueada).
 */

export type SubscriptionSnapshot = {
  status: string | null
  payment_status?: string | null
  trial_ends_at?: string | null
  current_period_ends_at?: string | null
}

export type SubscriptionSummary = {
  tone: 'ok' | 'warn' | 'danger' | 'none'
  headline: string
  /** «vence el 23 de noviembre de 2026 (en 7 días)» o null sin fecha. */
  dueLine: string | null
  paymentLine: string | null
  blocked: boolean
}

const DAY = 86_400_000

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' })
}

function relative(iso: string, now: Date) {
  const days = Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY)
  if (days > 1) return `en ${days} días`
  if (days === 1) return 'mañana'
  if (days === 0) return 'hoy'
  return days === -1 ? 'venció ayer' : `venció hace ${-days} días`
}

export function summarizeSubscription(sub: SubscriptionSnapshot | null, now = new Date()): SubscriptionSummary {
  if (!sub?.status || sub.status === 'sin_registro') {
    return { tone: 'none', headline: 'Sin suscripción registrada', dueLine: null, paymentLine: null, blocked: false }
  }
  const evaluation = evaluateSubscriptionStatus({
    status: sub.status,
    paymentStatus: sub.payment_status ?? null,
    periodEndsAt: sub.current_period_ends_at ?? null,
    trialEndsAt: sub.trial_ends_at ?? null,
  }, now)
  const trialing = sub.status === 'trialing'
  const due = trialing ? sub.trial_ends_at : sub.current_period_ends_at
  const dueLine = due ? `${trialing ? 'Prueba hasta' : 'Vence'} el ${longDate(due)} (${relative(due, now)})` : null
  const paymentLine = sub.payment_status === 'paid' ? 'Pago al día' : sub.payment_status === 'unpaid' ? 'Pago pendiente' : null
  if (evaluation.isBlocked) {
    return { tone: 'danger', headline: 'Bloqueada: el comercio no puede operar', dueLine, paymentLine, blocked: true }
  }
  const daysLeft = due ? Math.ceil((new Date(due).getTime() - now.getTime()) / DAY) : null
  return {
    tone: daysLeft !== null && daysLeft <= 3 ? 'warn' : 'ok',
    headline: trialing ? 'En prueba' : 'Activa',
    dueLine,
    paymentLine,
    blocked: false,
  }
}

export type QuickActionKey = 'extend_30' | 'reactivate_month' | 'trial_7'

export const QUICK_ACTIONS: { key: QuickActionKey; label: string; hint: string }[] = [
  { key: 'extend_30', label: 'Extender 30 días', hint: 'Suma 30 días al vencimiento (o desde hoy si ya venció).' },
  { key: 'reactivate_month', label: 'Reactivar 1 mes', hint: 'Activa desde hoy por un mes, con el pago al día.' },
  { key: 'trial_7', label: 'Dar 7 días de prueba', hint: 'Deja la cuenta en prueba por 7 días desde hoy.' },
]

export type QuickActionResult = { status: 'active' | 'trialing'; current_period_ends_at?: string; trial_ends_at?: string }

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY)

/** Estado y fecha (como «AAAA-MM-DD» del campo) que deja cada atajo. */
export function applyQuickAction(key: QuickActionKey, sub: SubscriptionSnapshot | null, now = new Date()): QuickActionResult {
  if (key === 'trial_7') return { status: 'trialing', trial_ends_at: toDateInput(addDays(now, 7).toISOString()) ?? undefined }
  if (key === 'reactivate_month') {
    const until = new Date(now)
    until.setMonth(until.getMonth() + 1)
    return { status: 'active', current_period_ends_at: toDateInput(until.toISOString()) ?? undefined }
  }
  const currentEnd = sub?.current_period_ends_at ? new Date(sub.current_period_ends_at) : null
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now
  return { status: 'active', current_period_ends_at: toDateInput(addDays(base, 30).toISOString()) ?? undefined }
}

/** Funciones que el comercio gana o pierde al pasar de un plan a otro. */
export function planModuleDiff(fromModules: readonly string[] | null | undefined, toModules: readonly string[] | null | undefined) {
  if (!fromModules || !toModules) return { gained: [] as string[], lost: [] as string[] }
  const from = new Set(fromModules)
  const to = new Set(toModules)
  return {
    gained: [...to].filter((key) => !from.has(key)),
    lost: [...from].filter((key) => !to.has(key)),
  }
}
