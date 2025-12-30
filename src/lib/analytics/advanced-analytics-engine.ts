'use client'

import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'

// Tipos para analytics avanzados
export interface AdvancedAnalyticsData {
  sales: SalesAnalytics
  customers: CustomerAnalytics
  products: ProductAnalytics
  financial: FinancialAnalytics
  operational: OperationalAnalytics
  predictive: PredictiveAnalytics
}

export interface SalesAnalytics {
  totalRevenue: number
  totalSales: number
  averageOrderValue: number
  salesGrowth: number
  topSellingProducts: ProductSalesData[]
  salesByPeriod: TimeSeries[]
  salesByCategory: CategorySales[]
  salesByPaymentMethod: PaymentMethodSales[]
  conversionRate: number
  salesForecast: ForecastData[]
}

export interface CustomerAnalytics {
  totalCustomers: number
  newCustomers: number
  activeCustomers: number
  customerRetentionRate: number
  customerLifetimeValue: number
  customerAcquisitionCost: number
  customerSegments: CustomerSegment[]
  customerSatisfactionScore: number
  churnRate: number
  loyaltyMetrics: LoyaltyMetrics
}

export interface ProductAnalytics {
  totalProducts: number
  activeProducts: number
  inventoryValue: number
  stockTurnover: number
  profitMargins: MarginAnalysis
  productPerformance: ProductPerformance[]
  categoryPerformance: CategoryPerformance[]
  supplierPerformance: SupplierPerformance[]
  stockAlerts: StockAlert[]
  demandForecast: DemandForecast[]
}

export interface FinancialAnalytics {
  grossRevenue: number
  netRevenue: number
  totalCosts: number
  grossProfit: number
  netProfit: number
  profitMargin: number
  cashFlow: CashFlowData[]
  expenseBreakdown: ExpenseCategory[]
  revenueStreams: RevenueStream[]
  financialRatios: FinancialRatios
}

export interface OperationalAnalytics {
  systemPerformance: SystemMetrics
  userActivity: UserActivityMetrics
  processEfficiency: ProcessMetrics
  errorRates: ErrorMetrics
  uptime: UptimeMetrics
  resourceUtilization: ResourceMetrics
}

export interface PredictiveAnalytics {
  salesForecast: ForecastData[]
  demandPrediction: DemandPrediction[]
  customerBehaviorPrediction: BehaviorPrediction[]
  inventoryOptimization: InventoryOptimization[]
  riskAssessment: RiskAssessment[]
  marketTrends: MarketTrend[]
}

// Tipos auxiliares
export interface TimeSeries {
  date: string
  value: number
  label?: string
}

export interface ProductSalesData {
  productId: string
  productName: string
  totalSales: number
  revenue: number
  quantity: number
  growth: number
}

export interface CategorySales {
  category: string
  sales: number
  revenue: number
  percentage: number
}

export interface PaymentMethodSales {
  method: string
  count: number
  amount: number
  percentage: number
}

export interface ForecastData {
  period: string
  predicted: number
  confidence: number
  trend: 'up' | 'down' | 'stable'
}

export interface CustomerSegment {
  segment: string
  count: number
  value: number
  characteristics: string[]
}

export interface LoyaltyMetrics {
  repeatCustomers: number
  averageOrderFrequency: number
  loyaltyScore: number
}

export interface MarginAnalysis {
  averageMargin: number
  marginByCategory: { category: string; margin: number }[]
  topMarginProducts: { product: string; margin: number }[]
}

export interface ProductPerformance {
  productId: string
  name: string
  sales: number
  revenue: number
  margin: number
  turnover: number
  rating: number
}

export interface CategoryPerformance {
  category: string
  products: number
  sales: number
  revenue: number
  margin: number
  growth: number
}

export interface SupplierPerformance {
  supplierId: string
  name: string
  products: number
  totalValue: number
  deliveryScore: number
  qualityScore: number
}

export interface StockAlert {
  productId: string
  productName: string
  currentStock: number
  minimumStock: number
  severity: 'low' | 'critical' | 'out'
  estimatedDaysLeft: number
}

export interface DemandForecast {
  productId: string
  productName: string
  predictedDemand: number
  confidence: number
  seasonality: number
}

export interface CashFlowData {
  date: string
  inflow: number
  outflow: number
  netFlow: number
}

