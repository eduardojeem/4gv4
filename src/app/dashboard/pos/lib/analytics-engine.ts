/**
 * Analytics Engine - Sistema de analytics en tiempo real para POS
 * 
 * Características:
 * - Métricas de ventas en tiempo real
 * - Productos más vendidos
 * - Análisis de tendencias
 * - Alertas automáticas
 * - Dashboard interactivo
 */

import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns'

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SaleEvent {
  id: string
  timestamp: Date
  total: number
  subtotal: number
  tax: number
  items: SaleItem[]
  payment_method: string
  customer_id?: string
  cashier_id: string
}

export interface SaleItem {
  product_id: string
  product_name: string
  quantity: number
  price: number
  cost: number
  discount: number
  category: string
}

export interface SalesMetrics {
  // Revenue
  totalRevenue: number
  totalProfit: number
  averageTicket: number
  profitMargin: number

  // Volume
  totalSales: number
  totalItems: number
  averageItems: number

  // Trends
  revenueChange: number // % change vs previous period
  salesChange: number
  profitChange: number

  // Time
  period: string
  startDate: Date
  endDate: Date
}

export interface ProductMetrics {
  product_id: string
  product_name: string
  category: string
  
  // Sales
  quantity_sold: number
  revenue: number
  profit: number
  
  // Performance
  sales_count: number
  average_price: number
  profit_margin: number
  
  // Ranking
  rank: number
  trend: 'up' | 'down' | 'stable'
}

export interface CategoryMetrics {
  category: string
  revenue: number
  profit: number
  quantity_sold: number
  sales_count: number
  profit_margin: number
  percentage_of_total: number
}

export interface HourlyMetrics {
  hour: number
  revenue: number
  sales_count: number
  average_ticket: number
}

export interface Alert {
  id: string
  type: AlertType
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  timestamp: Date
  data?: any
  acknowledged: boolean
}

export type AlertType =
  | 'low_stock'
  | 'high_sales'
  | 'low_sales'
  | 'profit_drop'
  | 'unusual_activity'
  | 'goal_reached'

export interface AnalyticsConfig {
  enableAlerts: boolean
  alertThresholds: {
    lowStock: number
    highSalesMultiplier: number
    lowSalesMultiplier: number
    profitDropPercentage: number
  }
  refreshInterval: number
}

// ============================================================================
// Analytics Engine Class
// ============================================================================

class AnalyticsEngine {
  private sales: SaleEvent[] = []
  private alerts: Alert[] = []
  private config: AnalyticsConfig = {
    enableAlerts: true,
    alertThresholds: {
      lowStock: 10,
      highSalesMultiplier: 2.0,
      lowSalesMultiplier: 0.5,
      profitDropPercentage: 20,
    },
    refreshInterval: 60000, // 1 minute
  }

  private listeners: Set<() => void> = new Set()
  private alertListeners: Set<(alert: Alert) => void> = new Set()

  /**
   * Add sale event
   */
  addSale(sale: SaleEvent): void {
    this.sales.push(sale)

    // Check for alerts
    if (this.config.enableAlerts) {
      this.checkAlerts(sale)
    }

    // Notify listeners
    this.notifyListeners()
  }

  /**
   * Add multiple sales
   */
  addSales(sales: SaleEvent[]): void {
    this.sales.push(...sales)
    this.notifyListeners()
  }

  /**
   * Clear all sales
   */
  clearSales(): void {
    this.sales = []
    this.notifyListeners()
  }

  // ==========================================================================
  // Metrics Calculation
  // ==========================================================================

  /**
   * Get sales metrics for a period
   */
  getSalesMetrics(startDate: Date, endDate: Date): SalesMetrics {
    const periodSales = this.getSalesInPeriod(startDate, endDate)

    // Calculate current period metrics
    const totalRevenue = periodSales.reduce((sum, sale) => sum + sale.total, 0)
    const totalCost = periodSales.reduce(
      (sum, sale) =>
        sum + sale.items.reduce((itemSum, item) => itemSum + item.cost * item.quantity, 0),
      0
    )
    const totalProfit = totalRevenue - totalCost
    const totalSales = periodSales.length
    const totalItems = periodSales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    )

    // Calculate previous period for comparison
    const periodLength = endDate.getTime() - startDate.getTime()
    const prevStartDate = new Date(startDate.getTime() - periodLength)
    const prevEndDate = startDate

