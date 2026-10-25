import { describe, expect, it } from 'vitest'
import { summarizeCount, countToCsv, type CountItem } from './inventory-count'

const item = (cost: number | null): CountItem => ({ id:'item', product_id:'product', variant_id:null, name:'Synthetic', sku:null, barcode:null, category_name:null, system_qty:2, counted_qty:3, system_qty_at_count:2, counted_at:null, applied_delta:null, unit_cost:cost })

describe('count hidden cost contract', () => {
  it('does not invent a valuation for unknown costs', () => {
    expect(summarizeCount([item(null)]).valueDifference).toBeNull()
    expect(countToCsv([item(null)]).split('\n')[1].endsWith(';;')).toBe(true)
  })
  it('preserves real zero and positive valuations', () => {
    expect(summarizeCount([item(0)]).valueDifference).toBe(0)
    expect(summarizeCount([item(25)]).valueDifference).toBe(25)
  })
})