export interface ExpenseCategory {
  category: string
  amount: number
  percentage: number
  trend: number
}

export interface RevenueStream {
  source: string
  amount: number
  percentage: number
  growth: number
}

export interface FinancialRatios {
  currentRatio: number
  quickRatio: number
  debtToEquity: number
  returnOnAssets: number
  returnOnEquity: number
}

export interface SystemMetrics {
  responseTime: number
  throughput: number
  errorRate: number
  availability: number
}

export interface UserActivityMetrics {
  activeUsers: number
  sessionDuration: number
  pageViews: number
  bounceRate: number
}

export interface ProcessMetrics {
  orderProcessingTime: number
  inventoryTurnover: number
  customerServiceTime: number
  fulfillmentRate: number
}

export interface ErrorMetrics {
  totalErrors: number
  errorRate: number
  criticalErrors: number
  errorsByType: { type: string; count: number }[]
}

export interface UptimeMetrics {
  uptime: number
  downtime: number
  availability: number
  incidents: number
}

export interface ResourceMetrics {
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  networkUsage: number
}

export interface DemandPrediction {
  productId: string
  predictedDemand: number
  confidence: number
  factors: string[]
}

export interface BehaviorPrediction {
  customerId: string
  predictedActions: string[]
  churnProbability: number
  lifetimeValue: number
}

export interface InventoryOptimization {
  productId: string
  currentStock: number
  optimalStock: number
  reorderPoint: number
  economicOrderQuantity: number
}

export interface RiskAssessment {
  riskType: string
  probability: number
  impact: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  mitigation: string[]
}

export interface MarketTrend {
  trend: string
  direction: 'up' | 'down' | 'stable'
  strength: number
  timeframe: string
  impact: string
}

// Configuración de analytics
export interface AnalyticsConfig {
  refreshInterval: number
  dataRetention: number
  enableRealTime: boolean
  enablePredictive: boolean
  enableAlerts: boolean
  alertThresholds: AlertThresholds
}

export interface AlertThresholds {
  lowStock: number
  highChurnRate: number
  lowConversionRate: number
  highErrorRate: number
  lowProfitMargin: number
}

