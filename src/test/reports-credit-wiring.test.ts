import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'src/app/dashboard/reports/page.tsx'), 'utf8')

describe('reports credit wiring', () => {
  it('shows credits only when the module is effective and loads the tenant API', () => {
    expect(page).toContain("effectiveModules.includes('credits')")
    expect(page).toContain("fetch(`/api/reports/credits?")
    expect(page).toContain('<ReportsCreditsTab')
  })

  it('places the credits tab next to repairs', () => {
    const repairsTrigger = page.indexOf('value="repairs"')
    const creditsTrigger = page.indexOf('value="credits"')
    expect(repairsTrigger).toBeGreaterThan(-1)
    expect(creditsTrigger).toBeGreaterThan(repairsTrigger)
  })

  it('uses immutable sale cost snapshots instead of current product cost', () => {
    expect(page).toContain(".from('sale_item_cost_snapshots')")
    expect(page).not.toContain('item.product?.purchase_price')
  })
})
