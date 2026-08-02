import { describe, expect, it } from 'vitest'
import {
  countOrganizationsWithoutSubscription,
  getEffectiveOrganizationPlan,
  getSubscriptionTiming,
  summarizeOrganizationMembers,
} from '@/lib/superadmin/organization-directory'

describe('superadmin organization directory', () => {
  it('prioritizes the subscription plan over the organization snapshot', () => {
    expect(getEffectiveOrganizationPlan('FREE', 'BASIC')).toBe('BASIC')
    expect(getEffectiveOrganizationPlan('PRO', null)).toBe('PRO')
  })

  it('counts organizations without a subscription once', () => {
    expect(countOrganizationsWithoutSubscription([
      { subscription_status: null },
      { subscription_status: 'active' },
      { subscription_status: null },
    ])).toBe(2)
  })

  it('separates staff from customer memberships', () => {
    expect(summarizeOrganizationMembers([
      { role: 'admin', status: 'active' },
      { role: 'technician', status: 'suspended' },
      { role: 'customer', status: 'active' },
    ])).toEqual({
      staffTotal: 2,
      staffActive: 1,
      staffInvited: 0,
      staffSuspended: 1,
      customersTotal: 1,
    })
  })

  it('describes an overdue period without a negative day count', () => {
    expect(getSubscriptionTiming(
      'active',
      null,
      '2026-07-28T00:00:00.000Z',
      new Date('2026-07-31T12:00:00.000Z')
    )).toEqual({ label: 'Venció hace 4 días', urgent: true })
  })
})
