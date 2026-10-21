import { describe, expect, it } from 'vitest'
import { redactCostFields } from './cost-access'

// S2: valores de costo o derivados del costo en tomas de inventario y estadísticas.
describe('redactCostFields', () => {
  const count = {
    id: 'count-1', number: 7, status: 'applied',
    summary: { counted: 12, units_in: 3, units_out: 1, value_difference: -45_000 },
    items: [{ id: 'i1', name: 'Cable USB', unit_cost: 9_000, system_qty: 4, counted_qty: 3 }],
  }

  it('removes unit costs and cost-derived values at any depth for users without cost permission', () => {
    const hidden = redactCostFields(count, { canReadCost: false })
    expect(hidden.summary).toEqual({ counted: 12, units_in: 3, units_out: 1 })
    expect(hidden.items[0]).toEqual({ id: 'i1', name: 'Cable USB', system_qty: 4, counted_qty: 3 })
    expect(JSON.stringify(hidden)).not.toMatch(/9000|45000|unit_cost|value_difference/)
  })

  it('removes the stock value at cost and the weighted margin from inventory stats', () => {
    const stats = { totalProducts: 3, stockCostValue: 120_000, stockSaleValue: 200_000, weightedMargin: 40 }
    expect(redactCostFields(stats, { canReadCost: false })).toEqual({ totalProducts: 3, stockSaleValue: 200_000 })
  })

  it('returns everything unchanged to users who can read costs', () => {
    expect(redactCostFields(count, { canReadCost: true })).toBe(count)
  })

  it('does not mutate the original payload', () => {
    redactCostFields(count, { canReadCost: false })
    expect(count.items[0].unit_cost).toBe(9_000)
  })
})
