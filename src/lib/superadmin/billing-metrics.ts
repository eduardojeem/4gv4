import { normalizeRevenuePlan, planMonthlyPrice, type PlanPrices } from '@/lib/superadmin/metrics-calculations'

/**
 * Métricas de cobro de la plataforma a partir de lo que se cobró de verdad.
 *
 * - MRR: por cada suscripción que factura, el último pago cobrado del mes (con
 *   descuentos); si no hay pago registrado se usa el precio de lista y se la
 *   cuenta aparte como "sin cobro" (activación manual o por código).
 * - Bajas: comercios que pagaron el mes anterior y este mes ya no están en un
 *   plan pago. Antes solo contaban los estados cancelada/suspendida, que casi
 *   no ocurren: cancelar o dejar de pagar termina en Gratuito "activo".
 */

const DAY_MS = 86_400_000

export type BillingSubscription = {
  organization_id: string
  plan: string | null
  status: string | null
  payment_status: string | null
}

export type BillingPayment = {
  organization_id: string
  amount: number
  status: string
  paid_at: string | null
}

export type BillingMetrics = {
  mrr: number
  billingSubscriptions: number
  unpricedSubscriptions: number
  /** Facturan sin un pago registrado en el último mes. */
  uncollectedSubscriptions: number
  churnedOrganizations: number
  churnedMrr: number
  churnRate: number
  mrrByPlan: Record<string, number>
}

function isBillable(subscription: BillingSubscription) {
  return subscription.status === 'active'
    && normalizeRevenuePlan(subscription.plan) !== 'FREE'
    && !['failed', 'refunded', 'unpaid'].includes(subscription.payment_status?.toLowerCase() ?? '')
}

export function computeBillingMetrics(
  subscriptions: BillingSubscription[],
  payments: BillingPayment[],
  prices: PlanPrices,
  now = Date.now(),
): BillingMetrics {
  const currentStart = now - 30 * DAY_MS
  const previousStart = now - 60 * DAY_MS
  const lastPaidThisMonth = new Map<string, { amount: number; at: number }>()
  const lastPaidPreviousMonth = new Map<string, number>()

  for (const payment of payments) {
    if (payment.status !== 'paid' || !payment.paid_at) continue
    const at = new Date(payment.paid_at).getTime()
    if (!Number.isFinite(at)) continue
    if (at >= currentStart) {
      const current = lastPaidThisMonth.get(payment.organization_id)
      if (!current || at > current.at) lastPaidThisMonth.set(payment.organization_id, { amount: Number(payment.amount), at })
    } else if (at >= previousStart) {
      lastPaidPreviousMonth.set(payment.organization_id, Number(payment.amount))
    }
  }

  let mrr = 0
  let billingSubscriptions = 0
  let unpricedSubscriptions = 0
  let uncollectedSubscriptions = 0
  const mrrByPlan: Record<string, number> = {}
  const billingOrganizations = new Set<string>()

  for (const subscription of subscriptions) {
    if (!isBillable(subscription)) continue
    billingSubscriptions += 1
    billingOrganizations.add(subscription.organization_id)
    const tier = normalizeRevenuePlan(subscription.plan)
    const paid = lastPaidThisMonth.get(subscription.organization_id)
    let amount: number | null = paid?.amount ?? null
    if (amount === null) {
      uncollectedSubscriptions += 1
      amount = planMonthlyPrice(prices, subscription.plan)
      if (amount === null) {
        unpricedSubscriptions += 1
        continue
      }
    }
    mrr += amount
    mrrByPlan[tier] = (mrrByPlan[tier] ?? 0) + amount
  }

  let churnedOrganizations = 0
  let churnedMrr = 0
  lastPaidPreviousMonth.forEach((amount, organizationId) => {
    if (billingOrganizations.has(organizationId) || lastPaidThisMonth.has(organizationId)) return
    churnedOrganizations += 1
    churnedMrr += amount
  })
  const payersPreviousMonth = lastPaidPreviousMonth.size

  return {
    mrr,
    billingSubscriptions,
    unpricedSubscriptions,
    uncollectedSubscriptions,
    churnedOrganizations,
    churnedMrr,
    churnRate: payersPreviousMonth > 0 ? Math.round((churnedOrganizations / payersPreviousMonth) * 1000) / 10 : 0,
    mrrByPlan,
  }
}
