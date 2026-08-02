import { createAdminSupabase } from '@/lib/supabase/admin'
import { getCommercialPlanPrices, normalizePlanCode } from '@/lib/saas/subscription-service'
import { buildMonthSeries, calculateRecurringRevenue } from '@/lib/superadmin/metrics-calculations'

export interface GrowthDataPoint {
  month: string
  count: number
}

export interface PlanDistribution {
  name: string
  value: number
}

export interface ActivityDataPoint {
  month: string
  activeRegistrations: number
  otherRegistrations: number
}

export interface RevenueMetrics {
  mrr: number
  arr: number
  activeSubscriptions: number
  averageRevenuePerSub: number
}

export interface TopOrganization {
  id: string
  slug: string
  name: string
  user_count: number
}

export interface SuperAdminAnalyticsData {
  growthData: GrowthDataPoint[]
  planDistribution: PlanDistribution[]
  activityData: ActivityDataPoint[]
  revenueData: RevenueMetrics
  topOrganizations: TopOrganization[]
  generatedAt: string
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function normalizePlan(plan: string | null | undefined) {
  return normalizePlanCode(plan)
}

export async function getSuperAdminAnalytics(): Promise<SuperAdminAnalyticsData> {
  const admin = createAdminSupabase()
  const months = buildMonthSeries(12)
  const commercialPlanPricesPromise = getCommercialPlanPrices()

  const [organizationsResult, membersResult, subscriptionsResult, commercialPlanPrices] = await Promise.all([
    admin
      .from('organizations')
      .select('id, name, slug, plan, created_at'),
    admin
      .from('organization_members')
      .select('organization_id, status, created_at')
      .neq('role', 'customer'),
    admin
      .from('subscriptions')
      .select('organization_id, plan, status, payment_status'),
    commercialPlanPricesPromise,
  ])

  const queryError = [organizationsResult.error, membersResult.error, subscriptionsResult.error].find(Boolean)
  if (queryError) throw new Error(`No se pudieron cargar las analíticas: ${queryError.message}`)

  const orgRows = organizationsResult.data ?? []
  const memberRows = membersResult.data ?? []
  const subscriptionRows = subscriptionsResult.data ?? []
  const subscriptionsByOrg = new Map(subscriptionRows.map((subscription) => [subscription.organization_id, subscription]))

  const growthData = months.map((month) => ({
    month: month.label,
    count: orgRows.filter((org) => org.created_at && monthKey(new Date(org.created_at)) === month.key).length,
  }))

  const planCounts = new Map<string, number>()
  orgRows.forEach((org) => {
    const plan = normalizePlan(subscriptionsByOrg.get(org.id)?.plan ?? org.plan)
    planCounts.set(plan, (planCounts.get(plan) ?? 0) + 1)
  })

  const planDistribution = Array.from(planCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const activityData = months.map((month) => {
    const rows = memberRows.filter((member) => member.created_at && monthKey(new Date(member.created_at)) === month.key)
    return {
      month: month.label,
      activeRegistrations: rows.filter((member) => member.status === 'active').length,
      otherRegistrations: rows.filter((member) => member.status !== 'active').length,
    }
  })

  const revenueData = calculateRecurringRevenue(
    subscriptionRows.map((subscription) => ({
      plan: subscription.plan,
      status: subscription.status,
      paymentStatus: subscription.payment_status,
    })),
    commercialPlanPrices
  )

  const usersByOrg = new Map<string, number>()
  memberRows.forEach((member) => {
    usersByOrg.set(member.organization_id, (usersByOrg.get(member.organization_id) ?? 0) + 1)
  })

  const topOrganizations = orgRows
    .map((org) => ({
      id: org.id,
      slug: org.slug ?? '',
      name: org.name,
      user_count: usersByOrg.get(org.id) ?? 0,
    }))
    .sort((a, b) => b.user_count - a.user_count)
    .slice(0, 5)

  return {
    growthData,
    planDistribution,
    activityData,
    revenueData: {
      mrr: revenueData.mrr,
      arr: revenueData.arr,
      activeSubscriptions: revenueData.activeSubscriptions,
      averageRevenuePerSub: revenueData.averageRevenuePerSubscription,
    },
    topOrganizations,
    generatedAt: new Date().toISOString(),
  }
}
