import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/hooks/use-customer-state'

export interface CustomerMetrics {
  totalCustomers: number
  activeCustomers: number
  newCustomersThisMonth: number
  totalRevenue: number
  averageOrderValue: number
  customerRetentionRate: number
  customerSatisfactionScore: number
  topSpendingCustomers: Customer[]
  recentActivity: ActivityMetric[]
  growthMetrics: GrowthMetric[]
  segmentDistribution: SegmentMetric[]
}

export interface ActivityMetric {
  id: string
  type: 'purchase' | 'registration' | 'support' | 'communication'
  customerId: string
  customerName: string
  description: string
  amount?: number
  timestamp: string
  status: 'completed' | 'pending' | 'cancelled'
}

export interface GrowthMetric {
  period: string
  newCustomers: number
  revenue: number
  orders: number
  growthRate: number
}

export interface SegmentMetric {
  segmentName: string
  customerCount: number
  percentage: number
  revenue: number
  color: string
}

export interface RealTimeMetrics {
  onlineCustomers: number
  todayOrders: number
  todayRevenue: number
  pendingSupport: number
  activePromotions: number
  systemHealth: 'excellent' | 'good' | 'warning' | 'critical'
  lastUpdated: string
}

class MetricsService {
  private supabase = createClient()

  // Obtener métricas principales de clientes
  async getCustomerMetrics(): Promise<{ success: boolean; data?: CustomerMetrics; error?: string }> {
    try {
      // Obtener todos los clientes
      const { data: customers, error: customersError } = await this.supabase
        .from('customers')
        .select('*')

      if (customersError) throw customersError

      const customerList: Customer[] = customers || []
      const now = new Date()
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

      // Calcular métricas básicas
      const totalCustomers = customerList.length
      const activeCustomers = customerList.filter((c: Customer) => c.status === 'active').length
      const newCustomersThisMonth = customerList.filter((c: Customer) => 
        new Date(c.created_at || c.registration_date) >= thisMonth
      ).length

      const totalRevenue = customerList.reduce((sum: number, c: Customer) => sum + (c.lifetime_value || 0), 0)
      const averageOrderValue = customerList.reduce((sum: number, c: Customer) => sum + (c.avg_order_value || 0), 0) / totalCustomers || 0
      const customerSatisfactionScore = customerList.reduce((sum: number, c: Customer) => sum + (c.satisfaction_score || 0), 0) / totalCustomers || 0

      // Top clientes por gasto
      const topSpendingCustomers = customerList
        .sort((a: Customer, b: Customer) => (b.lifetime_value || 0) - (a.lifetime_value || 0))
        .slice(0, 10)

      // Actividad reciente simulada
      const recentActivity: ActivityMetric[] = customerList
        .slice(0, 20)
        .map((customer: Customer, index: number) => ({
          id: `activity-${index}`,
          type: ['purchase', 'registration', 'support', 'communication'][Math.floor(Math.random() * 4)] as ActivityMetric['type'],
          customerId: customer.id,
          customerName: customer.name,
          description: this.generateActivityDescription(customer),
          amount: Math.random() > 0.5 ? Math.floor(Math.random() * 1000000) : undefined,
          timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: ['completed', 'pending', 'cancelled'][Math.floor(Math.random() * 3)] as ActivityMetric['status']
        }))

      // Métricas de crecimiento
      const growthMetrics: GrowthMetric[] = [
        {
          period: 'Este mes',
          newCustomers: newCustomersThisMonth,
          revenue: customerList.filter((c: Customer) => new Date(c.created_at || c.registration_date) >= thisMonth)
            .reduce((sum: number, c: Customer) => sum + (c.total_spent_this_year || 0), 0),
          orders: customerList.filter((c: Customer) => new Date(c.created_at || c.registration_date) >= thisMonth)
            .reduce((sum: number, c: Customer) => sum + (c.total_purchases || 0), 0),
          growthRate: Math.random() * 20 + 5 // Simulado
        },
        {
          period: 'Mes pasado',
          newCustomers: customerList.filter((c: Customer) => {
            const created = new Date(c.created_at || c.registration_date)
            return created >= lastMonth && created < thisMonth
          }).length,
          revenue: customerList.filter((c: Customer) => {
            const created = new Date(c.created_at || c.registration_date)
            return created >= lastMonth && created < thisMonth
          }).reduce((sum: number, c: Customer) => sum + (c.total_spent_this_year || 0), 0),
          orders: customerList.filter((c: Customer) => {
            const created = new Date(c.created_at || c.registration_date)
            return created >= lastMonth && created < thisMonth
          }).reduce((sum: number, c: Customer) => sum + (c.total_purchases || 0), 0),
          growthRate: Math.random() * 15 + 2 // Simulado
        }
      ]

      // Distribución por segmentos
      const segmentCounts = customerList.reduce((acc: Record<string, number>, customer: Customer) => {
        const segment = customer.segment || 'regular'
        acc[segment] = (acc[segment] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const segmentDistribution: SegmentMetric[] = Object.entries(segmentCounts).map(([segment, count]) => ({
        segmentName: segment,
        customerCount: count as number,
        percentage: ((count as number) / totalCustomers) * 100,
        revenue: customerList
          .filter((c: Customer) => (c.segment || 'regular') === segment)
          .reduce((sum: number, c: Customer) => sum + (c.lifetime_value || 0), 0),
        color: this.getSegmentColor(segment)
      }))

      const metrics: CustomerMetrics = {
        totalCustomers,
        activeCustomers,
        newCustomersThisMonth,
        totalRevenue,
        averageOrderValue,
        customerRetentionRate: Math.random() * 20 + 75, // Simulado
        customerSatisfactionScore,
        topSpendingCustomers,
        recentActivity,
        growthMetrics,
        segmentDistribution
      }

      return { success: true, data: metrics }

    } catch (error: unknown) {
      console.error('Error fetching customer metrics:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }

  // Obtener métricas en tiempo real
  async getRealTimeMetrics(): Promise<{ success: boolean; data?: RealTimeMetrics; error?: string }> {
    try {
      // Simular métricas en tiempo real
      const metrics: RealTimeMetrics = {
        onlineCustomers: Math.floor(Math.random() * 50) + 10,
        todayOrders: Math.floor(Math.random() * 100) + 20,
        todayRevenue: Math.floor(Math.random() * 5000000) + 1000000,
        pendingSupport: Math.floor(Math.random() * 10) + 2,
        activePromotions: Math.floor(Math.random() * 5) + 1,
        systemHealth: ['excellent', 'good', 'warning', 'critical'][Math.floor(Math.random() * 4)] as any,
        lastUpdated: new Date().toISOString()
      }

      return { success: true, data: metrics }

    } catch (error: unknown) {
      console.error('Error fetching real-time metrics:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }

  // Obtener métricas de rendimiento por período
  async getPerformanceMetrics(period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
    try {
      const { data: customers, error } = await this.supabase
        .from('customers')
        .select('*')

      if (error) throw error

      // Calcular métricas de rendimiento basadas en el período
      const now = new Date()
      let startDate: Date

      switch (period) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
      }

      const periodCustomers = customers?.filter((c: Record<string, unknown>) => 
        new Date((c.created_at || c.registration_date) as string) >= startDate
      ) || []

      const metrics = {
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        newCustomers: periodCustomers.length,
        totalRevenue: periodCustomers.reduce((sum: number, c: Record<string, unknown>) => sum + (Number(c.lifetime_value) || 0), 0),
        averageOrderValue: periodCustomers.reduce((sum: number, c: Record<string, unknown>) => sum + (Number(c.avg_order_value) || 0), 0) / periodCustomers.length || 0,
        totalOrders: periodCustomers.reduce((sum: number, c: Record<string, unknown>) => sum + (Number(c.total_purchases) || 0), 0),
        conversionRate: Math.random() * 0.1 + 0.02, // Simulado
        customerSatisfaction: periodCustomers.reduce((sum: number, c: Record<string, unknown>) => sum + (Number(c.satisfaction_score) || 0), 0) / periodCustomers.length || 0
      }

      return { success: true, data: metrics }

    } catch (error: unknown) {
      console.error('Error fetching performance metrics:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: errorMessage }
    }
  }

  // Métodos auxiliares
  private generateActivityDescription(customer: Customer): string {
    const activities = [
      `Realizó una compra por Gs ${(Math.random() * 1000000).toFixed(0)}`,
      `Se registró en el sistema`,
      `Contactó al soporte técnico`,
      `Actualizó su información de perfil`,
      `Participó en una promoción`,
      `Dejó una reseña de producto`,
      `Solicitó información sobre productos`,
      `Programó una cita de servicio`
    ]
    return activities[Math.floor(Math.random() * activities.length)]
  }

  private getSegmentColor(segment: string): string {
    const colors: Record<string, string> = {
      'vip': '#FFD700',
      'premium': '#9B59B6',
      'regular': '#45B7D1',
      'nuevo': '#4ECDC4',
      'inactivo': '#95A5A6'
    }
    return colors[segment] || '#45B7D1'
  }

  // Suscribirse a cambios en tiempo real
  subscribeToRealTimeUpdates(callback: (metrics: RealTimeMetrics) => void) {
    // Simular actualizaciones en tiempo real cada 30 segundos
    const interval = setInterval(async () => {
      const result = await this.getRealTimeMetrics()
      if (result.success && result.data) {
        callback(result.data)
      }
    }, 30000)

    return () => clearInterval(interval)
  }
}

export const metricsService = new MetricsService()
export default metricsService