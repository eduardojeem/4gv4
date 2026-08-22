import { describe, expect, it } from 'vitest'
import { invalidateBranchCatalogParts } from './branch-catalog-selection'

describe('invalidateBranchCatalogParts', () => {
  it('removes inventory-linked rows and preserves manual rows after a branch change', () => {
    const parts = [
      { name: 'Módulo', productId: 'product-1', cost: 100, quantity: 1 },
      { name: 'Tornillo manual', cost: 10, quantity: 2 },
    ]
    expect(invalidateBranchCatalogParts(parts)).toEqual([parts[1]])
  })
})
