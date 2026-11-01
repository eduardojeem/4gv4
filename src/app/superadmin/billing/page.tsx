import { createAdminSupabase } from '@/lib/supabase/admin'
import { FinancialDashboard, type FinancialData } from '@/components/superadmin/FinancialDashboard'
import { sumMoneyByCurrency } from '@/lib/superadmin/money-totals'
import {
  buildPlanPriceMap,
  normalizeRevenuePlan,
  planMonthlyPrice,
} from '@/lib/superadmin/metrics-calculations'
import { computeBillingMetrics } from '@/lib/superadmin/billing-metrics'
import { listPlatformExpenses } from '@/lib/superadmin/platform-expenses'
import { summarizePlatformFinance, todayInParaguay } from '@/lib/superadmin/platform-finance'

export const dynamic = 'force-dynamic'

const DAY_MS = 86_400_000

type SubscriptionRow = {
  id: string
  organization_id: string
  plan: string | null
  status: string | null
  payment_status: string | null
  current_period_ends_at: string | null
  cancel_at_period_end: boolean | null
  created_at: string | null
  updated_at: string | null
}

async function getFinancialData(): Promise<FinancialData> {
  const admin = createAdminSupabase()
  const now = Date.now()
  const monthAgo = now - 30 * DAY_MS

  const [
    { data: plans, error: plansError },
    { data: subs, error: subscriptionsError },
    { data: payments, error: paymentsError },
    expensesResult,
    { count: pendingTransfers },
  ] = await Promise.all([
    // Todos los planes: uno retirado se sigue cobrando a quien ya lo tiene.
    admin.from('subscription_plans').select('tier, name, price'),
    admin.from('subscriptions').select('id, organization_id, plan, status, payment_status, current_period_ends_at, cancel_at_period_end, created_at, updated_at'),
    // Dos meses: el actual para el MRR cobrado y el anterior para las bajas.
    admin.from('subscription_payments').select('organization_id, amount, currency, status, paid_at').eq('status', 'paid').gte('paid_at', new Date(now - 60 * DAY_MS).toISOString()),
    listPlatformExpenses(),
    admin.from('subscription_bank_transfer_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
  ])

  if (plansError || subscriptionsError || paymentsError) {
    throw new Error(plansError?.message || subscriptionsError?.message || paymentsError?.message || 'No se pudieron cargar los datos financieros.')
  }

  const planRows = (plans ?? []) as Array<{ tier: string; name: string; price: number }>
  const prices = buildPlanPriceMap(planRows)
  const priceOf = (plan: string | null) => planMonthlyPrice(prices, plan) ?? 0
  const subscriptions = (subs ?? []) as SubscriptionRow[]
  const paymentRows = (payments ?? []) as Array<{ organization_id: string; amount: number; currency: string; status: string; paid_at: string | null }>
  const metrics = computeBillingMetrics(subscriptions, paymentRows, prices, now)
  const active = subscriptions.filter((s) => s.status === 'active')
  const trialing = subscriptions.filter((s) => s.status === 'trialing')
  const pastDue = subscriptions.filter((s) => s.status === 'past_due' || s.status === 'unpaid')

  const renewalsSoon = active.filter((s) => {
    const ends = s.current_period_ends_at ? new Date(s.current_period_ends_at).getTime() : 0
    return ends >= now && ends <= now + 14 * DAY_MS
  }).length

  const createdAt = (s: SubscriptionRow) => (s.created_at ? new Date(s.created_at).getTime() : 0)
  const newLast30 = subscriptions.filter((s) => createdAt(s) >= monthAgo).length
  const newPrev30 = subscriptions.filter((s) => createdAt(s) >= now - 60 * DAY_MS && createdAt(s) < monthAgo).length
  const growthPercent = newPrev30 > 0
    ? Math.round(((newLast30 - newPrev30) / newPrev30) * 100)
    : (newLast30 > 0 ? 100 : 0)

  const byTier = new Map<string, SubscriptionRow[]>()
  subscriptions.forEach((s) => {
    const tier = normalizeRevenuePlan(s.plan)
    byTier.set(tier, [...(byTier.get(tier) ?? []), s])
  })

  const costs = 'expenses' in expensesResult
    ? summarizePlatformFinance(
        expensesResult.expenses,
        { mrr: metrics.mrr, payingOrgs: metrics.billingSubscriptions - metrics.unpricedSubscriptions },
        todayInParaguay(),
      )
    : null

  return {
    mrr: metrics.mrr,
    arr: metrics.mrr * 12,
    billingSubscriptions: metrics.billingSubscriptions,
    unpricedSubscriptions: metrics.unpricedSubscriptions,
    uncollectedSubscriptions: metrics.uncollectedSubscriptions,
    churnedOrganizations: metrics.churnedOrganizations,
    pendingTransfers: pendingTransfers ?? 0,
    potentialMrr: trialing.reduce((sum, s) => sum + priceOf(s.plan), 0),
    churnedMrr: metrics.churnedMrr,
    churnRate: metrics.churnRate,
    collectedLast30: sumMoneyByCurrency(
      paymentRows
        .filter((p) => (p.paid_at ? new Date(p.paid_at).getTime() : 0) >= monthAgo)
        .map((p) => ({ amount: p.amount, currency: p.currency })),
    ),
    costs: costs
      ? { recurringMonthlyCost: costs.recurringMonthlyCost, netMonthly: costs.netMonthly, marginPercent: costs.marginPercent }
      : null,
    counts: {
      trialing: trialing.length,
      pastDue: pastDue.length,
      cancelingSoon: subscriptions.filter((s) => s.cancel_at_period_end).length,
      renewalsSoon,
      newLast30,
      growthPercent,
    },
    subsByPlan: Array.from(byTier.entries())
      .map(([tier, rows]) => ({
        tier,
        planName: planRows.find((p) => normalizeRevenuePlan(p.tier) === tier)?.name ?? tier,
        active: rows.filter((s) => s.status === 'active').length,
        trialing: rows.filter((s) => s.status === 'trialing').length,
        mrr: metrics.mrrByPlan[tier] ?? 0,
      }))
      .sort((a, b) => b.mrr - a.mrr || b.active - a.active),
  }
}

export default async function SuperAdminBillingPage() {
  const data = await getFinancialData()
  return <FinancialDashboard data={data} />
}
