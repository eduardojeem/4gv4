import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/api/dashboard/summary/route.ts'), 'utf8')
const dashboardPage = readFileSync(resolve(process.cwd(), 'src/app/dashboard/page.tsx'), 'utf8')

describe('dashboard summary tenant contract', () => {
  it('uses the authenticated aggregate for metrics and scopes bounded activity to the organization', () => {
    expect(source).toContain('fetchDashboardHomeSummary')
    expect(source).toContain('const supabase = await createClient()')
    for (const table of ['sales', 'customers', 'repairs']) {
      const tableStart = source.indexOf(`.from('${table}')`)
      expect(tableStart, `${table} query is missing`).toBeGreaterThan(-1)
      const query = source.slice(tableStart, tableStart + 350)
      expect(query).toContain(".eq('organization_id', organization.id)")
      expect(query).toContain('.limit(ACTIVITY_LIMIT_PER_SOURCE)')
    }
    expect(source).not.toContain(".from('products')")
    expect(source).not.toContain(".from('customer_orders')")
  })

  it('validates the mobile branch header against the active tenant before passing it to the aggregate', () => {
    expect(source).toContain('getRequestedBranchId(request)')
    expect(source).toContain('resolveBranchScopeForUser')
    expect(source).toContain('organizationId: organization.id')
    expect(source).toContain('strict: true')
    expect(source).toContain('branchId,')
  })

  it('never accepts an organization id from the request', () => {
    expect(source).not.toMatch(/searchParams\.get\(['"]organizationId['"]\)/)
  })

  it('builds public store links from the validated organization context', () => {
    expect(dashboardPage).not.toContain('orgSlug')
    expect(dashboardPage).toContain('organization?.slug')
  })
})
