import { useMemo } from 'react'
import { Customer } from './use-customer-state'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'

export interface CustomerMetrics {
  // Métricas básicas
  totalCustomers: number
  activeCustomers: number
  inactiveCustomers: number
  suspendedCustomers: number
  vipCustomers: number
  
  // Métricas financieras
  totalRevenue: number
  avgCustomerValue: number
  avgOrderValue: number
  totalLifetimeValue: number
  
  // Métricas de rendimiento
  retentionRate: number
  churnRate: number
  clv: number
  cac: number
  nps: number
  
  // Métricas de segmentación
  segmentDistribution: Array<{
    name: string
    count: number
    percentage: number
    revenue: number
    avgValue: number
  }>
  
  // Métricas temporales
  monthlyData: Array<{
    month: string
    monthShort: string
    newCustomers: number
    totalRevenue: number
    avgOrderValue: number
    activeCustomers: number
  }>
  
  // Top customers
  topCustomers: Array<{
    customer: Customer
    value: number
    rank: number
  }>
}

export interface UseCustomerMetricsOptions {
  timeRange?: '3months' | '6months' | '12months'
  includeInactive?: boolean
  segmentBy?: 'segment' | 'customer_type' | 'city'
}

export function useCustomerMetrics(
  customers: Customer[], 
  options: UseCustomerMetricsOptions = {}
): CustomerMetrics {
  const {
    timeRange = '6months',
    includeInactive = true,
    segmentBy = 'segment'
  } = options

  return useMemo(() => {
    const filteredCustomers = includeInactive 
      ? customers 
      : customers.filter(c => c.status === 'active')

    // Métricas básicas
    const totalCustomers = filteredCustomers.length
    const activeCustomers = filteredCustomers.filter(c => c.status === 'active').length
    const inactiveCustomers = filteredCustomers.filter(c => c.status === 'inactive').length
    const suspendedCustomers = filteredCustomers.filter(c => c.status === 'suspended').length
    const vipCustomers = filteredCustomers.filter(c => 
      c.customer_type === 'premium' || (c.lifetime_value || 0) > 1000000
    ).length

    // Métricas financieras
    const totalRevenue = filteredCustomers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0)
    const avgCustomerValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0
    const avgOrderValue = filteredCustomers.reduce((sum, c) => sum + (c.avg_order_value || 0), 0) / totalCustomers || 0
    const totalLifetimeValue = totalRevenue

    // Métricas de rendimiento (simuladas por ahora)
    const retentionRate = activeCustomers / totalCustomers * 100 || 0
    const churnRate = 100 - retentionRate
    const clv = avgCustomerValue * 2.5 // Estimación simple
    const cac = avgCustomerValue * 0.2 // Estimación simple
    const nps = Math.random() * 100 // Simulado

    // Análisis por segmento
    const segmentAnalysis = filteredCustomers.reduce((acc, customer) => {
      const segmentKey = customer[segmentBy as keyof Customer] as string || 'Sin Clasificar'
      if (!acc[segmentKey]) {
        acc[segmentKey] = {
          name: segmentKey,
          count: 0,
          revenue: 0
        }
      }
      acc[segmentKey].count++
      acc[segmentKey].revenue += customer.lifetime_value || 0
      return acc
    }, {} as Record<string, { name: string; count: number; revenue: number }>)

    const segmentDistribution = Object.values(segmentAnalysis).map(segment => ({
      ...segment,
      percentage: (segment.count / totalCustomers) * 100,
      avgValue: segment.count > 0 ? segment.revenue / segment.count : 0
    }))

    // Datos mensuales
    const now = new Date()
    const monthCount = timeRange === '12months' ? 12 : timeRange === '6months' ? 6 : 3
    
    const monthlyData = []
    for (let i = monthCount - 1; i >= 0; i--) {
      const monthDate = subMonths(now, i)
      const monthStart = startOfMonth(monthDate)
      const monthEnd = endOfMonth(monthDate)
      
      const monthCustomers = filteredCustomers.filter(customer => {
        const customerDate = new Date(customer.registration_date || customer.last_activity || now)
        return isWithinInterval(customerDate, { start: monthStart, end: monthEnd })
      })
      
      monthlyData.push({
        month: format(monthDate, 'MMM yyyy', { locale: es }),
        monthShort: format(monthDate, 'MMM', { locale: es }),
        newCustomers: monthCustomers.length,
        totalRevenue: monthCustomers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0),
        avgOrderValue: monthCustomers.length > 0 
          ? monthCustomers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0) / monthCustomers.length 
          : 0,
        activeCustomers: monthCustomers.filter(c => c.status === 'active').length
      })
    }

    // Top customers
    const topCustomers = filteredCustomers
      .sort((a, b) => (b.lifetime_value || 0) - (a.lifetime_value || 0))
      .slice(0, 10)
      .map((customer, index) => ({
        customer,
        value: customer.lifetime_value || 0,
        rank: index + 1
      }))

    return {
      totalCustomers,
      activeCustomers,
      inactiveCustomers,
      suspendedCustomers,
      vipCustomers,
      totalRevenue,
      avgCustomerValue,
      avgOrderValue,
      totalLifetimeValue,
      retentionRate,
      churnRate,
      clv,
      cac,
      nps,
      segmentDistribution,
      monthlyData,
      topCustomers
    }
  }, [customers, timeRange, includeInactive, segmentBy])
}

// Hook para formateo de valores
export function useMetricFormatters() {
  return useMemo(() => ({
    currency: (value: number) => `Gs ${value.toLocaleString()}`,
    percentage: (value: number) => `${value.toFixed(1)}%`,
    number: (value: number) => value.toLocaleString(),
    decimal: (value: number, places = 2) => value.toFixed(places),
    compact: (value: number) => {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
      return value.toString()
    }
  }), [])
}