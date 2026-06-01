import { createAdminSupabase } from '@/lib/supabase/admin'
import { normalizePlanCode, DEFAULT_LIMITS } from '@/lib/saas/subscription-service'

export type ResourceKey = 'users' | 'products' | 'branches' | 'cashRegisters' | 'categories'

export type OrgUsageRow = {
  id: string
  name: string
  slug: string
  plan: string
  planCode: string
  subscriptionStatus: string | null
  trialEndsAt: string | null
  periodEndsAt: string | null
  usage: Record<ResourceKey, number>
  limits: Record<ResourceKey, number | null>
  overallPercent: number
  atRisk: boolean     // any resource ≥ 80%
  overLimit: boolean  // any resource > 100%
}

export type SaasMetricsData = {
  orgs: OrgUsageRow[]
  summary: {
    total: number
    atRisk: number
    nearLimit: number
    overLimit: number
    avgUsagePercent: number
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

function calcPercent(current: number, limit: number | null): number {
  if (limit === null || limit === 0) return 0
  return Math.round((current / limit) * 100)
}

function calcOverall(usage: Record<ResourceKey, number>, limits: Record<ResourceKey, number | null>): number {
  const percentages = (Object.keys(limits) as ResourceKey[])
    .filter((k) => limits[k] !== null)
    .map((k) => calcPercent(usage[k], limits[k]))

  if (!percentages.length) return 0
  return Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
}

function countByOrg(rows: Array<{ organization_id: string | null }>, orgIds: Set<string>): Map<string, number> {
  const counts = new Map<string, number>()
  orgIds.forEach((id) => counts.set(id, 0))
  rows.forEach((row) => {
    if (row.organization_id && counts.has(row.organization_id)) {
      counts.set(row.organization_id, (counts.get(row.organization_id) ?? 0) + 1)
    }
  })
  return counts
}

export async function getSaasMetrics(): Promise<SaasMetricsData> {
  const admin = createAdminSupabase()

  // 1. Fetch orgs + their subscriptions in one query
  const { data: orgsData } = await admin
    .from('organizations')
    .select('id, name, slug, plan, created_at')
    .order('name', { ascending: true })

  const orgs = orgsData ?? []
  const orgIds = new Set(orgs.map((o) => o.id))

  // 2. Fetch subscriptions for all orgs
  const { data: subsData } = await admin
    .from('subscriptions')
    .select('organization_id, plan, status, trial_ends_at, current_period_ends_at')
    .in('organization_id', Array.from(orgIds))

  const subsByOrg = new Map(
    (subsData ?? []).map((s) => [s.organization_id, s])
  )

  // 3. Bulk fetch all resource rows (5 queries total, counted in JS)
  const [membersRes, productsRes, branchesRes, cashRegsRes, categoriesRes] = await Promise.all([
    admin.from('organization_members').select('organization_id').in('organization_id', Array.from(orgIds)),
    admin.from('products').select('organization_id').in('organization_id', Array.from(orgIds)),
    admin.from('branches').select('organization_id').in('organization_id', Array.from(orgIds)),
    admin.from('cash_registers').select('organization_id').in('organization_id', Array.from(orgIds)),
    admin.from('categories').select('organization_id').in('organization_id', Array.from(orgIds)),
  ])

  const memberCounts = countByOrg(membersRes.data ?? [], orgIds)
  const productCounts = countByOrg(productsRes.data ?? [], orgIds)
  const branchCounts = countByOrg(branchesRes.data ?? [], orgIds)
  const cashRegCounts = countByOrg(cashRegsRes.data ?? [], orgIds)
  const categoryCounts = countByOrg(categoriesRes.data ?? [], orgIds)

  // 4. Build per-org rows
  const orgRows: OrgUsageRow[] = orgs.map((org) => {
    const sub = subsByOrg.get(org.id)
    const planCode = normalizePlanCode(sub?.plan ?? org.plan ?? 'FREE')
    const planLimits = DEFAULT_LIMITS[planCode] ?? DEFAULT_LIMITS.FREE

    const limits: Record<ResourceKey, number | null> = {
      users: planLimits.users ?? null,
      products: planLimits.products ?? null,
      branches: planLimits.branches ?? null,
      cashRegisters: planLimits.cashRegisters ?? null,
      categories: planLimits.categories ?? null,
    }

    const usage: Record<ResourceKey, number> = {
      users: memberCounts.get(org.id) ?? 0,
      products: productCounts.get(org.id) ?? 0,
      branches: branchCounts.get(org.id) ?? 0,
      cashRegisters: cashRegCounts.get(org.id) ?? 0,
      categories: categoryCounts.get(org.id) ?? 0,
    }

    const overallPercent = calcOverall(usage, limits)
    const resourcePercents = (Object.keys(limits) as ResourceKey[]).map((k) => calcPercent(usage[k], limits[k]))
    const atRisk = resourcePercents.some((p) => p >= 80)
    const overLimit = resourcePercents.some((p) => p > 100)

    return {
      id: org.id,
      name: org.name,
      slug: org.slug ?? '',
      plan: planCode,
      planCode,
      subscriptionStatus: sub?.status ?? null,
      trialEndsAt: sub?.trial_ends_at ?? null,
      periodEndsAt: sub?.current_period_ends_at ?? null,
      usage,
      limits,
      overallPercent,
      atRisk,
      overLimit,
    }
  })

  // 5. Summary stats
  const atRiskCount = orgRows.filter((o) => o.atRisk).length
  const nearLimitCount = orgRows.filter((o) => !o.atRisk && o.overallPercent >= 50).length
  const overLimitCount = orgRows.filter((o) => o.overLimit).length
  const avgUsage = orgRows.length
    ? Math.round(orgRows.reduce((sum, o) => sum + o.overallPercent, 0) / orgRows.length)
    : 0

  // 6. Plan distribution
  const planMap = new Map<string, number>()
  orgRows.forEach((o) => planMap.set(o.plan, (planMap.get(o.plan) ?? 0) + 1))
  const planDistribution = Array.from(planMap.entries())
    .map(([plan, count]) => ({ plan, count, percent: Math.round((count / orgRows.length) * 100) }))
    .sort((a, b) => b.count - a.count)

  // 7. Status distribution
  const statusMap = new Map<string, number>()
  orgRows.forEach((o) => {
    const s = o.subscriptionStatus ?? 'sin_suscripcion'
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1)
  })
  const statusDistribution = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)

  // 8. Most constrained resource
  const resourceAvgs = (Object.keys(RESOURCE_LABELS) as ResourceKey[]).map((key) => {
    const percents = orgRows
      .filter((o) => o.limits[key] !== null)
      .map((o) => calcPercent(o.usage[key], o.limits[key]))
    const avg = percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0
    return { key, label: RESOURCE_LABELS[key], avgPercent: avg }
  })
  const mostConstrainedResource = resourceAvgs.sort((a, b) => b.avgPercent - a.avgPercent)[0] ?? null

  return {
    orgs: orgRows,
    summary: {
      total: orgRows.length,
      atRisk: atRiskCount,
      nearLimit: nearLimitCount,
      overLimit: overLimitCount,
      avgUsagePercent: avgUsage,
    },
    planDistribution,
    statusDistribution,
    mostConstrainedResource,
    fetchedAt: new Date().toISOString(),
  }
}

export { RESOURCE_LABELS, calcPercent }
