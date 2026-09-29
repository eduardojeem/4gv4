import { createAdminSupabase } from '@/lib/supabase/admin'
import { FinancialDashboard, type FinancialData } from '@/components/superadmin/FinancialDashboard'
import { sumMoneyByCurrency } from '@/lib/superadmin/money-totals'
import {
  buildPlanPriceMap,
  calculateRecurringRevenue,
  normalizeRevenuePlan,
  planMonthlyPrice,
} from '@/lib/superadmin/metrics-calculations'
import { listPlatformExpenses } from '@/lib/superadmin/platform-expenses'
import { summarizePlatformFinance, todayInParaguay } from '@/lib/superadmin/platform-finance'

export const dynamic = 'force-dynamic'

const DAY_MS = 86_400_000

type SubscriptionRow = {
  id: string
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
  ] = await Promise.all([
    // Todos los planes: uno retirado se sigue cobrando a quien ya lo tiene.
    admin.from('subscription_plans').select('tier, name, price'),
    admin.from('subscriptions').select('id, plan, status, payment_status, current_period_ends_at, cancel_at_period_end, created_at, updated_at'),
    admin.from('subscription_payments').select('amount, currency, status, paid_at').eq('status', 'paid').gte('paid_at', new Date(monthAgo).toISOString()),
    listPlatformExpenses(),
  ])

  if (plansError || subscriptionsError || paymentsError) {
    throw new Error(plansError?.message || subscriptionsError?.message || paymentsError?.message || 'No se pudieron cargar los datos financieros.')
  }

  const planRows = (plans ?? []) as Array<{ tier: string; name: string; price: number }>
  const prices = buildPlanPriceMap(planRows)
  const priceOf = (plan: string | null) => planMonthlyPrice(prices, plan) ?? 0
  const subscriptions = (subs ?? []) as SubscriptionRow[]
  const revenueOf = (rows: SubscriptionRow[]) =>
    calculateRecurringRevenue(
      rows.map((s) => ({ plan: s.plan, status: s.status, paymentStatus: s.payment_status })),
      prices,
    )

  const revenue = revenueOf(subscriptions)
  const active = subscriptions.filter((s) => s.status === 'active')
  const trialing = subscriptions.filter((s) => s.status === 'trialing')
  const pastDue = subscriptions.filter((s) => s.status === 'past_due' || s.status === 'unpaid')

  // Bajas de los últimos 30 días: canceladas o suspendidas en ese período.
  const lostLast30 = subscriptions.filter((s) =>
    ['canceled', 'cancelled', 'suspended'].includes(s.status ?? '') &&
    (s.updated_at ? new Date(s.updated_at).getTime() : 0) >= monthAgo,
  )
  const churnRate = active.length + lostLast30.length > 0
    ? Math.round((lostLast30.length / (active.length + lostLast30.length)) * 1000) / 10
    : 0

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
        { mrr: revenue.mrr, payingOrgs: revenue.activeSubscriptions - revenue.unpricedSubscriptions },
        todayInParaguay(),
      )
    : null

  return {
    mrr: revenue.mrr,
    arr: revenue.arr,
    billingSubscriptions: revenue.activeSubscriptions,
    unpricedSubscriptions: revenue.unpricedSubscriptions,
    potentialMrr: trialing.reduce((sum, s) => sum + priceOf(s.plan), 0),
    churnedMrr: lostLast30.reduce((sum, s) => sum + priceOf(s.plan), 0),
    churnRate,
    collectedLast30: sumMoneyByCurrency(
      ((payments ?? []) as Array<{ amount: number; currency: string }>).map((p) => ({ amount: p.amount, currency: p.currency })),
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
        mrr: revenueOf(rows).mrr,
      }))
      .sort((a, b) => b.mrr - a.mrr || b.active - a.active),
  }
}

export default async function SuperAdminBillingPage() {
  const data = await getFinancialData()
  return <FinancialDashboard data={data} />
}
