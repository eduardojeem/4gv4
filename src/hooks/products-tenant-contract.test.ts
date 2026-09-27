import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const inventory = readFileSync(resolve(process.cwd(), 'src/hooks/useInventory.ts'), 'utf8')
const promotion = readFileSync(resolve(process.cwd(), 'src/components/dashboard/promotions/PromotionDialog.tsx'), 'utf8')
const comparison = readFileSync(resolve(process.cwd(), 'src/app/dashboard/suppliers/compare/page.tsx'), 'utf8')

describe('private product consumers tenant contract', () => {
  it('adds the active organization to direct inventory queries', () => {
    expect(inventory).toContain(".eq('organization_id', organization.id)")
  })

  it('uses the tenant product API for selectors', () => {
    expect(promotion).toContain("fetch('/api/products?")
    expect(comparison).toContain("fetch('/api/products?")
    expect(promotion).not.toContain(".from('products')")
    expect(comparison).not.toContain(".from('products')")
  })
})
