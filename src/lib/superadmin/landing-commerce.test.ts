import { describe, expect, it } from 'vitest'
import { localDay, summarizeCommerce } from './landing-commerce'
import { resolveCommerceRange } from './commerce-range'

// Mediodía en Paraguay (UTC-3): el día local es el 16.
const NOW = new Date('2026-09-16T15:00:00Z').getTime()
const hace = (dias: number) => new Date(NOW - dias * 86_400_000).toISOString()

const base = {
  range: resolveCommerceRange({ periodo: '7' }, NOW),
  sales: [
    { organization_id: 'a', total_amount: 100_000, status: 'completed', created_at: hace(1) },
    { organization_id: 'a', total_amount: 50_000, status: 'completada', created_at: hace(2) },
    // Anulada: no suma.
    { organization_id: 'a', total_amount: 900_000, status: 'cancelled', created_at: hace(1) },
    // Período anterior.
    { organization_id: 'a', total_amount: 100_000, status: 'completed', created_at: hace(9) },
  ],
  orders: [
    { organization_id: 'b', total: 80_000, status: 'ENTREGADO', payment_status: 'PAGADO', created_at: hace(0) },
    // Sin pagar: cuenta como pedido, no como plata.
    { organization_id: 'b', total: 60_000, status: 'CONFIRMADO', payment_status: 'PENDIENTE', created_at: hace(3) },
    { organization_id: 'b', total: 70_000, status: 'CANCELADO', payment_status: 'PENDIENTE', created_at: hace(3) },
  ],
  visits: [
    { organization_id: 'b', day: localDay(hace(0)), page: 'inicio', views: 30, visitors: 20 },
    { organization_id: 'b', day: localDay(hace(1)), page: 'producto', views: 50, visitors: 5 },
    { organization_id: 'a', day: localDay(hace(20)), page: 'inicio', views: 99, visitors: 99 },
  ],
  items: [
    { organization_id: 'a', product_key: 'p1', product_name: 'Cargador 20W', quantity: 3, total: 120_000, created_at: hace(1), countable: true },
    { organization_id: 'a', product_key: 'p1', product_name: 'Cargador 20W', quantity: 1, total: 40_000, created_at: hace(2), countable: true },
    { organization_id: 'a', product_key: 'p2', product_name: 'Funda', quantity: 9, total: 900_000, created_at: hace(1), countable: false },
  ],
}

describe('métricas comerciales de las tiendas', () => {
  it('suma lo vendido por mostrador y lo cobrado online', () => {
    const r = summarizeCommerce(base)
    expect(r.byStore.a.counterRevenue).toBe(150_000)
    expect(r.byStore.a.counterSales).toBe(2)
    expect(r.byStore.b.onlineOrders).toBe(2)
    expect(r.byStore.b.onlineRevenue).toBe(80_000)
    expect(r.totals.sold).toBe(230_000)
  })

  it('compara contra el período anterior', () => {
    const r = summarizeCommerce(base)
    expect(r.totals.previousSold).toBe(100_000)
    expect(r.totals.deltaPercent).toBe(130)
  })

  it('el ticket promedio usa solo lo que se cobró', () => {
    // 230.000 entre 2 ventas de mostrador y 1 pedido pagado.
    expect(summarizeCommerce(base).totals.averageTicket).toBe(76_667)
  })

  it('cuenta visitas del período y calcula la conversión', () => {
    const r = summarizeCommerce(base)
    expect(r.byStore.b.visitors).toBe(25)
    expect(r.byStore.b.conversion).toBe(8)
    expect(r.totals.visitors).toBe(25)
    expect(r.viewsByPage).toEqual({ inicio: 30, producto: 50 })
  })

  /** Sin la migración no hay visitas: no es lo mismo que cero visitas. */
  it('sin registro de visitas no inventa ceros ni conversión', () => {
    const r = summarizeCommerce({ ...base, visits: null })
    expect(r.visitsAvailable).toBe(false)
    expect(r.totals.visitors).toBeNull()
    expect(r.byStore.b.conversion).toBeNull()
    expect(r.series.every((d) => d.visitors === null)).toBe(true)
  })

  it('arma un día por cada día del período, en hora de Paraguay', () => {
    const r = summarizeCommerce(base)
    expect(r.granularity).toBe('day')
    expect(r.series).toHaveLength(7)
    expect(r.range.to).toBe('2026-09-16')
    expect(r.series.at(-1)).toEqual({ bucket: '2026-09-16', sold: 80_000, visitors: 20 })
  })

  /** Un año de barras diarias no se lee: se agrupa por mes. */
  it('en un año agrupa por mes y compara con el año anterior', () => {
    const r = summarizeCommerce({
      ...base,
      range: resolveCommerceRange({ periodo: '2025' }, NOW, 2024),
      sales: [
        { organization_id: 'a', total_amount: 100_000, status: 'completed', created_at: '2025-03-10T15:00:00Z' },
        { organization_id: 'a', total_amount: 50_000, status: 'completed', created_at: '2025-03-28T15:00:00Z' },
        { organization_id: 'a', total_amount: 30_000, status: 'completed', created_at: '2025-12-31T20:00:00Z' },
        { organization_id: 'a', total_amount: 90_000, status: 'completed', created_at: '2024-06-01T15:00:00Z' },
      ],
      orders: [],
      visits: null,
    })
    expect(r.granularity).toBe('month')
    expect(r.series).toHaveLength(12)
    expect(r.series[2]).toEqual({ bucket: '2025-03-01', sold: 150_000, visitors: null })
    expect(r.series[11].sold).toBe(30_000)
    expect(r.totals.previousSold).toBe(90_000)
    expect(r.totals.deltaPercent).toBe(100)
  })

  it('lo más vendido agrupa por producto y deja afuera lo anulado', () => {
    expect(summarizeCommerce(base).topProducts).toEqual([
      { key: 'a:p1', name: 'Cargador 20W', organizationId: 'a', units: 4, revenue: 160_000 },
    ])
  })

})
