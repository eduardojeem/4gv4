import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/app/api/dashboard/summary/route.ts'), 'utf8')
const dashboardPage = readFileSync(resolve(process.cwd(), 'src/app/dashboard/page.tsx'), 'utf8')

describe('dashboard summary tenant contract', () => {
  it('scopes every operational source to the resolved organization', () => {
    for (const table of ['sales', 'customer_orders', 'customers', 'products', 'categories', 'repairs']) {
      const tableStart = source.indexOf(`.from('${table}')`)
      expect(tableStart, `${table} query is missing`).toBeGreaterThan(-1)
      const query = source.slice(tableStart, tableStart + 500)
      expect(query).toContain(".eq('organization_id', organization.id)")
    }
  })

  it('validates requested branches against the active tenant', () => {
    expect(source).toContain('resolveBranchScopeForUser')
    expect(source).toContain('organizationId: organization.id')
    expect(source).toContain('strict: true')
  })

  it('never accepts an organization id from the request', () => {
    expect(source).not.toMatch(/searchParams\.get\(['"]organizationId['"]\)/)
  })

  it('builds public store links from the validated organization context', () => {
    expect(dashboardPage).not.toContain('orgSlug')
    expect(dashboardPage).toContain('organization?.slug')
  })
})
