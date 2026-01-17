import { describe, it, expect, beforeEach } from 'vitest'
import { AnalyticsEngine } from '../analytics-engine'
import type { SaleEvent } from '../analytics-engine'

describe('AnalyticsEngine', () => {
  let engine: AnalyticsEngine

  beforeEach(() => {
    engine = new AnalyticsEngine()
  })

  describe('sale tracking', () => {
    it('should add sale event', () => {
      const sale: SaleEvent = {
        id: 'sale_1',
        timestamp: new Date(),
        total: 1000,
        items: [
          { product_id: 'prod_1', quantity: 2, price: 500, cost: 300 }
        ],
        payment_method: 'cash',
        cashier_id: 'user_1'
      }

      engine.addSale(sale)

      const metrics = engine.getTodayMetrics()
      expect(metrics.totalRevenue).toBe(1000)
      expect(metrics.totalSales).toBe(1)
    })

    it('should calculate profit correctly', () => {
      const sale: SaleEvent = {
        id: 'sale_1',
        timestamp: new Date(),
        total: 1000,
        items: [
          { product_id: 'prod_1', quantity: 1, price: 1000, cost: 600 }
        ],
        payment_method: 'cash',
        cashier_id: 'user_1'
      }

      engine.addSale(sale)

      const metrics = engine.getTodayMetrics()
      expect(metrics.totalProfit).toBe(400)
      expect(metrics.profitMargin).toBe(40)
    })

    it('should calculate average ticket', () => {
      const sales: SaleEvent[] = [
        {
          id: 'sale_1',
          timestamp: new Date(),
          total: 1000,
          items: [],
          payment_method: 'cash',
          cashier_id: 'user_1'
        },
        {
          id: 'sale_2',
          timestamp: new Date(),
          total: 2000,
          items: [],
          payment_method: 'card',
          cashier_id: 'user_1'
        }
      ]

      sales.forEach(sale => engine.addSale(sale))

      const metrics = engine.getTodayMetrics()
      expect(metrics.averageTicket).toBe(1500)
    })
  })

  describe('top products', () => {
    it('should track top selling products', () => {
      const sales: SaleEvent[] = [
        {
          id: 'sale_1',
          timestamp: new Date(),
          total: 1000,
          items: [
            { product_id: 'prod_1', product_name: 'Product 1', quantity: 2, price: 500, cost: 300 }
          ],
          payment_method: 'cash',
          cashier_id: 'user_1'
        },
        {
          id: 'sale_2',
          timestamp: new Date(),
          total: 500,
          items: [
            { product_id: 'prod_1', product_name: 'Product 1', quantity: 1, price: 500, cost: 300 }
          ],
          payment_method: 'cash',
          cashier_id: 'user_1'
        }
      ]

      sales.forEach(sale => engine.addSale(sale))

      const topProducts = engine.getTopProducts(5)
      expect(topProducts).toHaveLength(1)
      expect(topProducts[0].product_id).toBe('prod_1')
      expect(topProducts[0].quantity_sold).toBe(3)
      expect(topProducts[0].revenue).toBe(1500)
    })

    it('should sort products by revenue', () => {
      const sale: SaleEvent = {
        id: 'sale_1',
        timestamp: new Date(),
        total: 3000,
        items: [
          { product_id: 'prod_1', product_name: 'Product 1', quantity: 1, price: 1000, cost: 500 },
          { product_id: 'prod_2', product_name: 'Product 2', quantity: 1, price: 2000, cost: 1000 }
        ],
        payment_method: 'cash',
        cashier_id: 'user_1'
      }

      engine.addSale(sale)

      const topProducts = engine.getTopProducts(5)
      expect(topProducts[0].product_id).toBe('prod_2')
      expect(topProducts[0].revenue).toBe(2000)
    })
  })

  describe('category analysis', () => {
    it('should analyze sales by category', () => {
      const sale: SaleEvent = {
        id: 'sale_1',
        timestamp: new Date(),
        total: 3000,
        items: [
          { product_id: 'prod_1', category: 'Electronics', quantity: 1, price: 2000, cost: 1000 },
          { product_id: 'prod_2', category: 'Electronics', quantity: 1, price: 1000, cost: 500 }
        ],
        payment_method: 'cash',
        cashier_id: 'user_1'
      }

      engine.addSale(sale)

      const categories = engine.getCategoryAnalysis()
      expect(categories).toHaveLength(1)
      expect(categories[0].category).toBe('Electronics')
      expect(categories[0].revenue).toBe(3000)
      expect(categories[0].items_sold).toBe(2)
    })
  })

  describe('hourly metrics', () => {
    it('should track sales by hour', () => {
      const now = new Date()
      const sale: SaleEvent = {
        id: 'sale_1',
        timestamp: now,
        total: 1000,
        items: [],
        payment_method: 'cash',
        cashier_id: 'user_1'
      }

      engine.addSale(sale)

      const hourlyMetrics = engine.getHourlyMetrics()
      const currentHour = now.getHours()
      
      expect(hourlyMetrics[currentHour]).toBeDefined()
      expect(hourlyMetrics[currentHour].revenue).toBe(1000)
      expect(hourlyMetrics[currentHour].sales).toBe(1)
    })
  })

  describe('alerts', () => {
    it('should generate low sales alert', () => {
      // No sales added
      const alerts = engine.getAlerts()
      
      const lowSalesAlert = alerts.find(a => a.type === 'low_sales')
      expect(lowSalesAlert).toBeDefined()
      expect(lowSalesAlert?.severity).toBe('warning')
    })

    it('should generate low margin alert', () => {
      const sale: SaleEvent = {
        id: 'sale_1',
        timestamp: new Date(),
        total: 1000,
        items: [
          { product_id: 'prod_1', quantity: 1, price: 1000, cost: 950 } // 5% margin
        ],
        payment_method: 'cash',
        cashier_id: 'user_1'
      }

      engine.addSale(sale)

      const alerts = engine.getAlerts()
      const lowMarginAlert = alerts.find(a => a.type === 'low_margin')
      
      expect(lowMarginAlert).toBeDefined()
      expect(lowMarginAlert?.severity).toBe('warning')
    })

    it('should not generate alerts when metrics are healthy', () => {
      const sales: SaleEvent[] = Array.from({ length: 10 }, (_, i) => ({
        id: `sale_${i}`,
        timestamp: new Date(),
        total: 1000,
        items: [
          { product_id: 'prod_1', quantity: 1, price: 1000, cost: 500 } // 50% margin
        ],
        payment_method: 'cash',
        cashier_id: 'user_1'
      }))

      sales.forEach(sale => engine.addSale(sale))

      const alerts = engine.getAlerts()
      expect(alerts).toHaveLength(0)
    })
  })

  describe('comparison metrics', () => {
    it('should calculate revenue change', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const yesterdaySale: SaleEvent = {
        id: 'sale_yesterday',
        timestamp: yesterday,
        total: 1000,
        items: [],
        payment_method: 'cash',
        cashier_id: 'user_1'
      }

      const todaySale: SaleEvent = {
        id: 'sale_today',
        timestamp: new Date(),
        total: 1500,
        items: [],
        payment_method: 'cash',
        cashier_id: 'user_1'
      }

      engine.addSale(yesterdaySale)
      engine.addSale(todaySale)

      const metrics = engine.getTodayMetrics()
      expect(metrics.revenueChange).toBe(50) // 50% increase
    })
  })

  describe('data export', () => {
    it('should export sales data', () => {
      const sale: SaleEvent = {
        id: 'sale_1',
        timestamp: new Date(),
        total: 1000,
        items: [],
        payment_method: 'cash',
        cashier_id: 'user_1'
      }

      engine.addSale(sale)

      const exported = engine.exportData()
      expect(exported.sales).toHaveLength(1)
      expect(exported.metrics).toBeDefined()
    })
  })
})
