import { describe, expect, it } from 'vitest'
import { addRepairService, catalogItemPrice, toRepairPart, toRepairServiceLines } from './repair-catalog-selection'

const part = {
  id: 'part-1', name: 'Módulo A05', sku: 'MOD-A05', sale_price: 120_000,
  offer_price: 110_000, wholesale_price: 90_000, purchase_price: 70_000,
  stock_quantity: 4, unit_measure: 'unidad',
}

describe('repair catalog selection', () => {
  it('uses the current wholesale price when the customer qualifies', () => {
    expect(catalogItemPrice(part, true)).toBe(90_000)
    expect(catalogItemPrice(part, false)).toBe(110_000)
  })

  it('converts a catalog part into an inventory-linked repair part', () => {
    expect(toRepairPart(part, true)).toEqual({
      name: 'Módulo A05', cost: 90_000, internalCost: 70_000, quantity: 1,
      stockAvailable: 4, supplier: 'Inventario Local', partNumber: 'MOD-A05',
      productId: 'part-1',
      lineType: 'charged_part',
    })
  })

  it('keeps the full service price and separates its included material cost', () => {
    expect(toRepairServiceLines({ ...part, id: 'service-1', name: 'Cambio de módulo', unit_measure: 'servicio' }, true)).toEqual([
      expect.objectContaining({ name: 'Cambio de módulo', cost: 90_000, internalCost: 0, productId: 'service-1', lineType: 'service' }),
      expect.objectContaining({ name: 'Material incluido · Cambio de módulo', cost: 0, internalCost: 70_000, productId: null, lineType: 'included_material' }),
    ])
  })

  it('adds one service bundle and rejects duplicate taps', () => {
    const service = { ...part, id: 'service-1', name: 'Cambio de módulo', unit_measure: 'servicio' }
    const first = addRepairService([], service, false)
    const duplicate = addRepairService(first.parts, service, false)

    expect(first.added).toBe(true)
    expect(first.parts).toHaveLength(2)
    expect(duplicate.added).toBe(false)
    expect(duplicate.parts).toEqual(first.parts)
  })
})
