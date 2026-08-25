import { describe, expect, it } from 'vitest'
import { invalidateBranchCatalogParts } from './branch-catalog-selection'

describe('invalidateBranchCatalogParts', () => {
  it('removes only branch inventory parts and preserves services with included materials', () => {
    const parts = [
      { name: 'Módulo', productId: 'product-1', lineType: 'charged_part', cost: 100, quantity: 1 },
      { name: 'Cambio de módulo', productId: 'service-1', lineType: 'service', cost: 250, quantity: 1 },
      { name: 'Material incluido', productId: null, lineType: 'included_material', cost: 0, quantity: 1 },
      { name: 'Tornillo manual', lineType: 'charged_part', cost: 10, quantity: 2 },
    ]
    expect(invalidateBranchCatalogParts(parts)).toEqual([parts[1], parts[2], parts[3]])
  })
})
