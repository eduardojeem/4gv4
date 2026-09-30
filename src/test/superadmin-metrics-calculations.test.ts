import { describe, expect, it } from 'vitest'
import {
  buildMonthSeries,
  buildPlanPriceMap,
  planMonthlyPrice,
  calculateRoundedDistribution,
  calculateRecurringRevenue,
  calculateUsagePercent,
  countCashRegistersByOrganization,
  summarizeUsageRisk,
} from '@/lib/superadmin/metrics-calculations'

describe('superadmin metric calculations', () => {
  it('builds the requested number of calendar months', () => {
    const months = buildMonthSeries(12, new Date('2026-07-15T12:00:00Z'))

    expect(months).toHaveLength(12)
    expect(months[0]?.key).toBe('2025-08')
    expect(months[11]?.key).toBe('2026-07')
  })

  it('counts only active paid subscriptions as recurring revenue', () => {
    const revenue = calculateRecurringRevenue([
      { plan: 'PRO', status: 'active', paymentStatus: 'paid' },
      { plan: 'BASIC', status: 'trialing', paymentStatus: null },
      { plan: 'PRO', status: 'past_due', paymentStatus: 'unpaid' },
      { plan: 'FREE', status: 'active', paymentStatus: null },
    ], { FREE: 0, BASIC: 100_000, PRO: 150_000, ENTERPRISE: 0 })

    expect(revenue).toEqual({
      mrr: 150_000,
      arr: 1_800_000,
      activeSubscriptions: 1,
      averageRevenuePerSubscription: 150_000,
      unpricedSubscriptions: 0,
    })
  })

  it('unifica alias, cobra planes retirados y avisa los planes sin precio', () => {
    const prices = buildPlanPriceMap([
      { tier: 'basic', price: '100000' },
      { tier: 'pro', price: 150_000 },
      { tier: 'legacy', price: 90_000 },
    ])
    const revenue = calculateRecurringRevenue([
      { plan: 'starter', status: 'active' },
      { plan: 'Profesional', status: 'active' },
      { plan: 'legacy', status: 'active' },
      { plan: 'enterprise', status: 'active' },
    ], prices)

    expect(revenue.mrr).toBe(340_000)
    expect(revenue.activeSubscriptions).toBe(4)
    expect(revenue.unpricedSubscriptions).toBe(1)
    expect(planMonthlyPrice(prices, 'STARTER')).toBe(100_000)
    expect(planMonthlyPrice(prices, 'enterprise')).toBeNull()
  })

  it('flags usage when a resource has a zero limit', () => {
    expect(calculateUsagePercent(0, 0)).toBe(0)
    expect(calculateUsagePercent(1, 0)).toBe(101)
    expect(calculateUsagePercent(50, null)).toBe(0)
  })

  it('keeps near-limit and over-limit groups mutually exclusive', () => {
    expect(summarizeUsageRisk([59, 60, 79, 80, 101])).toEqual({
      healthy: 1,
      nearLimit: 2,
      atRisk: 1,
      overLimit: 1,
    })
  })

  it('keeps rounded plan distribution percentages at exactly 100 percent', () => {
    const percentages = calculateRoundedDistribution([4, 4, 1])

    expect(percentages).toEqual([45, 44, 11])
    expect(percentages.reduce((sum, value) => sum + value, 0)).toBe(100)
  })

  it('attributes cash registers through their owning branch', () => {
    const counts = countCashRegistersByOrganization(
      [
        { id: 'branch-a', organizationId: 'org-a' },
        { id: 'branch-b', organizationId: 'org-b' },
      ],
      [
        { branchId: 'branch-a' },
        { branchId: 'branch-a' },
        { branchId: 'branch-b' },
        { branchId: null },
      ]
    )

    expect(counts.get('org-a')).toBe(2)
    expect(counts.get('org-b')).toBe(1)
  })
})