// Clase principal del motor de analytics
export class AdvancedAnalyticsEngine {
  private supabase = createClient()
  private config: AnalyticsConfig
  private cache = new Map<string, { data: unknown; timestamp: number }>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutos

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      refreshInterval: 30000, // 30 segundos
      dataRetention: 365, // 365 días
      enableRealTime: true,
      enablePredictive: true,
      enableAlerts: true,
      alertThresholds: {
        lowStock: 10,
        highChurnRate: 0.1,
        lowConversionRate: 0.02,
        highErrorRate: 0.05,
        lowProfitMargin: 0.1
      },
      ...config
    }
  }

  // Método principal para obtener todos los analytics
  async getAdvancedAnalytics(dateRange?: { start: Date; end: Date }): Promise<AdvancedAnalyticsData> {
    const cacheKey = `analytics_${dateRange?.start?.toISOString()}_${dateRange?.end?.toISOString()}`
    
    // Verificar cache
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }

    try {
      const [
        sales,
        customers,
        products,
        financial,
        operational,
        predictive
      ] = await Promise.all([
        this.getSalesAnalytics(dateRange),
        this.getCustomerAnalytics(dateRange),
        this.getProductAnalytics(dateRange),
        this.getFinancialAnalytics(dateRange),
        this.getOperationalAnalytics(dateRange),
        this.config.enablePredictive ? this.getPredictiveAnalytics(dateRange) : this.getEmptyPredictiveAnalytics()
      ])

      const result: AdvancedAnalyticsData = {
        sales,
        customers,
        products,
        financial,
        operational,
        predictive
      }

      // Guardar en cache
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() })

      return result
    } catch (error) {
      console.error('Error getting advanced analytics:', error)
      return this.getEmptyAnalytics()
    }
  }

  // Analytics de ventas
  private async getSalesAnalytics(dateRange?: { start: Date; end: Date }): Promise<SalesAnalytics> {
    if (!config.supabase.isConfigured) {
      return this.getMockSalesAnalytics()
    }

    try {
      let query = this.supabase
        .from('sales')
        .select(`
          *,
          sale_items (
            *,
            products (*)
          )
        `)

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
      }

      const { data: sales, error } = await query

      if (error) throw error

      return this.processSalesData(sales || [])
    } catch (error) {
      console.error('Error fetching sales analytics:', error)
      return this.getMockSalesAnalytics()
    }
  }

  // Analytics de clientes
  private async getCustomerAnalytics(dateRange?: { start: Date; end: Date }): Promise<CustomerAnalytics> {
    if (!config.supabase.isConfigured) {
      return this.getMockCustomerAnalytics()
    }

    try {
      const { data: customers, error } = await this.supabase
        .from('customers')
        .select('*')

      if (error) throw error

      return this.processCustomerData(customers || [], dateRange)
    } catch (error) {
      console.error('Error fetching customer analytics:', error)
      return this.getMockCustomerAnalytics()
    }
  }

  // Analytics de productos
  private async getProductAnalytics(dateRange?: { start: Date; end: Date }): Promise<ProductAnalytics> {
    if (!config.supabase.isConfigured) {
      return this.getMockProductAnalytics()
    }

    try {
      const { data: products, error } = await this.supabase
        .from('products')
        .select(`
          *,
          categories (*),
          suppliers (*)
        `)

      if (error) throw error

      return this.processProductData(products || [], dateRange)
    } catch (error) {
      console.error('Error fetching product analytics:', error)
      return this.getMockProductAnalytics()
    }
  }

  // Analytics financieros
  private async getFinancialAnalytics(dateRange?: { start: Date; end: Date }): Promise<FinancialAnalytics> {
    if (!config.supabase.isConfigured) {
      return this.getMockFinancialAnalytics()
    }

    try {
      // Obtener datos de ventas y gastos
      const [salesData, expensesData] = await Promise.all([
        this.supabase.from('sales').select('*'),
        this.supabase.from('expenses').select('*').catch(() => ({ data: [] }))
      ])

      return this.processFinancialData(salesData.data || [], expensesData.data || [], dateRange)
    } catch (error) {
      console.error('Error fetching financial analytics:', error)
      return this.getMockFinancialAnalytics()
    }
  }

  // Analytics operacionales
  private async getOperationalAnalytics(dateRange?: { start: Date; end: Date }): Promise<OperationalAnalytics> {
    // En un entorno real, esto se conectaría a sistemas de monitoreo
    return this.getMockOperationalAnalytics()
  }

  // Analytics predictivos
  private async getPredictiveAnalytics(dateRange?: { start: Date; end: Date }): Promise<PredictiveAnalytics> {
    // En un entorno real, esto usaría modelos de ML
    return this.getMockPredictiveAnalytics()
  }

  // Métodos de procesamiento de datos
  private processSalesData(sales: Array<Record<string, unknown>>): SalesAnalytics {
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0)
    const totalSales = sales.length
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0

    // Calcular crecimiento (simulado)
    const salesGrowth = 12.5

    // Top productos vendidos
    const productSales = new Map<string, { name: string; sales: number; revenue: number; quantity: number }>()
    
    sales.forEach(sale => {
      const saleItems = sale.sale_items as Array<Record<string, unknown>> | undefined
      saleItems?.forEach((item: Record<string, unknown>) => {
        const productId = item.product_id as string
        const productName = (item.products as Record<string, unknown>)?.name as string || 'Producto desconocido'
        const existing = productSales.get(productId) || { name: productName, sales: 0, revenue: 0, quantity: 0 }
        
        existing.sales += 1
        existing.revenue += item.subtotal || 0
        existing.quantity += item.quantity || 0
        
        productSales.set(productId, existing)
      })
    })

    const topSellingProducts: ProductSalesData[] = Array.from(productSales.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        totalSales: data.sales,
        revenue: data.revenue,
        quantity: data.quantity,
        growth: Math.random() * 20 - 10 // Simulado
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    return {
      totalRevenue,
      totalSales,
      averageOrderValue,
      salesGrowth,
      topSellingProducts,
      salesByPeriod: this.generateTimeSeries(sales, 'created_at', 'total_amount'),
      salesByCategory: this.generateCategorySales(sales),
      salesByPaymentMethod: this.generatePaymentMethodSales(sales),
      conversionRate: 3.24, // Simulado
      salesForecast: this.generateSalesForecast()
    }
  }

  private processCustomerData(customers: Array<Record<string, unknown>>, dateRange?: { start: Date; end: Date }): CustomerAnalytics {
    const totalCustomers = customers.length
    const newCustomers = customers.filter(c => {
      if (!dateRange) return false
      const createdAt = new Date(c.created_at)
      return createdAt >= dateRange.start && createdAt <= dateRange.end
    }).length

    return {
      totalCustomers,
      newCustomers,
      activeCustomers: Math.floor(totalCustomers * 0.7), // Simulado
      customerRetentionRate: 85.5, // Simulado
      customerLifetimeValue: 1250, // Simulado
      customerAcquisitionCost: 45, // Simulado
      customerSegments: this.generateCustomerSegments(customers),
      customerSatisfactionScore: 4.2, // Simulado
      churnRate: 5.5, // Simulado
      loyaltyMetrics: {
        repeatCustomers: Math.floor(totalCustomers * 0.4),
        averageOrderFrequency: 2.3,
        loyaltyScore: 7.8
      }
    }
  }

  private processProductData(products: Array<Record<string, unknown>>, dateRange?: { start: Date; end: Date }): ProductAnalytics {
    const totalProducts = products.length
    const activeProducts = products.filter(p => p.is_active).length
    const inventoryValue = products.reduce((sum, p) => sum + ((p.sale_price || 0) * (p.stock_quantity || 0)), 0)

    return {
      totalProducts,
      activeProducts,
      inventoryValue,
      stockTurnover: 4.2, // Simulado
      profitMargins: this.calculateProfitMargins(products),
      productPerformance: this.generateProductPerformance(products),
      categoryPerformance: this.generateCategoryPerformance(products),
      supplierPerformance: this.generateSupplierPerformance(products),
      stockAlerts: this.generateStockAlerts(products),
      demandForecast: this.generateDemandForecast(products)
    }
  }

  private processFinancialData(sales: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>, dateRange?: { start: Date; end: Date }): FinancialAnalytics {
    const grossRevenue = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0)
    const totalCosts = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0)
    const grossProfit = grossRevenue - totalCosts
    const profitMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0

    return {
      grossRevenue,
      netRevenue: grossRevenue * 0.95, // Simulado (después de devoluciones)
      totalCosts,
      grossProfit,
      netProfit: grossProfit * 0.8, // Simulado (después de impuestos)
      profitMargin,
      cashFlow: this.generateCashFlowData(sales, expenses),
      expenseBreakdown: this.generateExpenseBreakdown(expenses),
      revenueStreams: this.generateRevenueStreams(sales),
      financialRatios: {
        currentRatio: 2.1,
        quickRatio: 1.8,
        debtToEquity: 0.3,
        returnOnAssets: 12.5,
        returnOnEquity: 18.2
      }
    }
  }

  // Métodos auxiliares para generar datos
  private generateTimeSeries(data: Array<Record<string, unknown>>, dateField: string, valueField: string): TimeSeries[] {
    const series = new Map<string, number>()
    
    data.forEach(item => {
      const date = new Date(item[dateField]).toISOString().split('T')[0]
      const value = item[valueField] || 0
      series.set(date, (series.get(date) || 0) + value)
    })

    return Array.from(series.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  private generateCategorySales(sales: Array<Record<string, unknown>>): CategorySales[] {
    // Simulado - en un entorno real se calcularía desde los datos
    return [
      { category: 'Electrónicos', sales: 45, revenue: 125000, percentage: 35 },
      { category: 'Ropa', sales: 32, revenue: 85000, percentage: 24 },
      { category: 'Hogar', sales: 28, revenue: 75000, percentage: 21 },
      { category: 'Deportes', sales: 20, revenue: 55000, percentage: 15 },
      { category: 'Otros', sales: 15, revenue: 35000, percentage: 10 }
    ]
  }

  private generatePaymentMethodSales(sales: Array<Record<string, unknown>>): PaymentMethodSales[] {
    const methods = new Map<string, { count: number; amount: number }>()
    
    sales.forEach(sale => {
      const method = sale.payment_method || 'cash'
      const existing = methods.get(method) || { count: 0, amount: 0 }
      existing.count += 1
      existing.amount += sale.total_amount || 0
      methods.set(method, existing)
    })

    const total = sales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0)

    return Array.from(methods.entries()).map(([method, data]) => ({
      method,
      count: data.count,
      amount: data.amount,
      percentage: total > 0 ? (data.amount / total) * 100 : 0
    }))
  }

  private generateSalesForecast(): ForecastData[] {
    const forecast: ForecastData[] = []
    const baseValue = 50000
    
    for (let i = 1; i <= 12; i++) {
      const date = new Date()
      date.setMonth(date.getMonth() + i)
      
      forecast.push({
        period: date.toISOString().split('T')[0],
        predicted: baseValue + (Math.random() * 20000 - 10000),
        confidence: 0.75 + Math.random() * 0.2,
        trend: Math.random() > 0.5 ? 'up' : 'down'
      })
    }
    
    return forecast
  }

  // Métodos para datos mock
  private getMockSalesAnalytics(): SalesAnalytics {
    return {
      totalRevenue: 125000,
      totalSales: 450,
      averageOrderValue: 278,
      salesGrowth: 12.5,
      topSellingProducts: [
        { productId: '1', productName: 'iPhone 15', totalSales: 25, revenue: 25000, quantity: 25, growth: 15.2 },
        { productId: '2', productName: 'Samsung Galaxy S24', totalSales: 20, revenue: 18000, quantity: 20, growth: 8.7 }
      ],
      salesByPeriod: [
        { date: '2024-01-01', value: 15000 },
        { date: '2024-01-02', value: 18000 },
        { date: '2024-01-03', value: 22000 }
      ],
      salesByCategory: [
        { category: 'Electrónicos', sales: 45, revenue: 125000, percentage: 35 }
      ],
      salesByPaymentMethod: [
        { method: 'card', count: 280, amount: 85000, percentage: 68 },
        { method: 'cash', count: 170, amount: 40000, percentage: 32 }
      ],
      conversionRate: 3.24,
      salesForecast: this.generateSalesForecast()
    }
  }

  private getMockCustomerAnalytics(): CustomerAnalytics {
    return {
      totalCustomers: 1250,
      newCustomers: 85,
      activeCustomers: 875,
      customerRetentionRate: 85.5,
      customerLifetimeValue: 1250,
      customerAcquisitionCost: 45,
      customerSegments: [
        { segment: 'VIP', count: 125, value: 50000, characteristics: ['Alto valor', 'Frecuente'] },
        { segment: 'Regular', count: 750, value: 75000, characteristics: ['Compras regulares'] },
        { segment: 'Nuevo', count: 375, value: 25000, characteristics: ['Primera compra'] }
      ],
      customerSatisfactionScore: 4.2,
      churnRate: 5.5,
      loyaltyMetrics: {
        repeatCustomers: 500,
        averageOrderFrequency: 2.3,
        loyaltyScore: 7.8
      }
    }
  }

  private getMockProductAnalytics(): ProductAnalytics {
    return {
      totalProducts: 850,
      activeProducts: 720,
      inventoryValue: 450000,
      stockTurnover: 4.2,
      profitMargins: {
        averageMargin: 35.5,
        marginByCategory: [
          { category: 'Electrónicos', margin: 25.5 },
          { category: 'Ropa', margin: 45.2 }
        ],
        topMarginProducts: [
          { product: 'Producto A', margin: 65.5 },
          { product: 'Producto B', margin: 58.2 }
        ]
      },
      productPerformance: [],
      categoryPerformance: [],
      supplierPerformance: [],
      stockAlerts: [],
      demandForecast: []
    }
  }

  private getMockFinancialAnalytics(): FinancialAnalytics {
    return {
      grossRevenue: 125000,
      netRevenue: 118750,
      totalCosts: 75000,
      grossProfit: 50000,
      netProfit: 40000,
      profitMargin: 32.0,
      cashFlow: [],
      expenseBreakdown: [],
      revenueStreams: [],
      financialRatios: {
        currentRatio: 2.1,
        quickRatio: 1.8,
        debtToEquity: 0.3,
        returnOnAssets: 12.5,
        returnOnEquity: 18.2
      }
    }
  }

  private getMockOperationalAnalytics(): OperationalAnalytics {
    return {
      systemPerformance: {
        responseTime: 250,
        throughput: 1000,
        errorRate: 0.02,
        availability: 99.9
      },
      userActivity: {
        activeUsers: 145,
        sessionDuration: 12.5,
        pageViews: 2500,
        bounceRate: 25.5
      },
      processEfficiency: {
        orderProcessingTime: 2.5,
        inventoryTurnover: 4.2,
        customerServiceTime: 3.8,
        fulfillmentRate: 98.5
      },
      errorRates: {
        totalErrors: 25,
        errorRate: 0.02,
        criticalErrors: 2,
        errorsByType: [
          { type: 'Network', count: 15 },
          { type: 'Database', count: 8 },
          { type: 'Application', count: 2 }
        ]
      },
      uptime: {
        uptime: 99.9,
        downtime: 0.1,
        availability: 99.9,
        incidents: 1
      },
      resourceUtilization: {
        cpuUsage: 45.5,
        memoryUsage: 62.8,
        diskUsage: 35.2,
        networkUsage: 28.5
      }
    }
  }

  private getMockPredictiveAnalytics(): PredictiveAnalytics {
    return {
      salesForecast: this.generateSalesForecast(),
      demandPrediction: [],
      customerBehaviorPrediction: [],
      inventoryOptimization: [],
      riskAssessment: [],
      marketTrends: []
    }
  }

  private getEmptyPredictiveAnalytics(): PredictiveAnalytics {
    return {
      salesForecast: [],
      demandPrediction: [],
      customerBehaviorPrediction: [],
      inventoryOptimization: [],
      riskAssessment: [],
      marketTrends: []
    }
  }

  private getEmptyAnalytics(): AdvancedAnalyticsData {
    return {
      sales: this.getMockSalesAnalytics(),
      customers: this.getMockCustomerAnalytics(),
      products: this.getMockProductAnalytics(),
      financial: this.getMockFinancialAnalytics(),
      operational: this.getMockOperationalAnalytics(),
      predictive: this.getEmptyPredictiveAnalytics()
    }
  }

  // Métodos auxiliares adicionales
  private calculateProfitMargins(products: Array<Record<string, unknown>>): MarginAnalysis {
    const margins = products
      .filter(p => p.sale_price && p.purchase_price)
      .map(p => ((p.sale_price - p.purchase_price) / p.sale_price) * 100)
    
    const averageMargin = margins.length > 0 ? margins.reduce((sum, m) => sum + m, 0) / margins.length : 0

    return {
      averageMargin,
      marginByCategory: [],
      topMarginProducts: []
    }
  }

  private generateProductPerformance(products: Array<Record<string, unknown>>): ProductPerformance[] {
    return products.slice(0, 10).map(product => ({
      productId: product.id,
      name: product.name,
      sales: Math.floor(Math.random() * 100),
      revenue: Math.floor(Math.random() * 10000),
      margin: Math.random() * 50,
      turnover: Math.random() * 10,
      rating: 3 + Math.random() * 2
    }))
  }

  private generateCategoryPerformance(products: Array<Record<string, unknown>>): CategoryPerformance[] {
    const categories = new Map<string, Record<string, unknown>>()
    
    products.forEach(product => {
      const categoryName = product.categories?.name || 'Sin categoría'
      if (!categories.has(categoryName)) {
        categories.set(categoryName, {
          category: categoryName,
          products: 0,
          sales: 0,
          revenue: 0,
          margin: 0,
          growth: 0
        })
      }
      
      const category = categories.get(categoryName)!
      category.products += 1
      category.sales += Math.floor(Math.random() * 50)
      category.revenue += Math.floor(Math.random() * 5000)
      category.margin += Math.random() * 30
      category.growth = Math.random() * 20 - 10
    })

    return Array.from(categories.values())
  }

  private generateSupplierPerformance(products: Array<Record<string, unknown>>): SupplierPerformance[] {
    const suppliers = new Map<string, Record<string, unknown>>()
    
    products.forEach(product => {
      const supplierId = product.suppliers?.id || 'unknown'
      const supplierName = product.suppliers?.name || 'Proveedor desconocido'
      
      if (!suppliers.has(supplierId)) {
        suppliers.set(supplierId, {
          supplierId,
          name: supplierName,
          products: 0,
          totalValue: 0,
          deliveryScore: 0,
          qualityScore: 0
        })
      }
      
      const supplier = suppliers.get(supplierId)!
      supplier.products += 1
      supplier.totalValue += (product.purchase_price || 0) * (product.stock_quantity || 0)
      supplier.deliveryScore = 3 + Math.random() * 2
      supplier.qualityScore = 3 + Math.random() * 2
    })

    return Array.from(suppliers.values())
  }

  private generateStockAlerts(products: Array<Record<string, unknown>>): StockAlert[] {
    return products
      .filter(p => (p.stock_quantity || 0) < (p.minimum_stock || 10))
      .map(product => ({
        productId: product.id,
        productName: product.name,
        currentStock: product.stock_quantity || 0,
        minimumStock: product.minimum_stock || 10,
        severity: (product.stock_quantity || 0) === 0 ? 'out' : 
                 (product.stock_quantity || 0) < 5 ? 'critical' : 'low',
        estimatedDaysLeft: Math.max(0, Math.floor((product.stock_quantity || 0) / 2))
      }))
  }

  private generateDemandForecast(products: Array<Record<string, unknown>>): DemandForecast[] {
    return products.slice(0, 20).map(product => ({
      productId: product.id,
      productName: product.name,
      predictedDemand: Math.floor(Math.random() * 100) + 10,
      confidence: 0.6 + Math.random() * 0.3,
      seasonality: Math.random() * 2 - 1
    }))
  }

  private generateCustomerSegments(customers: Array<Record<string, unknown>>): CustomerSegment[] {
    const totalCustomers = customers.length
    
    return [
      {
        segment: 'VIP',
        count: Math.floor(totalCustomers * 0.1),
        value: 50000,
        characteristics: ['Alto valor', 'Compras frecuentes', 'Lealtad alta']
      },
      {
        segment: 'Regular',
        count: Math.floor(totalCustomers * 0.6),
        value: 75000,
        characteristics: ['Compras regulares', 'Valor medio']
      },
      {
        segment: 'Ocasional',
        count: Math.floor(totalCustomers * 0.2),
        value: 15000,
        characteristics: ['Compras esporádicas', 'Sensible al precio']
      },
      {
        segment: 'Nuevo',
        count: Math.floor(totalCustomers * 0.1),
        value: 5000,
        characteristics: ['Primera compra', 'Potencial crecimiento']
      }
    ]
  }

  private generateCashFlowData(sales: Array<Record<string, unknown>>, expenses: Array<Record<string, unknown>>): CashFlowData[] {
    const data: CashFlowData[] = []
    const today = new Date()
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      
      const inflow = Math.random() * 5000 + 2000
      const outflow = Math.random() * 3000 + 1000
      
      data.push({
        date: date.toISOString().split('T')[0],
        inflow,
        outflow,
        netFlow: inflow - outflow
      })
    }
    
    return data
  }

  private generateExpenseBreakdown(expenses: Array<Record<string, unknown>>): ExpenseCategory[] {
    return [
      { category: 'Inventario', amount: 45000, percentage: 45, trend: 5.2 },
      { category: 'Personal', amount: 25000, percentage: 25, trend: 2.1 },
      { category: 'Alquiler', amount: 12000, percentage: 12, trend: 0 },
      { category: 'Marketing', amount: 8000, percentage: 8, trend: 15.5 },
      { category: 'Servicios', amount: 6000, percentage: 6, trend: -2.3 },
      { category: 'Otros', amount: 4000, percentage: 4, trend: 1.2 }
    ]
  }

  private generateRevenueStreams(sales: Array<Record<string, unknown>>): RevenueStream[] {
    return [
      { source: 'Ventas en tienda', amount: 75000, percentage: 60, growth: 8.5 },
      { source: 'Ventas online', amount: 35000, percentage: 28, growth: 25.2 },
      { source: 'Servicios', amount: 10000, percentage: 8, growth: 12.1 },
      { source: 'Otros', amount: 5000, percentage: 4, growth: -5.2 }
    ]
  }

  // Métodos de utilidad
  clearCache(): void {
    this.cache.clear()
  }

  updateConfig(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  getConfig(): AnalyticsConfig {
    return { ...this.config }
  }
}

// Instancia singleton
export const analyticsEngine = new AdvancedAnalyticsEngine()