    const prevSales = this.getSalesInPeriod(prevStartDate, prevEndDate)
    const prevRevenue = prevSales.reduce((sum, sale) => sum + sale.total, 0)
    const prevCost = prevSales.reduce(
      (sum, sale) =>
        sum + sale.items.reduce((itemSum, item) => itemSum + item.cost * item.quantity, 0),
      0
    )
    const prevProfit = prevRevenue - prevCost

    return {
      totalRevenue,
      totalProfit,
      averageTicket: totalSales > 0 ? totalRevenue / totalSales : 0,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      totalSales,
      totalItems,
      averageItems: totalSales > 0 ? totalItems / totalSales : 0,
      revenueChange: this.calculatePercentageChange(prevRevenue, totalRevenue),
      salesChange: this.calculatePercentageChange(prevSales.length, totalSales),
      profitChange: this.calculatePercentageChange(prevProfit, totalProfit),
      period: `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`,
      startDate,
      endDate,
    }
  }

  /**
   * Get today's metrics
   */
  getTodayMetrics(): SalesMetrics {
    const today = new Date()
    return this.getSalesMetrics(startOfDay(today), endOfDay(today))
  }

  /**
   * Get this week's metrics
   */
  getWeekMetrics(): SalesMetrics {
    const today = new Date()
    const weekStart = subDays(today, 7)
    return this.getSalesMetrics(weekStart, today)
  }

  /**
   * Get this month's metrics
   */
  getMonthMetrics(): SalesMetrics {
    const today = new Date()
    const monthStart = subDays(today, 30)
    return this.getSalesMetrics(monthStart, today)
  }

  /**
   * Get top products
   */
  getTopProducts(limit: number = 10, startDate?: Date, endDate?: Date): ProductMetrics[] {
    const sales = startDate && endDate
      ? this.getSalesInPeriod(startDate, endDate)
      : this.sales

    // Aggregate by product
    const productMap = new Map<string, ProductMetrics>()

    for (const sale of sales) {
      for (const item of sale.items) {
        const existing = productMap.get(item.product_id)

        if (existing) {
          existing.quantity_sold += item.quantity
          existing.revenue += item.price * item.quantity
          existing.profit += (item.price - item.cost) * item.quantity
          existing.sales_count += 1
        } else {
          productMap.set(item.product_id, {
            product_id: item.product_id,
            product_name: item.product_name,
            category: item.category,
            quantity_sold: item.quantity,
            revenue: item.price * item.quantity,
            profit: (item.price - item.cost) * item.quantity,
            sales_count: 1,
            average_price: item.price,
            profit_margin: ((item.price - item.cost) / item.price) * 100,
            rank: 0,
            trend: 'stable',
          })
        }
      }
    }

    // Sort by revenue and assign ranks
    const products = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
      .map((product, index) => ({
        ...product,
        rank: index + 1,
        average_price: product.revenue / product.quantity_sold,
        profit_margin: (product.profit / product.revenue) * 100,
      }))

    // Calculate trends (compare with previous period)
    // TODO: Implement trend calculation

    return products
  }

  /**
   * Get category metrics
   */
  getCategoryMetrics(startDate?: Date, endDate?: Date): CategoryMetrics[] {
    const sales = startDate && endDate
      ? this.getSalesInPeriod(startDate, endDate)
      : this.sales

    const categoryMap = new Map<string, CategoryMetrics>()
    let totalRevenue = 0

    for (const sale of sales) {
      for (const item of sale.items) {
        const revenue = item.price * item.quantity
        const profit = (item.price - item.cost) * item.quantity

        totalRevenue += revenue

        const existing = categoryMap.get(item.category)

        if (existing) {
          existing.revenue += revenue
          existing.profit += profit
          existing.quantity_sold += item.quantity
          existing.sales_count += 1
        } else {
          categoryMap.set(item.category, {
            category: item.category,
            revenue,
            profit,
            quantity_sold: item.quantity,
            sales_count: 1,
            profit_margin: 0,
            percentage_of_total: 0,
          })
        }
      }
    }

    // Calculate percentages and profit margins
    return Array.from(categoryMap.values())
      .map((cat) => ({
        ...cat,
        profit_margin: (cat.profit / cat.revenue) * 100,
        percentage_of_total: (cat.revenue / totalRevenue) * 100,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }

  /**
   * Get hourly metrics
   */
  getHourlyMetrics(date: Date = new Date()): HourlyMetrics[] {
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)
    const sales = this.getSalesInPeriod(dayStart, dayEnd)

    const hourlyMap = new Map<number, HourlyMetrics>()

    // Initialize all hours
    for (let hour = 0; hour < 24; hour++) {
      hourlyMap.set(hour, {
        hour,
        revenue: 0,
        sales_count: 0,
        average_ticket: 0,
      })
    }

    // Aggregate sales by hour
    for (const sale of sales) {
      const hour = sale.timestamp.getHours()
      const metrics = hourlyMap.get(hour)!

      metrics.revenue += sale.total
      metrics.sales_count += 1
    }

    // Calculate averages
    return Array.from(hourlyMap.values()).map((metrics) => ({
      ...metrics,
      average_ticket: metrics.sales_count > 0 ? metrics.revenue / metrics.sales_count : 0,
    }))
  }

  // ==========================================================================
  // Alerts
  // ==========================================================================

  /**
   * Check for alerts based on sale
   */
  private checkAlerts(sale: SaleEvent): void {
    // Check for high sales
    const todayMetrics = this.getTodayMetrics()
    const avgTicket = todayMetrics.averageTicket

    if (sale.total > avgTicket * this.config.alertThresholds.highSalesMultiplier) {
      this.createAlert({
        type: 'high_sales',
        severity: 'info',
        title: 'Venta Alta Detectada',
        message: `Venta de $${sale.total.toFixed(2)} (${(
          (sale.total / avgTicket) *
          100
        ).toFixed(0)}% sobre el promedio)`,
        data: { sale_id: sale.id, amount: sale.total },
      })
    }

    // Check for unusual activity (many items)
    if (sale.items.length > 20) {
      this.createAlert({
        type: 'unusual_activity',
        severity: 'warning',
        title: 'Actividad Inusual',
        message: `Venta con ${sale.items.length} items (revisar)`,
        data: { sale_id: sale.id, items_count: sale.items.length },
      })
    }
  }

  /**
   * Create alert
   */
  private createAlert(
    alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>
  ): void {
    const newAlert: Alert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false,
    }

    this.alerts.push(newAlert)

    // Notify alert listeners
    this.alertListeners.forEach((listener) => listener(newAlert))

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }
  }

  /**
   * Get all alerts
   */
  getAlerts(unacknowledgedOnly: boolean = false): Alert[] {
    if (unacknowledgedOnly) {
      return this.alerts.filter((a) => !a.acknowledged)
    }
    return [...this.alerts]
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(id: string): void {
    const alert = this.alerts.find((a) => a.id === id)
    if (alert) {
      alert.acknowledged = true
      this.notifyListeners()
    }
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = []
    this.notifyListeners()
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Get sales in period
   */
  private getSalesInPeriod(startDate: Date, endDate: Date): SaleEvent[] {
    return this.sales.filter((sale) =>
      isWithinInterval(sale.timestamp, { start: startDate, end: endDate })
    )
  }

  /**
   * Calculate percentage change
   */
  private calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue > 0 ? 100 : 0
    return ((newValue - oldValue) / oldValue) * 100
  }

  /**
   * Add listener
   */
  addListener(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Add alert listener
   */
  addAlertListener(listener: (alert: Alert) => void): () => void {
    this.alertListeners.add(listener)
    return () => this.alertListeners.delete(listener)
  }

  /**
   * Notify listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener())
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get configuration
   */
  getConfig(): AnalyticsConfig {
    return { ...this.config }
  }

  /**
   * Export data for analysis
   */
  exportData(startDate?: Date, endDate?: Date): {
    sales: SaleEvent[]
    metrics: SalesMetrics
    topProducts: ProductMetrics[]
    categories: CategoryMetrics[]
  } {
    const sales = startDate && endDate
      ? this.getSalesInPeriod(startDate, endDate)
      : this.sales

    const metrics = startDate && endDate
      ? this.getSalesMetrics(startDate, endDate)
      : this.getTodayMetrics()

    return {
      sales,
      metrics,
      topProducts: this.getTopProducts(20, startDate, endDate),
      categories: this.getCategoryMetrics(startDate, endDate),
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const analyticsEngine = new AnalyticsEngine()

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount)
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

/**
 * Get trend icon
 */
export function getTrendIcon(change: number): '📈' | '📉' | '➡️' {
  if (change > 5) return '📈'
  if (change < -5) return '📉'
  return '➡️'
}
