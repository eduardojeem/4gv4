import { createAdminSupabase } from '@/lib/supabase/admin'
import { FinancialDashboard, type FinancialData } from '@/components/superadmin/FinancialDashboard'

async function getFinancialData(): Promise<FinancialData> {
  const admin = createAdminSupabase()

  const [{ data: plans }, { data: subs }, { data: payments }] = await Promise.all([
    admin.from('subscription_plans').select('tier, name, price, is_active').eq('is_active', true),
    admin.from('subscriptions').select('id, organization_id, plan, status, trial_ends_at, current_period_ends_at, cancel_at_period_end, created_at, updated_at'),
    admin.from('subscription_payments').select('amount, currency, status, paid_at, created_at, provider, plan_id'),
  ])

  // Price lookup by plan tier
  const priceByTier = new Map<string, number>()
  ;((plans ?? []) as Array<{ tier: string; price: number }>).forEach((p) => {
    priceByTier.set(p.tier.toUpperCase(), Number(p.price) || 0)
  })

  const subscriptions = (subs ?? []) as Array<{
    id: string; organization_id: string; plan: string | null; status: string | null
    trial_ends_at: string | null; current_period_ends_at: string | null
    cancel_at_period_end: boolean | null; created_at: string | null; updated_at: string | null
  }>

  // MRR / ARR — sumar precios de subs active
  const activeSubs = subscriptions.filter((s) => s.status === 'active')
  const trialingSubs = subscriptions.filter((s) => s.status === 'trialing')
  const pastDueSubs = subscriptions.filter((s) => s.status === 'past_due' || s.status === 'unpaid')
  const suspendedSubs = subscriptions.filter((s) => s.status === 'suspended')
  const canceledSubs = subscriptions.filter((s) => s.status === 'canceled' || s.status === 'cancelled')
  const cancelingSoon = subscriptions.filter((s) => s.cancel_at_period_end)

  const mrr = activeSubs.reduce((sum, s) => sum + (priceByTier.get((s.plan ?? 'FREE').toUpperCase()) ?? 0), 0)
  const arr = mrr * 12

  // MRR potencial (trials que pasarán a active si pagan)
  const potentialMrr = trialingSubs.reduce((sum, s) => sum + (priceByTier.get((s.plan ?? 'FREE').toUpperCase()) ?? 0), 0)

  // MRR perdido (suscripciones canceladas o suspendidas en últimos 30d)
  const monthAgo = Date.now() - 30 * 86400000
  const lostThisMonth = [...canceledSubs, ...suspendedSubs].filter((s) => {
    const updated = s.updated_at ? new Date(s.updated_at).getTime() : 0
    return updated >= monthAgo
  })
  const churnedMrr = lostThisMonth.reduce((sum, s) => sum + (priceByTier.get((s.plan ?? 'FREE').toUpperCase()) ?? 0), 0)

  // Churn rate (canceled+suspended últimos 30d / total active de hace 30d)
  // Aproximación: churn = lostThisMonth / (active + lostThisMonth)
  const churnRate = (activeSubs.length + lostThisMonth.length) > 0
    ? Math.round((lostThisMonth.length / (activeSubs.length + lostThisMonth.length)) * 1000) / 10
    : 0

  // Renewals soon (próximos 14 días)
  const fortnightFromNow = Date.now() + 14 * 86400000
  const renewalsSoon = activeSubs.filter((s) => {
    if (!s.current_period_ends_at) return false
    const ends = new Date(s.current_period_ends_at).getTime()
    return ends >= Date.now() && ends <= fortnightFromNow
  })

  // Revenue real (de subscription_payments)
  const paidPayments = ((payments ?? []) as Array<{
    amount: number; currency: string; status: string; paid_at: string | null; created_at: string | null; provider: string | null; plan_id: string | null
  }>).filter((p) => p.status === 'paid')

  const totalRevenue = paidPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const monthlyRevenue = paidPayments
    .filter((p) => (p.paid_at ? new Date(p.paid_at).getTime() : 0) >= monthAgo)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  // Revenue por plan
  const revenueByPlan = new Map<string, number>()
  paidPayments.forEach((p) => {
    const tier = (p.plan_id ?? 'unknown').toUpperCase()
    revenueByPlan.set(tier, (revenueByPlan.get(tier) ?? 0) + Number(p.amount))
  })

  // Subscripciones por plan
  const subsByPlan = new Map<string, { total: number; active: number; trialing: number; mrr: number }>()
  subscriptions.forEach((s) => {
    const tier = (s.plan ?? 'FREE').toUpperCase()
    const entry = subsByPlan.get(tier) ?? { total: 0, active: 0, trialing: 0, mrr: 0 }
    entry.total++
    if (s.status === 'active') {
      entry.active++
      entry.mrr += priceByTier.get(tier) ?? 0
    }
    if (s.status === 'trialing') entry.trialing++
    subsByPlan.set(tier, entry)
  })

  // Growth: comparar suscripciones nuevas últimos 30d vs 30d previos
  const twoMonthsAgo = Date.now() - 60 * 86400000
  const newLast30 = subscriptions.filter((s) => {
    const created = s.created_at ? new Date(s.created_at).getTime() : 0
    return created >= monthAgo
  }).length
  const newPrev30 = subscriptions.filter((s) => {
    const created = s.created_at ? new Date(s.created_at).getTime() : 0
    return created >= twoMonthsAgo && created < monthAgo
  }).length
  const growthPercent = newPrev30 > 0
    ? Math.round(((newLast30 - newPrev30) / newPrev30) * 100)
    : (newLast30 > 0 ? 100 : 0)

  return {
    mrr, arr, potentialMrr, churnedMrr, churnRate,
    totalRevenue, monthlyRevenue,
    counts: {
      total: subscriptions.length,
      active: activeSubs.length,
      trialing: trialingSubs.length,
      pastDue: pastDueSubs.length,
      suspended: suspendedSubs.length,
      canceled: canceledSubs.length,
      cancelingSoon: cancelingSoon.length,
      renewalsSoon: renewalsSoon.length,
      newLast30,
      growthPercent,
    },
    subsByPlan: Array.from(subsByPlan.entries())
      .map(([tier, v]) => ({ tier, ...v, planName: plans?.find((p: { tier: string; name: string }) => p.tier.toUpperCase() === tier)?.name ?? tier }))
      .sort((a, b) => b.mrr - a.mrr),
    revenueByPlan: Array.from(revenueByPlan.entries())
      .map(([tier, revenue]) => ({ tier, revenue }))
      .sort((a, b) => b.revenue - a.revenue),
    paymentCount: paidPayments.length,
    fetchedAt: new Date().toISOString(),
  }
}

export default async function SuperAdminBillingPage() {
  const data = await getFinancialData()
  return <FinancialDashboard data={data} />
}
