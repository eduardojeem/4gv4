import { describe, expect, it } from 'vitest'
import {
  buildInventoryRecommendations,
  calculateInventoryHealth,
  describeHealthScore,
  productIssues,
  type InventoryHealthInput,
} from '@/lib/inventory/inventory-health'
import { loadBranchInventoryStockMap } from '@/lib/branches/inventory'
import { fetchAllRows } from '@/lib/superadmin/fetch-all-rows'

const complete: InventoryHealthInput = {
  id: 'p1', name: 'Cargador USB-C', sku: 'CAR-001', barcode: null, category_id: 'c1', image_url: 'https://img/1.webp',
  is_active: true, stock_quantity: 12, min_stock: 3, max_stock: 0, purchase_price: 28000, sale_price: 45000,
}

describe('qué le pasa a cada producto', () => {
  it('un producto completo y con stock no tiene pendientes', () => {
    expect(productIssues(complete)).toEqual([])
  })

  it('detecta lo que hace perder ventas o plata', () => {
    expect(productIssues({ ...complete, stock_quantity: 0 })).toContain('out_of_stock')
    expect(productIssues({ ...complete, purchase_price: 50000 })).toContain('negative_margin')
    expect(productIssues({ ...complete, purchase_price: 0 })).toContain('missing_cost')
  })

  it('sin mínimo el sistema no puede avisar', () => {
    expect(productIssues({ ...complete, min_stock: 0 })).toContain('missing_min_stock')
  })

  it('un producto inactivo no se evalúa: no se vende', () => {
    expect(productIssues({ ...complete, is_active: false, stock_quantity: 0 })).toEqual([])
  })

  it('el SKU o el código de barras alcanzan', () => {
    expect(productIssues({ ...complete, sku: '', barcode: '7790001' })).not.toContain('missing_code')
    expect(productIssues({ ...complete, sku: ' ', barcode: null })).toContain('missing_code')
  })
})

describe('diagnóstico del catálogo', () => {
  it('cuenta, guarda ejemplos y puntúa', () => {
    const products = [
      complete,
      { ...complete, id: 'p2', name: 'Funda', stock_quantity: 0 },
      { ...complete, id: 'p3', name: 'Cable', purchase_price: 0 },
    ]
    const health = calculateInventoryHealth(products)
    expect(health.evaluated).toBe(3)
    expect(health.issues.out_of_stock).toEqual({ count: 1, samples: [{ id: 'p2', name: 'Funda', sku: 'CAR-001' }] })
    expect(health.issues.missing_cost.count).toBe(1)
    expect(health.score).toBeGreaterThan(0)
    expect(health.score).toBeLessThan(100)
  })

  it('un catálogo sano saca 100', () => {
    expect(calculateInventoryHealth([complete]).score).toBe(100)
    expect(describeHealthScore(100).tone).toBe('good')
  })

  it('limita los ejemplos a cinco', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ ...complete, id: `p${index}`, stock_quantity: 0 }))
    const health = calculateInventoryHealth(many)
    expect(health.issues.out_of_stock.count).toBe(12)
    expect(health.issues.out_of_stock.samples).toHaveLength(5)
  })
})

describe('qué recomienda el asistente', () => {
  it('pone primero lo urgente', () => {
    const health = calculateInventoryHealth([
      { ...complete, id: 'a', min_stock: 0 },
      { ...complete, id: 'b', stock_quantity: 0 },
      { ...complete, id: 'c', purchase_price: 60000 },
    ])
    const recommendations = buildInventoryRecommendations(health, { categories: 3, suppliers: 2, branchName: 'Centro' })
    expect(recommendations.map((item) => item.severity)).toEqual(['critical', 'critical', 'tip'])
    expect(recommendations[0]).toMatchObject({ key: 'out_of_stock', title: '1 producto agotado en Centro' })
    expect(recommendations[0].action).toEqual({ label: 'Ver agotados', tab: 'products', stockStatus: 'out' })
  })

  it('con el catálogo vacío pide lo básico para empezar', () => {
    const recommendations = buildInventoryRecommendations(calculateInventoryHealth([]), { categories: 0, suppliers: 0 })
    expect(recommendations.map((item) => item.key)).toEqual(['no_categories', 'no_suppliers', 'no_products'])
  })

  it('sin problemas no recomienda nada', () => {
    expect(buildInventoryRecommendations(calculateInventoryHealth([complete]), { categories: 1, suppliers: 1 })).toEqual([])
  })
})

describe('las consultas grandes no se cortan', () => {
  it('el stock de la sucursal se pide en lotes de 200 ids', async () => {
    const calls: number[] = []
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: (_field: string, ids: string[]) => {
              calls.push(ids.length)
              return Promise.resolve({ data: ids.map((id) => ({ product_id: id, stock_quantity: 1 })), error: null })
            },
          }),
        }),
      }),
    }
    const ids = Array.from({ length: 450 }, (_, index) => `p${index}`)
    const result = await loadBranchInventoryStockMap(client as never, 'sucursal', ids)
    expect(calls).toEqual([200, 200, 50])
    expect(result.stockMap.size).toBe(450)
    expect(result.failed).toBe(false)
  })

  it('recorre por páginas de 1000 y respeta el tope', async () => {
    const total = 2500
    const rows = await fetchAllRows((from, to) => Promise.resolve({
      data: Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, index) => from + index),
      error: null,
    }), 1000)
    expect(rows).toHaveLength(2500)

    const capped = await fetchAllRows((from, to) => Promise.resolve({
      data: Array.from({ length: to - from + 1 }, (_, index) => from + index),
      error: null,
    }), 1000, 1500)
    expect(capped).toHaveLength(1500)
  })
})
