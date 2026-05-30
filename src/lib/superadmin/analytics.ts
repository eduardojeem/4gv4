import { createAdminSupabase } from '@/lib/supabase/admin'

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
  active: number
  inactive: number
}

export interface RevenueMetrics {
  mrr: number
  arr: number
  activeSubscriptions: number
  averageRevenuePerSub: number
}

export interface TopOrganization {
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

const PLAN_PRICES: Record<string, number> = {
  FREE: 0,
  BASIC: 29,
  STARTER: 29,
  PRO: 79,
  PROFESSIONAL: 79,
  ENTERPRISE: 199,
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('es-PY', { month: 'short' }).format(date)
}

function lastMonths(count: number) {
  const now = new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1)
    return {
      key: monthKey(date),
      label: monthLabel(date),
    }
  })
}

function normalizePlan(plan: string | null | undefined) {
  return (plan || 'FREE').toUpperCase()
}

export async function getSuperAdminAnalytics(): Promise<SuperAdminAnalyticsData> {
  const admin = createAdminSupabase()
  const months = lastMonths(6)

  const { data: organizations } = await admin
    .from('organizations')
    .select('id, name, plan, created_at')

  const { data: members } = await admin
    .from('organization_members')
    .select('organization_id, status, created_at')

  const orgRows = organizations ?? []
  const memberRows = members ?? []

  const growthData = months.map((month) => ({
    month: month.label,
    count: orgRows.filter((org) => org.created_at && monthKey(new Date(org.created_at)) === month.key).length,
  }))

  const planCounts = new Map<string, number>()
  orgRows.forEach((org) => {
    const plan = normalizePlan(org.plan)
    planCounts.set(plan, (planCounts.get(plan) ?? 0) + 1)
  })

  const planDistribution = Array.from(planCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const activityData = months.map((month) => {
    const rows = memberRows.filter((member) => member.created_at && monthKey(new Date(member.created_at)) === month.key)
    return {
      month: month.label,
      active: rows.filter((member) => member.status === 'active').length,
      inactive: rows.filter((member) => member.status !== 'active').length,
    }
  })

  const activePaidPlans = orgRows
    .map((org) => normalizePlan(org.plan))
    .filter((plan) => plan !== 'FREE')

  const mrr = activePaidPlans.reduce((sum, plan) => sum + (PLAN_PRICES[plan] ?? 0), 0)
  const activeSubscriptions = activePaidPlans.length

  const usersByOrg = new Map<string, number>()
  memberRows.forEach((member) => {
    usersByOrg.set(member.organization_id, (usersByOrg.get(member.organization_id) ?? 0) + 1)
  })

  const topOrganizations = orgRows
    .map((org) => ({
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
      mrr,
      arr: mrr * 12,
      activeSubscriptions,
      averageRevenuePerSub: activeSubscriptions > 0 ? mrr / activeSubscriptions : 0,
    },
    topOrganizations,
    generatedAt: new Date().toISOString(),
  }
}
