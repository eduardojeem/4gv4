import { evaluateSubscriptionStatus } from '@/lib/saas/subscription-status'
import { DEFAULT_LIMITS, normalizePlanCode } from '@/lib/saas/subscription-service'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { chunkValues, fetchAllRows } from '@/lib/superadmin/fetch-all-rows'
import {
  calculateRoundedDistribution,
  calculateUsagePercent,
  countCashRegistersByOrganization,
} from '@/lib/superadmin/metrics-calculations'

export type ResourceKey = 'users' | 'products' | 'branches' | 'cashRegisters' | 'categories'

export type OrgUsageRow = {
  id: string
  name: string
  slug: string
  plan: string
  planCode: string
  contractedPlanCode: string
  subscriptionStatus: string | null
  paymentStatus: string | null
  subscriptionBlocked: boolean
  subscriptionExpired: boolean
  trialEndsAt: string | null
  periodEndsAt: string | null
  usage: Record<ResourceKey, number>
  limits: Record<ResourceKey, number | null>
  overallPercent: number
  nearLimit: boolean
  atRisk: boolean
  overLimit: boolean
}

export type SaasMetricsData = {
  orgs: OrgUsageRow[]
  summary: {
    total: number
    atRisk: number
    nearLimit: number
    overLimit: number
    blocked: number
  }
  planDistribution: Array<{ plan: string; count: number; percent: number }>
  statusDistribution: Array<{ status: string; count: number }>
  mostConstrainedResource: { key: ResourceKey; label: string; avgPercent: number } | null
  fetchedAt: string
}

const RESOURCE_LABELS: Record<ResourceKey, string> = {
  users: 'Usuarios',
  products: 'Productos',
  branches: 'Sucursales',
  cashRegisters: 'Cajas',
  categories: 'Categorías',
}

type PageResult<T> = PromiseLike<{
  data: T[] | null
  error: { message: string } | null
}>

function calcPercent(current: number, limit: number | null): number {
  return calculateUsagePercent(current, limit)
}

function calcOverall(usage: Record<ResourceKey, number>, limits: Record<ResourceKey, number | null>): number {
  const percentages = (Object.keys(limits) as ResourceKey[])
    .filter((key) => limits[key] !== null)
    .map((key) => calcPercent(usage[key], limits[key]))

  return percentages.length ? Math.max(...percentages) : 0
}

function countByOrg(rows: Array<{ organization_id: string | null }>, orgIds: Set<string>) {
  const counts = new Map<string, number>()
  orgIds.forEach((id) => counts.set(id, 0))
  rows.forEach((row) => {
    if (row.organization_id && counts.has(row.organization_id)) {
      counts.set(row.organization_id, (counts.get(row.organization_id) ?? 0) + 1)
    }
  })
  return counts
}

async function fetchChunkedRows<T>(
  chunks: string[][],
  fetchPage: (ids: string[], from: number, to: number) => PageResult<T>
) {
  const pages = await Promise.all(
    chunks.map((ids) => fetchAllRows<T>((from, to) => fetchPage(ids, from, to)))
  )
  return pages.flat()
}

