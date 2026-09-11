import { describe, expect, it } from 'vitest'

import { buildCustomerAccessReport } from './customer-access-report'

describe('buildCustomerAccessReport', () => {
  it('separates ordinary customers, active portal access and links needing review', () => {
    const report = buildCustomerAccessReport({
      customers: [
        { profileId: null, createdAt: '2026-09-01T10:00:00.000Z' },
        { profileId: 'user-active', createdAt: '2026-09-02T10:00:00.000Z' },
        { profileId: 'user-pending', createdAt: '2026-08-01T10:00:00.000Z' },
      ],
      memberships: [
        { userId: 'user-active', status: 'active' },
        { userId: 'user-pending', status: 'inactive' },
      ],
      from: new Date('2026-09-01T00:00:00.000Z'),
      to: new Date('2026-09-30T23:59:59.999Z'),
    })

    expect(report).toEqual({
      total: 3,
      standardCustomers: 1,
      portalActive: 1,
      needsReview: 1,
      newInPeriod: 2,
      adoptionRate: 33.3,
    })
  })

  it('does not count a profile without an active organization membership as portal access', () => {
    const report = buildCustomerAccessReport({
      customers: [{ profileId: 'orphan-link', createdAt: null }],
      memberships: [],
      from: new Date('2026-09-01T00:00:00.000Z'),
      to: new Date('2026-09-30T23:59:59.999Z'),
    })

    expect(report.portalActive).toBe(0)
    expect(report.needsReview).toBe(1)
    expect(report.adoptionRate).toBe(0)
  })
})
