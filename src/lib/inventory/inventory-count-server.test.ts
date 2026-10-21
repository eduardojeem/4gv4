import { describe, expect, it, vi } from 'vitest'
import { buildCountItems, resolveCountUnitCost } from './inventory-count-server'

describe('inventory count cost snapshot', () => {
  it('preserves a legitimate zero variant cost instead of using its parent', () => {
    expect(resolveCountUnitCost(0, 125)).toBe(0)
  })
  it('uses the product cost only when the variant cost is unknown', () => {
    expect(resolveCountUnitCost(null, 125)).toBe(125)
    expect(resolveCountUnitCost(undefined, 0)).toBe(0)
    expect(resolveCountUnitCost(25, 125)).toBe(25)
  })
  it('fails closed instead of persisting a fabricated cost snapshot', () => {
    expect(() => resolveCountUnitCost(null, null)).toThrow('COUNT_COST_UNAVAILABLE')
    expect(() => resolveCountUnitCost(Number.NaN, null)).toThrow('COUNT_COST_UNAVAILABLE')
  })
})

it('builds a post-03 count using safe session columns and scoped server costs', async () => {
  const sessionSelects: Array<{ table: string; columns: string }> = []
  const costFilters: unknown[][] = []
  const makeClient = (privileged: boolean) => ({ from(table: string) {
    const query: Record<string, unknown> = {}
    query.select = vi.fn((columns: string) => { if (!privileged) sessionSelects.push({table,columns}); return query })
    query.eq = vi.fn((...args: unknown[]) => { if (privileged) costFilters.push(args); return query })
    query.order = vi.fn(() => query)
    query.range = vi.fn(() => {
      const rows = privileged
        ? table === 'products' ? [{id:'product',purchase_price:200}] : [{id:'variant',purchase_price:0}]
        : table === 'products' ? [{id:'product',name:'Synthetic',sku:null,barcode:null,unit_measure:'unidad',has_variants:true,categories:null}]
          : table === 'product_variants' ? [{id:'variant',product_id:'product',variant_name:'Zero',sku:null,barcode:null}]
            : table === 'branch_variant_inventory' ? [{variant_id:'variant',stock_quantity:4}] : []
      return Promise.resolve({data:rows,error:null})
    })
    return query
  } })
  const items = await buildCountItems(makeClient(false) as never, 'org', 'branch', null, makeClient(true) as never)
  expect(items).toMatchObject([{variant_id:'variant',unit_cost:0,system_qty:4}])
  expect(sessionSelects.filter(row => ['products','product_variants'].includes(row.table)).every(row => !row.columns.includes('purchase_price'))).toBe(true)
  expect(costFilters.filter(([column,value]) => column === 'organization_id' && value === 'org')).toHaveLength(2)
})
