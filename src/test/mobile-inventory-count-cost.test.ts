import { describe, expect, it, vi } from 'vitest'
vi.mock('../../mobile/src/lib/api', () => ({ apiFetch: vi.fn(), ApiError: class extends Error {} }))
import { summarizeCount, type CountItem } from '../../mobile/src/lib/inventory-count'

const item = (cost: number | null): CountItem => ({id:'item',product_id:'product',variant_id:null,name:'Synthetic',sku:null,barcode:null,category_name:null,system_qty:2,counted_qty:3,system_qty_at_count:2,counted_at:null,applied_delta:null,unit_cost:cost})

describe('mobile inventory valuation', () => {
  it('preserves redacted null instead of computing a zero valuation', () => {
    expect(summarizeCount([item(null)]).valueDifference).toBeNull()
    expect(summarizeCount([item(null)])).toMatchObject({counted:1,unitsIn:1})
  })
  it('keeps legitimate zero and known positive cost', () => {
    expect(summarizeCount([item(0)]).valueDifference).toBe(0)
    expect(summarizeCount([item(25)]).valueDifference).toBe(25)
  })
})
