/**
 * Prorrateo al cambiar entre planes pagos con un período vigente.
 *
 * Lo que queda sin usar del plan actual es un crédito:
 * - al subir a un plan más caro se descuenta del cobro (se paga la diferencia);
 * - al bajar a uno más barato (o de igual precio) no se devuelve plata: el
 *   crédito se convierte en días extra del plan nuevo.
 */

const DAY_MS = 86_400_000
const DAYS_PER_MONTH = 30

export type Proration = {
  /** Valor sin usar del plan actual, en guaraníes. */
  credit: number
  /** Lo que se cobra por el plan nuevo después del crédito. */
  chargeAmount: number
  /** Días que se suman al primer período del plan nuevo. */
  extraDays: number
  kind: 'upgrade' | 'downgrade'
}

export function computeProration(params: {
  currentPrice: number
  targetPrice: number
  periodStartsAt: string | null
  periodEndsAt: string | null
  now?: number
}): Proration | null {
  const now = params.now ?? Date.now()
  const start = params.periodStartsAt ? new Date(params.periodStartsAt).getTime() : NaN
  const end = params.periodEndsAt ? new Date(params.periodEndsAt).getTime() : NaN
  if (!(params.currentPrice > 0) || !(params.targetPrice > 0)) return null
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= now || end <= start) return null

  const remaining = Math.min(1, (end - now) / (end - start))
  const credit = Math.round(params.currentPrice * remaining)
  if (credit <= 0) return null

  if (params.targetPrice > params.currentPrice) {
    return {
      credit,
      chargeAmount: Math.max(1, Math.round(params.targetPrice - credit)),
      extraDays: 0,
      kind: 'upgrade',
    }
  }
  return {
    credit,
    chargeAmount: Math.round(params.targetPrice),
    extraDays: Math.min(366, Math.floor((credit / params.targetPrice) * DAYS_PER_MONTH)),
    kind: 'downgrade',
  }
}

export function prorationForChange(params: {
  currentPlanCode: string
  currentPrice: number
  targetPlanCode: string
  targetPrice: number
  subscription: { status?: string | null; current_period_starts_at?: string | null; current_period_ends_at?: string | null } | null
  now?: number
}) {
  if (params.currentPlanCode === params.targetPlanCode) return null
  if (params.subscription?.status !== 'active') return null
  return computeProration({
    currentPrice: params.currentPrice,
    targetPrice: params.targetPrice,
    periodStartsAt: params.subscription.current_period_starts_at ?? null,
    periodEndsAt: params.subscription.current_period_ends_at ?? null,
    now: params.now,
  })
}

export { DAY_MS as PRORATION_DAY_MS }
