import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { creditPortfolioUrl } from '@/lib/credits/portfolio-url'

const route = readFileSync(resolve(process.cwd(), 'src/app/api/credits/route.ts'), 'utf8')
const hook = readFileSync(resolve(process.cwd(), 'src/hooks/use-credits.ts'), 'utf8')

describe('credits tenant isolation contract', () => {
  it('starts from credits owned by the active organization', () => {
    expect(route).toContain(".from('credit_details')")
    expect(route).toContain(".eq('organization_id', organization.id)")
    expect(route).toContain('chunkIds(creditIds,200)')
    expect(route).toContain(".in('credit_id',ids)")
  })

  it('loads credit data only through the tenant API', () => {
    expect(hook).toContain("fetch(url, { cache: 'no-store' })")
    expect(hook).toContain('fetchTenantCreditsData(portfolioUrl)')
    for (const table of ['credit_details', 'credit_installments', 'credit_payments', 'credit_summary']) {
      expect(hook).not.toContain(`.from('${table}')`)
    }
  })

  it('asks for the chosen branch, or every branch only when the owner chose it', () => {
    expect(creditPortfolioUrl({ branchId: 'b1', allBranches: false })).toBe('/api/credits?branchId=b1')
    expect(creditPortfolioUrl({ branchId: 'b1', allBranches: true })).toBe('/api/credits?branchId=all')
    expect(creditPortfolioUrl({ branchId: null, allBranches: false })).toBe('/api/credits')
    expect(hook).toContain('canViewAllBranches && allBranchesChoice')
  })

  it('limits a request without branch to the user branch unless owner or admin', () => {
    expect(route).toContain("else if(!['owner','admin'].includes(organization.role))")
    expect(route).toContain('requestedBranchId:null')
  })
})
