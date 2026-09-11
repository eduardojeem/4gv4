import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('customer portal access report wiring', () => {
  it('protects the aggregate endpoint with tenant analytics permission', () => {
    const route = read('src/app/api/reports/customers/route.ts')
    expect(route).toContain("withTenantAuth({ permission: 'analytics.read' }")
    expect(route).toContain(".eq('organization_id', organization.id)")
    expect(route).toContain(".from('organization_members')")
    expect(route).not.toContain('email')
  })

  it('loads access metrics only while the customers tab is active', () => {
    const page = read('src/components/admin/reports/operational-reports.tsx')
    expect(page).toContain("if (activeTab !== 'customers'")
    expect(page).toContain('fetch(`/api/reports/customers?')
    expect(page).toContain('customerAccessReport.portalActive')
    expect(page).toContain('customerAccessReport.standardCustomers')
    expect(page).toContain('customerAccessReport.needsReview')
  })
})