export async function getSaasMetrics(): Promise<SaasMetricsData> {
  const admin = createAdminSupabase()
  const orgs = await fetchAllRows<{
    id: string
    name: string
    slug: string | null
    plan: string | null
  }>((from, to) => admin
    .from('organizations')
    .select('id, name, slug, plan')
    .order('name', { ascending: true })
    .range(from, to))
  const orgIds = new Set(orgs.map((organization) => organization.id))

  if (orgs.length === 0) {
    return {
      orgs: [],
      summary: { total: 0, atRisk: 0, nearLimit: 0, overLimit: 0, blocked: 0 },
      planDistribution: [],
      statusDistribution: [],
      mostConstrainedResource: null,
      fetchedAt: new Date().toISOString(),
    }
  }

  const organizationChunks = chunkValues(Array.from(orgIds))
  const [subscriptions, memberRows, productRows, branchRows, categoryRows, plansResult] = await Promise.all([
    fetchChunkedRows(organizationChunks, (ids, from, to) => admin
      .from('subscriptions')
      .select('organization_id, plan, status, payment_status, trial_ends_at, current_period_ends_at')
      .in('organization_id', ids)
      .range(from, to)),
    fetchChunkedRows(organizationChunks, (ids, from, to) => admin
      .from('organization_members')
      .select('organization_id')
      .in('organization_id', ids)
      .neq('role', 'customer')
      .eq('status', 'active')
      .range(from, to)),
    fetchChunkedRows(organizationChunks, (ids, from, to) => admin
      .from('products')
      .select('organization_id')
      .in('organization_id', ids)
      .range(from, to)),
    fetchChunkedRows(organizationChunks, (ids, from, to) => admin
      .from('branches')
      .select('id, organization_id')
      .in('organization_id', ids)
      .range(from, to)),
    fetchChunkedRows(organizationChunks, (ids, from, to) => admin
      .from('categories')
      .select('organization_id')
      .in('organization_id', ids)
      .range(from, to)),
    admin.from('plans').select('code, limits').eq('is_active', true),
  ])

  if (plansResult.error) {
    throw new Error(`No se pudieron cargar los límites de planes: ${plansResult.error.message}`)
  }

  const branchChunks = chunkValues(branchRows.map((branch) => branch.id))
  const cashRegisterRows = branchChunks.length === 0
    ? []
    : await fetchChunkedRows(branchChunks, (ids, from, to) => admin
        .from('cash_registers')
        .select('branch_id')
        .in('branch_id', ids)
        .range(from, to))

  const subsByOrg = new Map(
    subscriptions.map((subscription) => [subscription.organization_id, subscription])
  )
  const limitsByPlan = new Map(
    (plansResult.data ?? []).map((plan) => [
      normalizePlanCode(plan.code),
      (plan.limits && typeof plan.limits === 'object' ? plan.limits : {}) as Record<string, number | null>,
    ])
  )
  const memberCounts = countByOrg(memberRows, orgIds)
  const productCounts = countByOrg(productRows, orgIds)
  const branchCounts = countByOrg(branchRows, orgIds)
  const cashRegisterCounts = countCashRegistersByOrganization(
    branchRows.map((branch) => ({ id: branch.id, organizationId: branch.organization_id })),
    cashRegisterRows.map((register) => ({ branchId: register.branch_id }))
  )
  const categoryCounts = countByOrg(categoryRows, orgIds)

  const orgRows: OrgUsageRow[] = orgs.map((organization) => {
    const subscription = subsByOrg.get(organization.id)
    const contractedPlanCode = normalizePlanCode(subscription?.plan ?? organization.plan ?? 'FREE')
    const subscriptionAccess = evaluateSubscriptionStatus({
      status: subscription?.status,
      paymentStatus: subscription?.payment_status,
      trialEndsAt: subscription?.trial_ends_at,
      periodEndsAt: subscription?.current_period_ends_at,
    })
    const planCode = subscriptionAccess.isExpired ? normalizePlanCode('FREE') : contractedPlanCode
    const planLimits = {
      ...(DEFAULT_LIMITS[planCode] ?? DEFAULT_LIMITS.FREE),
      ...(limitsByPlan.get(planCode) ?? {}),
    }
    const limits: Record<ResourceKey, number | null> = {
      users: planLimits.users ?? null,
      products: planLimits.products ?? null,
      branches: planLimits.branches ?? null,
      cashRegisters: planLimits.cashRegisters ?? null,
      categories: planLimits.categories ?? null,
    }
    const usage: Record<ResourceKey, number> = {
      users: memberCounts.get(organization.id) ?? 0,
      products: productCounts.get(organization.id) ?? 0,
      branches: branchCounts.get(organization.id) ?? 0,
      cashRegisters: cashRegisterCounts.get(organization.id) ?? 0,
      categories: categoryCounts.get(organization.id) ?? 0,
    }
    const overallPercent = calcOverall(usage, limits)
    const resourcePercents = (Object.keys(limits) as ResourceKey[])
      .map((key) => calcPercent(usage[key], limits[key]))
    const overLimit = resourcePercents.some((percent) => percent > 100)
    const atRisk = !overLimit && resourcePercents.some((percent) => percent >= 80)
    const nearLimit = !atRisk && !overLimit && resourcePercents.some((percent) => percent >= 60)

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug ?? '',
      plan: planCode,
      planCode,
      contractedPlanCode,
      subscriptionStatus: subscription?.status ?? null,
      paymentStatus: subscription?.payment_status ?? null,
      subscriptionBlocked: subscriptionAccess.isBlocked,
      subscriptionExpired: subscriptionAccess.isExpired,
      trialEndsAt: subscription?.trial_ends_at ?? null,
      periodEndsAt: subscription?.current_period_ends_at ?? null,
      usage,
      limits,
      overallPercent,
      nearLimit,
      atRisk,
      overLimit,
    }
  })

  const planMap = new Map<string, number>()
  orgRows.forEach((organization) => {
    planMap.set(organization.plan, (planMap.get(organization.plan) ?? 0) + 1)
  })
  const planEntries = Array.from(planMap.entries()).sort((left, right) => right[1] - left[1])
  const roundedPlanPercents = calculateRoundedDistribution(planEntries.map(([, count]) => count))
  const planDistribution = planEntries.map(([plan, count], index) => ({
    plan,
    count,
    percent: roundedPlanPercents[index] ?? 0,
  }))

  const statusMap = new Map<string, number>()
  orgRows.forEach((organization) => {
    const status = organization.subscriptionStatus ?? 'sin_suscripcion'
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1)
  })
  const statusDistribution = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((left, right) => right.count - left.count)

  const resourceAvgs = (Object.keys(RESOURCE_LABELS) as ResourceKey[]).flatMap((key) => {
    const percentages = orgRows
      .filter((organization) => organization.limits[key] !== null)
      .map((organization) => calcPercent(organization.usage[key], organization.limits[key]))
    if (percentages.length === 0) return []
    return [{
      key,
      label: RESOURCE_LABELS[key],
      avgPercent: Math.round(percentages.reduce((sum, percent) => sum + percent, 0) / percentages.length),
    }]
  })

  return {
    orgs: orgRows,
    summary: {
      total: orgRows.length,
      atRisk: orgRows.filter((organization) => organization.atRisk).length,
      nearLimit: orgRows.filter((organization) => organization.nearLimit).length,
      overLimit: orgRows.filter((organization) => organization.overLimit).length,
      blocked: orgRows.filter((organization) => organization.subscriptionBlocked).length,
    },
    planDistribution,
    statusDistribution,
    mostConstrainedResource: resourceAvgs.sort((left, right) => right.avgPercent - left.avgPercent)[0] ?? null,
    fetchedAt: new Date().toISOString(),
  }
}

export { RESOURCE_LABELS, calcPercent }
