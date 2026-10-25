import { describe, expect, it, vi } from 'vitest'
import { hydrateProductCostsFromService, hydrateVariantCostsFromService } from './cost-access'

type Rows = Record<string, Array<Record<string, unknown>>>

function serviceClient(rows: Rows) {
  const calls: Array<{ table: string; filters: Array<[string, unknown]> }> = []
  const from = vi.fn((table: string) => {
    const call = { table, filters: [] as Array<[string, unknown]> }
    calls.push(call)
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => { call.filters.push([column, value]); return builder },
      in: (column: string, values: unknown[]) => {
        call.filters.push([column, values])
        const org = call.filters.find(([c]) => c === 'organization_id')?.[1]
        const data = (rows[table] ?? []).filter(row => values.includes(row.id) && row.organization_id === org)
        return Promise.resolve({ data, error: null })
      },
    }
    return builder
  })
  return { client: { from } as never, calls }
}

describe('hydrateProductCostsFromService', () => {
  it('completa costos de producto y variantes acotados a la organización', async () => {
    const { client, calls } = serviceClient({
      products: [
        { id: 'p1', organization_id: 'A', purchase_price: 10, foreign_purchase_price: 2 },
        { id: 'p2', organization_id: 'B', purchase_price: 99, foreign_purchase_price: null },
      ],
      product_variants: [{ id: 'v1', organization_id: 'A', purchase_price: 4 }],
    })
    const [product, foreign] = await hydrateProductCostsFromService(client, 'A', [
      { id: 'p1', name: 'uno', variants: [{ id: 'v1' }] },
      { id: 'p2', name: 'de otra organización' },
    ], 'variants')
    expect(product).toMatchObject({ purchase_price: 10, foreign_purchase_price: 2, variants: [{ id: 'v1', purchase_price: 4 }] })
    expect(foreign).toMatchObject({ purchase_price: null, foreign_purchase_price: null })
    expect(calls.every(call => call.filters.some(([c, v]) => c === 'organization_id' && v === 'A'))).toBe(true)
  })

  it('sin filas no consulta', async () => {
    const { client, calls } = serviceClient({})
    expect(await hydrateProductCostsFromService(client, 'A', [])).toEqual([])
    expect(calls).toHaveLength(0)
  })
})

describe('hydrateVariantCostsFromService', () => {
  it('completa el costo de la variante y del producto embebido', async () => {
    const { client } = serviceClient({
      product_variants: [{ id: 'v1', organization_id: 'A', purchase_price: 4 }],
      products: [{ id: 'p1', organization_id: 'A', purchase_price: 10 }],
    })
    const [row] = await hydrateVariantCostsFromService(client, 'A', [{ id: 'v1', product_id: 'p1', product: { sale_price: 20 } }])
    expect(row).toMatchObject({ purchase_price: 4, product: { sale_price: 20, purchase_price: 10 } })
  })
})
