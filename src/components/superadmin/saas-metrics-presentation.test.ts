import { describe, expect, it } from 'vitest'
import type { OrgUsageRow } from '@/lib/superadmin/saas-metrics'
import { filterAndSortOrganizations, summarizeSaasHealth } from './saas-metrics-presentation'

function organization(overrides: Partial<OrgUsageRow>): OrgUsageRow {
  return {
    id: 'org', name: 'Organización', slug: 'organizacion', plan: 'FREE', planCode: 'FREE',
    contractedPlanCode: 'FREE', subscriptionStatus: 'active', paymentStatus: null,
    subscriptionBlocked: false, subscriptionExpired: false, trialEndsAt: null, periodEndsAt: null,
    usage: { users: 0, products: 0, branches: 0, cashRegisters: 0, categories: 0 },
    limits: { users: 5, products: 50, branches: 1, cashRegisters: 1, categories: 10 },
    overallPercent: 10, nearLimit: false, atRisk: false, overLimit: false,
    ...overrides,
  }
}

const organizations = [
  organization({ id: 'healthy', name: 'Sana' }),
  organization({ id: 'near', name: 'Atención', nearLimit: true, overallPercent: 70 }),
  organization({ id: 'expired', name: 'Vencida', subscriptionExpired: true }),
  organization({ id: 'over', name: 'Excedida', overLimit: true, overallPercent: 120 }),
  organization({ id: 'blocked', name: 'Bloqueada', subscriptionBlocked: true, overallPercent: 20 }),
]

describe('SaaS metrics presentation', () => {
  it('groups each organization once into healthy, attention or intervention', () => {
    expect(summarizeSaasHealth(organizations)).toEqual({ healthy: 1, attention: 2, intervention: 2 })
  })

  it('orders all organizations by operational risk by default', () => {
    const result = filterAndSortOrganizations(organizations, { search: '', filter: 'all', sort: 'risk', direction: 'desc' })

    expect(result.map((org) => org.id)).toEqual(['blocked', 'over', 'expired', 'near', 'healthy'])
  })

  it('supports the simplified attention filter', () => {
    const result = filterAndSortOrganizations(organizations, { search: '', filter: 'attention', sort: 'risk', direction: 'desc' })

    expect(result.map((org) => org.id)).toEqual(['expired', 'near'])
  })
})
