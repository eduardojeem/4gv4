export type MonthSeriesItem = {
  key: string
  label: string
}

type RevenueSubscription = {
  plan: string | null
  status: string | null
  paymentStatus?: string | null
}

type PlanPrices = Record<string, number>

function normalizeMetricPlan(plan: string | null) {
  const normalized = plan?.trim().toUpperCase() || 'FREE'
  if (normalized === 'STARTER') return 'BASIC'
  if (normalized === 'PROFESSIONAL') return 'PRO'
  return normalized
}

export function buildMonthSeries(count: number, now = new Date()): MonthSeriesItem[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1)
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('es-PY', { month: 'short', year: '2-digit' }).format(date),
    }
  })
}

export function calculateRecurringRevenue(
  subscriptions: RevenueSubscription[],
  prices: PlanPrices
) {
  const billableSubscriptions = subscriptions.filter((subscription) => {
    const paymentStatus = subscription.paymentStatus?.toLowerCase() ?? null
    return subscription.status === 'active'
      && normalizeMetricPlan(subscription.plan) !== 'FREE'
      && !['failed', 'refunded', 'unpaid'].includes(paymentStatus ?? '')
  })

  const mrr = billableSubscriptions.reduce((sum, subscription) => {
    return sum + (prices[normalizeMetricPlan(subscription.plan)] ?? 0)
  }, 0)
  const activeSubscriptions = billableSubscriptions.length

  return {
    mrr,
    arr: mrr * 12,
    activeSubscriptions,
    averageRevenuePerSubscription: activeSubscriptions > 0 ? mrr / activeSubscriptions : 0,
  }
}

export function calculateUsagePercent(current: number, limit: number | null): number {
  if (limit === null) return 0
  if (limit <= 0) return current > 0 ? 101 : 0
  return Math.round((current / limit) * 100)
}

export function calculateRoundedDistribution(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + Math.max(0, count), 0)
  if (total === 0) return counts.map(() => 0)

  const exact = counts.map((count) => (Math.max(0, count) / total) * 100)
  const rounded = exact.map(Math.floor)
  let remaining = 100 - rounded.reduce((sum, value) => sum + value, 0)
  const priority = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)

  for (const item of priority) {
    if (remaining === 0) break
    rounded[item.index] += 1
    remaining -= 1
  }

  return rounded
}

export function countCashRegistersByOrganization(
  branches: Array<{ id: string; organizationId: string | null }>,
  cashRegisters: Array<{ branchId: string | null }>
) {
  const organizationByBranch = new Map(
    branches
      .filter((branch) => branch.organizationId)
      .map((branch) => [branch.id, branch.organizationId as string])
  )
  const counts = new Map<string, number>()

  for (const organizationId of organizationByBranch.values()) {
    if (!counts.has(organizationId)) counts.set(organizationId, 0)
  }

  for (const register of cashRegisters) {
    const organizationId = register.branchId
      ? organizationByBranch.get(register.branchId)
      : null
    if (!organizationId) continue
    counts.set(organizationId, (counts.get(organizationId) ?? 0) + 1)
  }

  return counts
}

export function summarizeUsageRisk(percentages: number[]) {
  return percentages.reduce((summary, percent) => {
    if (percent > 100) summary.overLimit += 1
    else if (percent >= 80) summary.atRisk += 1
    else if (percent >= 60) summary.nearLimit += 1
    else summary.healthy += 1
    return summary
  }, { healthy: 0, nearLimit: 0, atRisk: 0, overLimit: 0 })
}
