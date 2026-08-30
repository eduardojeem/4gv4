import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(resolve(process.cwd(), 'src/app/api/credits/route.ts'), 'utf8')
const hook = readFileSync(resolve(process.cwd(), 'src/hooks/use-credits.ts'), 'utf8')

describe('credits tenant isolation contract', () => {
  it('starts from credits owned by the active organization', () => {
    expect(route).toContain(".from('credit_details')")
    expect(route).toContain(".eq('organization_id', organization.id)")
    expect(route).toContain(".in('credit_id', creditIds)")
  })

  it('loads credit data only through the tenant API', () => {
    expect(hook).toContain("fetch('/api/credits'")
    for (const table of ['credit_details', 'credit_installments', 'credit_payments', 'credit_summary']) {
      expect(hook).not.toContain(`.from('${table}')`)
    }
  })
})
