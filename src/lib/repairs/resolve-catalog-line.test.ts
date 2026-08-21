import { describe, expect, it } from 'vitest'
import { resolveCatalogRepairLines } from './resolve-catalog-line'

describe('resolveCatalogRepairLines', () => {
  it('turns a service into customer revenue plus a zero-price included material', () => {
    const lines = resolveCatalogRepairLines({
      id: 'service-1', name: 'Cambio de módulo', sku: 'SRV-MOD', unit_measure: 'servicio',
      purchase_price: 100_000, sale_price: 250_000, wholesale_price: 220_000, tax_rate: 10,
    }, true, 1)

    expect(lines).toEqual([
      expect.objectContaining({ product_id: 'service-1', line_type: 'service', unit_price: 220_000, unit_cost: 0 }),
      expect.objectContaining({ product_id: null, line_type: 'included_material', unit_price: 0, unit_cost: 100_000 }),
    ])
  })

  it('keeps physical inventory as a separately charged part', () => {
    const lines = resolveCatalogRepairLines({
      id: 'part-1', name: 'Batería', sku: 'BAT-1', unit_measure: 'unidad',
      purchase_price: 70_000, sale_price: 120_000, wholesale_price: 95_000, tax_rate: 10,
    }, false, 2)

    expect(lines).toEqual([
      expect.objectContaining({ product_id: 'part-1', line_type: 'charged_part', quantity: 2, unit_price: 120_000, unit_cost: 70_000 }),
    ])
  })
})
