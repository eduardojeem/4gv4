// Typed sub-interfaces derived from consumer usage in AdvancedAnalyticsDashboard and analytics-dashboard

export interface AnalyticsSalesData {
  totalRevenue: number
  totalSales: number
  conversionRate: number
  averageOrderValue: number
  salesGrowth: number
  salesByPeriod: Array<{ date: string; value: number; [key: string]: unknown }>
  salesByPaymentMethod: Array<Record<string, unknown>>
  topSellingProducts: Array<Record<string, unknown>>
  salesByCategory: Array<Record<string, unknown>>
}

export interface AnalyticsLoyaltyMetrics {
  repeatCustomers: number
  averageOrderFrequency: number
  loyaltyScore: number
  [key: string]: unknown
}

export interface AnalyticsCustomersData {
  totalCustomers: number
  activeCustomers: number
  newCustomers: number
  customerLifetimeValue: number
  customerRetentionRate: number
  customerSatisfactionScore: number
  loyaltyMetrics: AnalyticsLoyaltyMetrics
  churnRate: number
  customerSegments: Array<{ segment: string; count: number; value?: number; [key: string]: unknown }>
}

export interface AnalyticsDemandForecastItem {
  productName: string
  predictedDemand: number
  confidence: number
  [key: string]: unknown
}

export interface AnalyticsStockAlert {
  [key: string]: unknown
}

export interface AnalyticsProfitMargins {
  averageMargin: number
  [key: string]: unknown
}

export interface AnalyticsProductsData {
  productPerformance: Array<{ name: string; revenue: number; sales: number; [key: string]: unknown }>
  activeProducts: number
  totalProducts: number
  stockAlerts: AnalyticsStockAlert[]
  inventoryValue: number
  stockTurnover: number
  profitMargins: AnalyticsProfitMargins
  demandForecast: AnalyticsDemandForecastItem[]
}

export interface AnalyticsFinancialRatios {
  returnOnEquity: number
  currentRatio: number
  quickRatio: number
  returnOnAssets: number
  debtToEquity: number
  [key: string]: unknown
}

export interface AnalyticsCashFlowItem {
  netFlow: number
  [key: string]: unknown
}

export interface AnalyticsExpenseItem {
  category: string
  amount: number
  [key: string]: unknown
}

export interface AnalyticsFinancialData {
  grossRevenue: number
  grossProfit: number
  profitMargin: number
  financialRatios: AnalyticsFinancialRatios
  cashFlow: AnalyticsCashFlowItem[]
  expenseBreakdown: AnalyticsExpenseItem[]
}

export interface AnalyticsSystemPerformance {
  responseTime: number
  [key: string]: unknown
}

export interface AnalyticsUptimeData {
  availability: number
  [key: string]: unknown
}

export interface AnalyticsUserActivity {
  activeUsers: number
  [key: string]: unknown
}

export interface AnalyticsErrorRates {
  errorRate: number
  [key: string]: unknown
}

export interface AnalyticsResourceUtilization {
  cpuUsage: number
  memoryUsage: number
  diskUsage: number
  networkUsage: number
  [key: string]: unknown
}

export interface AnalyticsProcessEfficiency {
  orderProcessingTime: number
  inventoryTurnover: number
  customerServiceTime: number
  fulfillmentRate: number
  [key: string]: unknown
}

export interface AnalyticsOperationsData {
  systemPerformance: AnalyticsSystemPerformance
  uptime: AnalyticsUptimeData
  userActivity: AnalyticsUserActivity
  errorRates: AnalyticsErrorRates
  resourceUtilization: AnalyticsResourceUtilization
  processEfficiency: AnalyticsProcessEfficiency
}

export type AdvancedAnalyticsData = {
  sales: AnalyticsSalesData
  customers: AnalyticsCustomersData
  products: AnalyticsProductsData
  financial: AnalyticsFinancialData
  operations: AnalyticsOperationsData
  /** Alias for operations (used by AdvancedAnalyticsDashboard) */
  operational: AnalyticsOperationsData
  [key: string]: unknown
}

const DEFAULT_ANALYTICS: AdvancedAnalyticsData = {
  sales: {
    totalRevenue: 0,
    totalSales: 0,
    conversionRate: 0,
    averageOrderValue: 0,
    salesGrowth: 0,
    salesByPeriod: [],
    salesByPaymentMethod: [],
    topSellingProducts: [],
    salesByCategory: [],
  },
  customers: {
    totalCustomers: 0,
    activeCustomers: 0,
    newCustomers: 0,
    customerLifetimeValue: 0,
    customerRetentionRate: 0,
    customerSatisfactionScore: 0,
    loyaltyMetrics: { repeatCustomers: 0, averageOrderFrequency: 0, loyaltyScore: 0 },
    churnRate: 0,
    customerSegments: [],
  },
  products: {
    productPerformance: [],
    activeProducts: 0,
    totalProducts: 0,
    stockAlerts: [],
    inventoryValue: 0,
    stockTurnover: 0,
    profitMargins: { averageMargin: 0 },
    demandForecast: [],
  },
  financial: {
    grossRevenue: 0,
    grossProfit: 0,
    profitMargin: 0,
    financialRatios: { returnOnEquity: 0, currentRatio: 0, quickRatio: 0, returnOnAssets: 0, debtToEquity: 0 },
    cashFlow: [],
    expenseBreakdown: [],
  },
  operations: {
    systemPerformance: { responseTime: 0 },
    uptime: { availability: 0 },
    userActivity: { activeUsers: 0 },
    errorRates: { errorRate: 0 },
    resourceUtilization: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, networkUsage: 0 },
    processEfficiency: { orderProcessingTime: 0, inventoryTurnover: 0, customerServiceTime: 0, fulfillmentRate: 0 },
  },
  get operational() { return this.operations },
}

export const analyticsEngine = {
  async getAdvancedAnalytics(
    _range: { start: Date; end: Date }
  ): Promise<AdvancedAnalyticsData> {
    return DEFAULT_ANALYTICS
  },
  clearCache(): void {
    // Compatibility shim: no-op for now.
  },
}
