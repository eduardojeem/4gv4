import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildBranchInsights, insightWindows, type SaleRow } from '@/lib/admin/branch-insights'

const TZ = 'America/Asuncion'
// 15 de noviembre de 2026, 15:00 en Asunción (UTC-3).
const NOW = new Date('2026-11-15T18:00:00Z')

const sale = (id: string, iso: string, total: number, extra: Partial<SaleRow> = {}): SaleRow => ({
  id, created_at: iso, total_amount: total, payment_method: 'cash', status: 'completed', ...extra,
})

const base = { timeZone: TZ, now: NOW, saleItems: [], productNames: new Map<string, string>(), inventory: [], registers: [], repairs: [], orders: [] }

describe('detalle por sucursal', () => {
  it('los cortes de día y mes son en la hora del comercio, no la del servidor', () => {
    const windows = insightWindows(TZ, NOW)
    expect(windows.today.toISOString()).toBe('2026-11-15T03:00:00.000Z')
    expect(windows.monthStart.toISOString()).toBe('2026-11-01T03:00:00.000Z')
    expect(windows.previousMonthStart.toISOString()).toBe('2026-10-01T03:00:00.000Z')
  })

  it('no cuenta las ventas anuladas y compara con el mismo tramo del mes pasado', () => {
    const insights = buildBranchInsights({
      ...base,
      sales: [
        sale('a', '2026-11-15T13:00:00Z', 100_000),
        sale('b', '2026-11-10T13:00:00Z', 50_000, { payment_method: 'card' }),
        sale('x', '2026-11-12T13:00:00Z', 999_000, { status: 'cancelled' }),
        sale('p', '2026-10-05T13:00:00Z', 100_000),
        // Fuera del tramo comparable (después del 15 de octubre a esta hora).
        sale('q', '2026-10-25T13:00:00Z', 500_000),
      ],
    })
    expect(insights.sales.today).toEqual({ count: 1, total: 100_000 })
    expect(insights.sales.month).toEqual({ count: 2, total: 150_000 })
    expect(insights.sales.previousMonth.total).toBe(100_000)
    expect(insights.sales.monthChangePct).toBe(50)
    expect(insights.sales.averageTicket).toBe(75_000)
    expect(insights.sales.paymentMix.map((m) => m.method)).toEqual(['cash', 'card'])
    expect(insights.sales.last7Days.daily).toHaveLength(7)
    expect(insights.sales.last7Days.daily[6]).toEqual({ date: '2026-11-15', total: 100_000 })
  })

  it('lo que más se vende, stock en alerta, cajas, reparaciones y pedidos', () => {
    const insights = buildBranchInsights({
      ...base,
      sales: [sale('a', '2026-11-14T13:00:00Z', 30_000)],
      saleItems: [
        { sale_id: 'a', product_id: 'p1', quantity: 2, total_price: 20_000, subtotal: null },
        { sale_id: 'a', product_id: 'p2', quantity: 1, total_price: 10_000, subtotal: null },
      ],
      productNames: new Map([['p1', 'Funda'], ['p2', 'Cargador'], ['p3', 'Vidrio']]),
      inventory: [
        { product_id: 'p1', stock_quantity: 10, min_stock: 2 },
        { product_id: 'p2', stock_quantity: 1, min_stock: 3 },
        { product_id: 'p3', stock_quantity: 0, min_stock: 0 },
      ],
      registers: [
        { id: 'r1', name: 'Caja 1', is_open: true, balance: 80_000, is_active: true },
        { id: 'r2', name: 'Vieja', is_open: false, balance: 0, is_active: false },
      ],
      repairs: [
        { status: 'reparacion', delivered_at: null, is_deleted: false },
        { status: 'listo', delivered_at: null, is_deleted: false },
        { status: 'entregado', delivered_at: '2026-11-03T13:00:00Z', is_deleted: false },
        { status: 'recibido', delivered_at: null, is_deleted: true },
      ],
      orders: [{ status: 'PENDING', total: 45_000 }, { status: 'DELIVERED', total: 1 }],
    })
    expect(insights.sales.topProducts.map((p) => p.name)).toEqual(['Funda', 'Cargador'])
    expect(insights.inventory).toMatchObject({ lowStock: 1, outOfStock: 1, units: 11 })
    expect(insights.inventory.alerts.map((a) => a.name)).toEqual(['Vidrio', 'Cargador'])
    expect(insights.cash).toEqual({ registers: [{ id: 'r1', name: 'Caja 1', isOpen: true, balance: 80_000 }], openCount: 1 })
    expect(insights.repairs).toEqual({ active: 1, ready: 1, deliveredThisMonth: 1 })
    expect(insights.orders).toEqual({ open: 1, openTotal: 45_000 })
  })

  it('el listado de sucursales tampoco suma las anuladas', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/admin/branches/route.ts'), 'utf8')
    expect(route.match(/\.in\('status', \[\.\.\.COMPLETED_SALE_STATUSES\]\)/g)).toHaveLength(2)
    expect(route).not.toContain('REVENUE_STATUS_FILTER')
  })

  it('cuenta solo ventas completadas, incluidas las del estado heredado', () => {
    const insights = buildBranchInsights({
      ...base,
      sales: ['completed', 'completada', 'pending', 'pendiente', 'cancelled', 'cancelada', 'refunded', null].map((status, index) =>
        sale(String(index), '2026-11-15T13:00:00Z', 100, { status })),
    })
    expect(insights.sales.month).toEqual({ count: 2, total: 200 })
  })

  it('el detalle se ve en la web y en la app', () => {
    expect(readFileSync(resolve(process.cwd(), 'src/components/admin/branches/branch-detail-dialog.tsx'), 'utf8')).toContain('<BranchInsightsPanel')
    expect(readFileSync(resolve(process.cwd(), 'mobile/src/app/admin/branches.tsx'), 'utf8')).toContain("pathname: '/admin/branch-detail'")
  })
})
