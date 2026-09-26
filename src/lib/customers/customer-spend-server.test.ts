import { describe, expect, it } from 'vitest'
import { loadCustomerSpend } from './customer-spend-server'

const ORG = 'org-1'

type Pedido = { tabla: string; filtros: Array<[string, unknown]>; rango: [number, number] | null }

/** Base falsa que devuelve filas por tabla respetando `in` y `range`. */
function baseFalsa(filas: Record<string, Array<Record<string, unknown>>>, opciones: { falla?: string } = {}) {
  const pedidos: Pedido[] = []
  return {
    pedidos,
    from(tabla: string) {
      const pedido: Pedido = { tabla, filtros: [], rango: null }
      pedidos.push(pedido)
      interface FakeQueryBuilder {
        select: () => FakeQueryBuilder
        eq: (col: string, val: unknown) => FakeQueryBuilder
        in: (col: string, val: unknown) => FakeQueryBuilder
        order: () => FakeQueryBuilder
        range: (from: number, to: number) => FakeQueryBuilder
        then: (resolve: (v: unknown) => unknown) => unknown
      }
      const builder: FakeQueryBuilder = {
        select: () => builder,
        eq: (col: string, val: unknown) => { pedido.filtros.push([col, val]); return builder },
        in: (col: string, val: unknown) => { pedido.filtros.push([col, val]); return builder },
        order: () => builder,
        range: (from: number, to: number) => { pedido.rango = [from, to]; return builder },
        then: (resolve: (v: unknown) => unknown) => {
          if (opciones.falla === tabla) return resolve({ data: null, error: { message: 'caída' } })
          const ids = pedido.filtros.find(([c]) => c === 'customer_id')?.[1] as string[]
          const todas = (filas[tabla] ?? []).filter((f) => ids.includes(String(f.customer_id)))
          const [from, to] = pedido.rango ?? [0, todas.length - 1]
          return resolve({ data: todas.slice(from, to + 1), error: null })
        },
      }
      return builder
    },
  }
}

const venta = (customer_id: string, total_amount: number, status = 'completed') =>
  ({ id: `${customer_id}-${Math.random()}`, customer_id, total_amount, status, created_at: '2026-05-01' })

describe('lo gastado por muchos clientes', () => {
  /** Supabase corta en 1000 filas: sin paginar, el total quedaba recortado. */
  it('lee todas las filas, página por página', async () => {
    const muchas = Array.from({ length: 2500 }, () => venta('c1', 10))
    const db = baseFalsa({ sales: muchas })

    const result = await loadCustomerSpend(db, ORG, ['c1'])

    expect(result.c1.total).toBe(25000)
    expect(result.c1.purchaseCount).toBe(2500)
    expect(db.pedidos.filter((p) => p.tabla === 'sales').map((p) => p.rango)).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  /** Mandar todos los IDs juntos armaba URLs de varios KB. */
  it('parte los clientes en tandas', async () => {
    const ids = Array.from({ length: 320 }, (_, i) => `c${i}`)
    const db = baseFalsa({ sales: ids.map((id) => venta(id, 5)) })

    const result = await loadCustomerSpend(db, ORG, ids)

    expect(Object.keys(result)).toHaveLength(320)
    const tandas = db.pedidos.filter((p) => p.tabla === 'sales').map((p) => (p.filtros.find(([c]) => c === 'customer_id')![1] as string[]).length)
    expect(tandas).toEqual([150, 150, 20])
  })

  it('todo se acota a la empresa', async () => {
    const db = baseFalsa({})
    await loadCustomerSpend(db, ORG, ['c1'])
    for (const tabla of ['sales', 'customer_orders', 'repairs']) {
      expect(db.pedidos.find((p) => p.tabla === tabla)!.filtros).toContainEqual(['organization_id', ORG])
    }
  })

  it('aplica la regla única: ni ventas anuladas ni reparaciones sin terminar', async () => {
    const db = baseFalsa({
      sales: [venta('c1', 100), venta('c1', 999, 'cancelled')],
      customer_orders: [{ id: 'o1', customer_id: 'c1', total: 50, status: 'DELIVERED', created_at: '2026-06-01' }],
      repairs: [
        { id: 'r1', customer_id: 'c1', final_cost: null, estimated_cost: 30, status: 'entregado', created_at: '2026-07-01' },
        { id: 'r2', customer_id: 'c1', final_cost: 500, estimated_cost: 500, status: 'reparacion', created_at: '2026-08-01' },
      ],
    })

    const result = await loadCustomerSpend(db, ORG, ['c1'])
    expect(result.c1).toMatchObject({ total: 180, purchaseTotal: 150, repairTotal: 30, purchaseCount: 2, repairCount: 1 })
  })

  it('si una tabla falla lo dice, en vez de devolver un total parcial', async () => {
    const db = baseFalsa({ sales: [venta('c1', 100)] }, { falla: 'repairs' })
    await expect(loadCustomerSpend(db, ORG, ['c1'])).rejects.toThrow('No se pudo leer repairs')
  })

  it('sin clientes no consulta nada', async () => {
    const db = baseFalsa({})
    expect(await loadCustomerSpend(db, ORG, [])).toEqual({})
    expect(db.pedidos).toHaveLength(0)
  })
})
