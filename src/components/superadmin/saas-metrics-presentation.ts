import type { OrgUsageRow } from '@/lib/superadmin/saas-metrics'

export type SaasHealthFilter = 'all' | 'healthy' | 'attention' | 'intervention' | 'trialing' | 'expired' | 'noSub'
export type SaasMetricsSort = 'risk' | 'name' | 'plan' | 'status' | 'overall'

export function getOrganizationHealth(org: OrgUsageRow): 'healthy' | 'attention' | 'intervention' {
  if (org.subscriptionBlocked || org.overLimit) return 'intervention'
  if (org.subscriptionExpired || org.atRisk || org.nearLimit || !org.subscriptionStatus) return 'attention'
  return 'healthy'
}

export function summarizeSaasHealth(orgs: OrgUsageRow[]) {
  return orgs.reduce((summary, org) => {
    summary[getOrganizationHealth(org)] += 1
    return summary
  }, { healthy: 0, attention: 0, intervention: 0 })
}

function riskScore(org: OrgUsageRow) {
  if (org.subscriptionBlocked) return 5
  if (org.overLimit) return 4
  if (org.subscriptionExpired || !org.subscriptionStatus) return 3
  if (org.atRisk) return 2
  if (org.nearLimit) return 1
  return 0
}

export function filterAndSortOrganizations(
  orgs: OrgUsageRow[],
  options: { search: string; filter: SaasHealthFilter; sort: SaasMetricsSort; direction: 'asc' | 'desc' },
) {
  const query = options.search.trim().toLowerCase()
  const filtered = orgs.filter((org) => {
    if (query && !org.name.toLowerCase().includes(query) && !org.slug.toLowerCase().includes(query)) return false
    if (options.filter === 'trialing') return org.subscriptionStatus === 'trialing'
    if (options.filter === 'expired') return org.subscriptionExpired
    if (options.filter === 'noSub') return !org.subscriptionStatus
    if (options.filter !== 'all') return getOrganizationHealth(org) === options.filter
    return true
  })

  return [...filtered].sort((left, right) => {
    let comparison = 0
    if (options.sort === 'risk') comparison = riskScore(left) - riskScore(right)
    if (options.sort === 'name') comparison = left.name.localeCompare(right.name)
    if (options.sort === 'plan') comparison = left.plan.localeCompare(right.plan)
    if (options.sort === 'status') {
      const leftStatus = left.subscriptionExpired ? 'expired' : left.subscriptionStatus ?? ''
      const rightStatus = right.subscriptionExpired ? 'expired' : right.subscriptionStatus ?? ''
      comparison = leftStatus.localeCompare(rightStatus)
    }
    if (options.sort === 'overall') comparison = left.overallPercent - right.overallPercent
    if (comparison === 0 && options.sort === 'risk') comparison = left.overallPercent - right.overallPercent
    return options.direction === 'asc' ? comparison : -comparison
  })
}
