import { describe, expect, it } from 'vitest'
import type { SuperAdminAnalyticsData } from '@/lib/superadmin/analytics'
import { buildAnalyticsCsvRows, selectAnalyticsPeriod } from './analytics-presentation'

const analytics: SuperAdminAnalyticsData = {
  growthData: [
    { month: 'Ene', count: 1 },
    { month: 'Feb', count: 2 },
    { month: 'Mar', count: 4 },
    { month: 'Abr', count: 8 },
  ],
  activityData: [
    { month: 'Ene', activeRegistrations: 1, otherRegistrations: 0 },
    { month: 'Feb', activeRegistrations: 2, otherRegistrations: 1 },
    { month: 'Mar', activeRegistrations: 3, otherRegistrations: 1 },
    { month: 'Abr', activeRegistrations: 4, otherRegistrations: 2 },
  ],
  planDistribution: [{ name: 'PRO', value: 3 }],
  revenueData: { mrr: 300000, arr: 3600000, activeSubscriptions: 3, averageRevenuePerSub: 100000 },
  topOrganizations: [{ id: '1', slug: 'acme', name: 'Acme', user_count: 12 }],
  generatedAt: '2026-08-28T12:00:00.000Z',
}

describe('analytics presentation', () => {
  it('uses the selected period for charts and month-over-month comparison', () => {
    const result = selectAnalyticsPeriod(analytics, '3m')

    expect(result.growth.map((item) => item.month)).toEqual(['Feb', 'Mar', 'Abr'])
    expect(result.activity.map((item) => item.month)).toEqual(['Feb', 'Mar', 'Abr'])
    expect(result.currentMonth).toBe(8)
    expect(result.previousMonth).toBe(4)
    expect(result.growthPercentage).toBe(100)
  })

  it('exports only monthly rows included in the selected period', () => {
    const rows = buildAnalyticsCsvRows(analytics, '3m')
    const serialized = rows.flat().join('|')

    expect(serialized).toContain('Feb')
    expect(serialized).toContain('Abr')
    expect(serialized).not.toContain('Ene')
  })
})
