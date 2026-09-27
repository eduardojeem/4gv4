import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(resolve(process.cwd(), 'src/app/api/reports/credits/route.ts'), 'utf8')

describe('credit reports API contract', () => {
  it('enforces reports permission, credits module and tenant ownership', () => {
    expect(route).toContain("withTenantAuth({ permission: 'analytics.read', module: 'credits' }")
    expect(route).toContain(".eq('organization_id', organization.id)")
  })

  it('validates an optional branch before applying it to the credit portfolio', () => {
    expect(route).toContain('resolveBranchScopeForUser')
    expect(route).toContain("query = query.eq('branch_id', branchId)")
    expect(route).toContain('status: isBranchScopeError ? 403 : 500')
  })

  it('filters payment movement by the requested reporting period', () => {
    expect(route).toContain(".gte('created_at', range.from.toISOString())")
    expect(route).toContain(".lte('created_at', range.to.toISOString())")
  })
})
