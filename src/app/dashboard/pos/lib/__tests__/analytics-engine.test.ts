import { beforeEach, describe, expect, it } from 'vitest'
import { AnalyticsEngine, type SaleEvent } from '../analytics-engine'

const sale = (overrides: Partial<SaleEvent> = {}): SaleEvent => ({
  id: 'sale-1', timestamp: new Date(), total: 200_000, subtotal: 200_000, tax: 0,
  payment_method: 'cash', cashier_id: 'cashier-1',
  items: [{ product_id: 'p-1', product_name: 'Remera', quantity: 2, price: 100_000, cost: 60_000, discount: 0, category: 'Ropa' }],
  ...overrides,
})

describe('AnalyticsEngine', () => {
  let engine: AnalyticsEngine
  beforeEach(() => { engine = new AnalyticsEngine() })

  it('calcula ingresos, utilidad y volumen del período', () => {
    engine.addSale(sale())
    const metrics = engine.getTodayMetrics()
    expect(metrics.totalRevenue).toBe(200_000)
    expect(metrics.totalProfit).toBe(80_000)
    expect(metrics.totalSales).toBe(1)
    expect(metrics.totalItems).toBe(2)
  })

  it('agrupa el resultado por categoría', () => {
    engine.addSale(sale())
    expect(engine.getCategoryMetrics()[0]).toMatchObject({ category: 'Ropa', revenue: 200_000, quantity_sold: 2 })
  })

  it('registra ventas en la hora correspondiente', () => {
    const timestamp = new Date()
    engine.addSale(sale({ timestamp }))
    expect(engine.getHourlyMetrics(timestamp)[timestamp.getHours()]).toMatchObject({ revenue: 200_000, sales_count: 1 })
  })

  it('permite limpiar las ventas acumuladas', () => {
    engine.addSale(sale())
    engine.clearSales()
    expect(engine.getTodayMetrics().totalSales).toBe(0)
  })
})
