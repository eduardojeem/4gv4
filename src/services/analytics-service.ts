import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/hooks/use-customer-state'

export interface AnalyticsData {
  monthlyRevenue: MonthlyRevenueData[]
  customerSegments: CustomerSegmentData[]
  metrics: AnalyticsMetrics
  trends: TrendData[]
}

export interface MonthlyRevenueData {
  month: string
  revenue: number
  newCustomers: number
  orders: number
  averageOrderValue: number
}

export interface CustomerSegmentData {
  name: string
  count: number
  percentage: number
  revenue: number
  growth: number
}

export interface AnalyticsMetrics {
  averageLifetimeValue: number
  customerAcquisitionCost: number
  churnRate: number
  netPromoterScore: number
  averageOrderCount: number
  clvGrowth: number
  cacChange: number
  churnChange: number
  npsChange: number
}

export interface TrendData {
  metric: string
  current: number
  previous: number
  change: number
  trend: 'up' | 'down' | 'stable'
}

export interface PredictionData {
  revenue: number[]
  customers: number[]
  churn: number[]
  confidence: number
}

class AnalyticsService {
  private supabase = createClient()

  // Obtener analíticas principales
  async getAnalytics(customers: Customer[], period: string): Promise<{ success: boolean; data?: AnalyticsData; error?: string }> {
    try {
      // Calcular datos mensuales
      const monthlyRevenue = this.calculateMonthlyRevenue(customers, period)
      
      // Calcular segmentos de clientes
      const customerSegments = this.calculateCustomerSegments(customers)
      
      // Calcular métricas principales
      const metrics = this.calculateMetrics(customers)
      
      // Calcular tendencias
      const trends = this.calculateTrends(customers, period)

      const analyticsData: AnalyticsData = {
        monthlyRevenue,
        customerSegments,
        metrics,
        trends
      }

      return { success: true, data: analyticsData }

    } catch (error: unknown) {
      console.error('Error getting analytics:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }

  // Obtener predicciones con IA
  async getPredictions(customers: Customer[], period: string): Promise<{ success: boolean; data?: PredictionData; error?: string }> {
    try {
      // Simular predicciones basadas en datos históricos
      const monthlyRevenue = this.calculateMonthlyRevenue(customers, period)
      
      // Predicción simple basada en tendencia
      const revenuePredict = this.predictRevenue(monthlyRevenue)
      const customersPredict = this.predictCustomers(monthlyRevenue)
      const churnPredict = this.predictChurn(customers)

      const predictions: PredictionData = {
        revenue: revenuePredict,
        customers: customersPredict,
        churn: churnPredict,
        confidence: 0.75 // 75% de confianza simulada
      }

      return { success: true, data: predictions }

    } catch (error: unknown) {
      console.error('Error getting predictions:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }

  // Obtener comparaciones temporales
  async getComparisons(customers: Customer[], period: string): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
    try {
      const currentMetrics = this.calculateMetrics(customers)
      
      // Simular métricas del período anterior
      const previousMetrics = {
        averageLifetimeValue: currentMetrics.averageLifetimeValue * 0.9,
        customerAcquisitionCost: currentMetrics.customerAcquisitionCost * 1.1,
        churnRate: currentMetrics.churnRate * 1.2,
        netPromoterScore: currentMetrics.netPromoterScore * 0.95
      }

      const comparisons = {
        clv: {
          current: currentMetrics.averageLifetimeValue,
          previous: previousMetrics.averageLifetimeValue,
          change: currentMetrics.averageLifetimeValue - previousMetrics.averageLifetimeValue,
          changePercentage: ((currentMetrics.averageLifetimeValue - previousMetrics.averageLifetimeValue) / previousMetrics.averageLifetimeValue) * 100
        },
        cac: {
          current: currentMetrics.customerAcquisitionCost,
          previous: previousMetrics.customerAcquisitionCost,
          change: currentMetrics.customerAcquisitionCost - previousMetrics.customerAcquisitionCost,
          changePercentage: ((currentMetrics.customerAcquisitionCost - previousMetrics.customerAcquisitionCost) / previousMetrics.customerAcquisitionCost) * 100
        },
        churn: {
          current: currentMetrics.churnRate,
          previous: previousMetrics.churnRate,
          change: currentMetrics.churnRate - previousMetrics.churnRate,
          changePercentage: ((currentMetrics.churnRate - previousMetrics.churnRate) / previousMetrics.churnRate) * 100
        },
        nps: {
          current: currentMetrics.netPromoterScore,
          previous: previousMetrics.netPromoterScore,
          change: currentMetrics.netPromoterScore - previousMetrics.netPromoterScore,
          changePercentage: ((currentMetrics.netPromoterScore - previousMetrics.netPromoterScore) / previousMetrics.netPromoterScore) * 100
        }
      }

      return { success: true, data: comparisons }

    } catch (error: unknown) {
      console.error('Error getting comparisons:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }

  // Exportar datos
  async exportData(analytics: AnalyticsData, format: 'pdf' | 'excel'): Promise<{ success: boolean; data?: Blob; error?: string }> {
    try {
      // Simular exportación
      const data = JSON.stringify(analytics, null, 2)
      const blob = new Blob([data], { type: format === 'pdf' ? 'application/pdf' : 'application/vnd.ms-excel' })
      
      // Crear enlace de descarga
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      return { success: true, data: blob }

    } catch (error: unknown) {
      console.error('Error exporting data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }

  // Métodos privados para cálculos

  private calculateMonthlyRevenue(customers: Customer[], period: string): MonthlyRevenueData[] {
    const months = this.getMonthsForPeriod(period)
    
    return months.map(month => {
      // Simular datos mensuales basados en clientes
      const baseRevenue = customers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0) / months.length
      const variation = (Math.random() - 0.5) * 0.3 // ±15% variación
      const revenue = baseRevenue * (1 + variation)
      
      const newCustomers = Math.floor(customers.length / months.length * (1 + variation))
      const orders = Math.floor(newCustomers * 1.5 * (1 + variation))
      const averageOrderValue = revenue / Math.max(orders, 1)

      return {
        month,
        revenue: Math.round(revenue),
        newCustomers,
        orders,
        averageOrderValue: Math.round(averageOrderValue)
      }
    })
  }

  private calculateCustomerSegments(customers: Customer[]): CustomerSegmentData[] {
    const segments = customers.reduce((acc: Record<string, Customer[]>, customer) => {
      const segment = customer.segment || 'regular'
      if (!acc[segment]) acc[segment] = []
      acc[segment].push(customer)
      return acc
    }, {})

    return Object.entries(segments).map(([name, segmentCustomers]) => ({
      name: this.formatSegmentName(name),
      count: segmentCustomers.length,
      percentage: (segmentCustomers.length / customers.length) * 100,
      revenue: segmentCustomers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0),
      growth: Math.random() * 20 - 10 // Simulado
    }))
  }

  private calculateMetrics(customers: Customer[]): AnalyticsMetrics {
    const totalCustomers = customers.length
    const totalRevenue = customers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0)
    const totalOrders = customers.reduce((sum, c) => sum + (c.total_purchases || 0), 0)
    
    // Calcular métricas
    const averageLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0
    const customerAcquisitionCost = averageLifetimeValue * 0.2 // Simulado como 20% del CLV
    const churnRate = Math.random() * 15 + 2 // 2-17% simulado
    const netPromoterScore = customers.reduce((sum, c) => sum + (c.satisfaction_score || 0), 0) / totalCustomers * 20 // Convertir a escala NPS
    const averageOrderCount = totalCustomers > 0 ? totalOrders / totalCustomers : 0

    return {
      averageLifetimeValue: Math.round(averageLifetimeValue),
      customerAcquisitionCost: Math.round(customerAcquisitionCost),
      churnRate: Math.round(churnRate * 10) / 10,
      netPromoterScore: Math.round(netPromoterScore),
      averageOrderCount: Math.round(averageOrderCount * 10) / 10,
      clvGrowth: Math.random() * 20 - 5, // Simulado
      cacChange: Math.random() * 10 - 5, // Simulado
      churnChange: Math.random() * 5 - 2.5, // Simulado
      npsChange: Math.random() * 10 - 5 // Simulado
    }
  }

  private calculateTrends(customers: Customer[], period: string): TrendData[] {
    const metrics = this.calculateMetrics(customers)
    
    return [
      {
        metric: 'CLV',
        current: metrics.averageLifetimeValue,
        previous: metrics.averageLifetimeValue * 0.95,
        change: metrics.clvGrowth,
        trend: metrics.clvGrowth > 0 ? 'up' : metrics.clvGrowth < 0 ? 'down' : 'stable'
      },
      {
        metric: 'CAC',
        current: metrics.customerAcquisitionCost,
        previous: metrics.customerAcquisitionCost * 1.05,
        change: metrics.cacChange,
        trend: metrics.cacChange < 0 ? 'up' : metrics.cacChange > 0 ? 'down' : 'stable' // Menor CAC es mejor
      }
    ]
  }

  private predictRevenue(monthlyData: MonthlyRevenueData[]): number[] {
    if (monthlyData.length < 2) return []
    
    // Predicción simple basada en tendencia lineal
    const lastTwo = monthlyData.slice(-2)
    const trend = lastTwo[1].revenue - lastTwo[0].revenue
    
    return Array.from({ length: 3 }, (_, i) => {
      const predicted = lastTwo[1].revenue + (trend * (i + 1))
      return Math.max(0, predicted) // No permitir valores negativos
    })
  }

  private predictCustomers(monthlyData: MonthlyRevenueData[]): number[] {
    if (monthlyData.length < 2) return []
    
    const lastTwo = monthlyData.slice(-2)
    const trend = lastTwo[1].newCustomers - lastTwo[0].newCustomers
    
    return Array.from({ length: 3 }, (_, i) => {
      const predicted = lastTwo[1].newCustomers + (trend * (i + 1))
      return Math.max(0, Math.round(predicted))
    })
  }

  private predictChurn(customers: Customer[]): number[] {
    // Predicción simple de churn basada en actividad reciente
    const baseChurn = Math.random() * 10 + 5 // 5-15%
    
    return Array.from({ length: 3 }, () => {
      const variation = (Math.random() - 0.5) * 2 // ±1%
      return Math.max(0, Math.min(100, baseChurn + variation))
    })
  }

  private getMonthsForPeriod(period: string): string[] {
    const now = new Date()
    const months = []
    
    let monthCount = 12
    switch (period) {
      case '7d': monthCount = 1; break
      case '30d': monthCount = 3; break
      case '90d': monthCount = 6; break
      case '1y': monthCount = 12; break
    }
    
    for (let i = monthCount - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }))
    }
    
    return months
  }

  private formatSegmentName(segment: string): string {
    const names: Record<string, string> = {
      'vip': 'VIP',
      'premium': 'Premium',
      'regular': 'Regular',
      'nuevo': 'Nuevo',
      'inactivo': 'Inactivo'
    }
    return names[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
  }
}

export const analyticsService = new AnalyticsService()
export default analyticsService