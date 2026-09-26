import { describe, expect, it } from 'vitest'
import { parseCatalogQuickCreateInput, toProductCreatePayload } from './catalog-quick-create'

const branchId = '1a599e42-52d3-4d80-9852-d05a91d47fe2'

describe('catalog quick create contract', () => {
  it('maps a reusable service to the main product catalog', () => {
    expect(toProductCreatePayload({
      kind: 'service',
      name: 'Cambio de módulo',
      sku: '',
      salePrice: 180_000,
      wholesalePrice: 160_000,
      purchasePrice: 80_000,
      categoryId: null,
    }, branchId, 'SRV-ABC123')).toMatchObject({
      name: 'Cambio de módulo',
      sku: 'SRV-ABC123',
      unit_measure: 'servicio',
      stock_quantity: 0,
      sale_price: 180_000,
      wholesale_price: 160_000,
      purchase_price: 80_000,
      branch_id: branchId,
      is_active: true,
    })
  })

  it('maps a reusable part with current branch stock', () => {
    expect(toProductCreatePayload({
      kind: 'part',
      name: 'Módulo A05',
      sku: 'MOD-A05',
      salePrice: 120_000,
      wholesalePrice: null,
      purchasePrice: 75_000,
      initialStock: 4,
      categoryId: null,
    }, branchId, 'REP-IGNORED')).toMatchObject({
      sku: 'MOD-A05',
      unit_measure: 'unidad',
      stock_quantity: 4,
      branch_id: branchId,
    })
  })

  it('rejects invalid amounts before calling the catalog API', () => {
    const result = parseCatalogQuickCreateInput({
      kind: 'part', name: 'Módulo', sku: '', salePrice: 0,
      wholesalePrice: null, purchasePrice: -1, initialStock: -2, categoryId: null,
    })

    expect(result.success).toBe(false)
  })
})
