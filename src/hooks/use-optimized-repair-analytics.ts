import { useMemo, useCallback } from 'react'
import { useRepairs } from '@/contexts/RepairsContext'
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

// Tipos optimizados para analytics
export interface AnalyticsMetrics {
  totalRepairs: number
  completedRepairs: number
  inProgressRepairs: number
  urgentRepairs: number
  totalRevenue: number
  avgRepairValue: number
  completionRate: number
  avgRepairTime: number
  onTimeDeliveries: number
  onTimeRate: number
}

export interface MonthlyData {
  month: string
  monthShort: string
  totalRepairs: number
  completedRepairs: number
  revenue: number
  avgRepairTime: number
}

export interface TechnicianPerformance {
  name: string
  totalRepairs: number
  completedRepairs: number
  revenue: number
  avgTime: number
  efficiency: number
  totalTime: number
}

export interface StatusAnalysis {
  name: string
  count: number
  revenue: number
}

export interface DeviceAnalysis {
  name: string
  count: number
  revenue: number
}

export interface PriorityAnalysis {
  name: string
  count: number
  avgTime: number
  totalTime: number
}

export interface DailyTrend {
  date: string
  repairs: number
  completed: number
  revenue: number
}

export interface AnalyticsData {
  metrics: AnalyticsMetrics
  monthlyData: MonthlyData[]
  statusAnalysis: StatusAnalysis[]
  technicianAnalysis: TechnicianPerformance[]
  deviceTypeAnalysis: DeviceAnalysis[]
  priorityAnalysis: PriorityAnalysis[]
  dailyTrend: DailyTrend[]
}

// Cache para evitar recálculos innecesarios
const analyticsCache = new Map<string, AnalyticsData>()

export function useOptimizedRepairAnalytics(timeRange: string = '6months') {
  const { repairs, isLoading } = useRepairs()

  // Función para limpiar cache cuando sea necesario
  const clearCache = useCallback(() => {
    analyticsCache.clear()
  }, [])

  // Cálculo optimizado de analytics con memoización
  const analytics = useMemo(() => {
    if (!repairs.length) {
      return {
        metrics: {
          totalRepairs: 0,
          completedRepairs: 0,
          inProgressRepairs: 0,
          urgentRepairs: 0,
          totalRevenue: 0,
          avgRepairValue: 0,
          completionRate: 0,
          avgRepairTime: 0,
          onTimeDeliveries: 0,
          onTimeRate: 0
        } as AnalyticsMetrics,
        monthlyData: [] as MonthlyData[],
        statusAnalysis: [] as StatusAnalysis[],
        technicianAnalysis: [] as TechnicianPerformance[],
        deviceTypeAnalysis: [] as DeviceAnalysis[],
        priorityAnalysis: [] as PriorityAnalysis[],
        dailyTrend: [] as DailyTrend[]
      }
    }

    // Crear clave de cache basada en datos relevantes
    const cacheKey = `${timeRange}-${repairs.length}-${repairs[0]?.lastUpdate || ''}`
    
    // Verificar cache
    if (analyticsCache.has(cacheKey)) {
      return analyticsCache.get(cacheKey)!
    }

    const now = new Date()
    const monthCount = timeRange === '12months' ? 12 : 6

    // Pre-calcular fechas una sola vez para mejor rendimiento
    const monthRanges = Array.from({ length: monthCount }, (_, i) => {
      const monthDate = subMonths(now, monthCount - 1 - i)
      return {
        date: monthDate,
        start: startOfMonth(monthDate),
        end: endOfMonth(monthDate),
        monthShort: format(monthDate, 'MMM', { locale: es }),
        month: format(monthDate, 'MMM yyyy', { locale: es }),
        key: format(monthDate, 'yyyy-MM')
      }
    })

    // Usar Maps para O(1) lookup performance
    const repairsByMonth = new Map<string, any[]>()
    const completedByMonth = new Map<string, any[]>()
    const technicianStats = new Map<string, TechnicianPerformance>()
    const statusStats = new Map<string, StatusAnalysis>()
    const deviceStats = new Map<string, DeviceAnalysis>()
    const priorityStats = new Map<string, PriorityAnalysis>()

    // Labels maps para evitar recálculos repetitivos
    const statusLabels = new Map([
      ['recibido', 'Recibido'],
      ['diagnostico', 'En Diagnóstico'],
      ['reparacion', 'En Reparación'],
      ['pausado', 'Pausado'],
      ['listo', 'Listo'],
      ['entregado', 'Entregado'],
      ['cancelado', 'Cancelado']
    ])

    const deviceLabels = new Map([
      ['smartphone', 'Smartphones'],
      ['tablet', 'Tablets'],
      ['laptop', 'Laptops'],
      ['desktop', 'Desktops'],
      ['accessory', 'Accesorios'],
      ['other', 'Otros']
    ])

    const priorityLabels = new Map([
      ['low', 'Baja'],
      ['medium', 'Media'],
      ['high', 'Alta']
    ])

    // Inicializar Maps para meses
    monthRanges.forEach(range => {
      repairsByMonth.set(range.key, [])
      completedByMonth.set(range.key, [])
    })

    // Variables para métricas acumulativas (evitar múltiples iteraciones)
    let totalRepairs = 0
    let completedRepairs = 0
    let inProgressRepairs = 0
    let urgentRepairs = 0
    let totalRevenue = 0
    let onTimeDeliveries = 0
    let totalRepairTime = 0
    let completedWithTime = 0

    // Procesar todas las reparaciones en una sola iteración O(n)
    repairs.forEach(repair => {
      totalRepairs++
      
      const repairDate = new Date(repair.createdAt)
      const monthKey = format(repairDate, 'yyyy-MM')
      const status = repair.dbStatus || 'unknown'
      const deviceType = repair.deviceType || 'unknown'
      const priority = repair.priority || 'medium'
      const technicianName = repair.technician?.name || 'Sin asignar'
      const revenue = repair.finalCost || repair.estimatedCost || 0

      // Agregar a mes correspondiente
      const monthRepairs = repairsByMonth.get(monthKey)
      if (monthRepairs) {
        monthRepairs.push(repair)
      }

      // Acumular métricas generales
      totalRevenue += revenue

      if (status === 'entregado') {
        completedRepairs++
        const monthCompleted = completedByMonth.get(monthKey)
        if (monthCompleted) {
          monthCompleted.push(repair)
        }

        // Calcular tiempo de reparación y entregas a tiempo
        if (repair.completedAt && repair.createdAt) {
          const repairTime = differenceInDays(new Date(repair.completedAt), new Date(repair.createdAt))
          totalRepairTime += repairTime
          completedWithTime++
          
          if (repairTime <= 7) {
            onTimeDeliveries++
          }
        }
      }

      if (['recibido', 'diagnostico', 'reparacion', 'pausado'].includes(status)) {
        inProgressRepairs++
      }

      if (repair.urgency === 'urgent') {
        urgentRepairs++
      }

      // Estadísticas por estado
      const statusKey = statusLabels.get(status) || status
      const statusStat = statusStats.get(statusKey) || { name: statusKey, count: 0, revenue: 0 }
      statusStat.count++
      statusStat.revenue += revenue
      statusStats.set(statusKey, statusStat)

      // Estadísticas por dispositivo
      const deviceKey = deviceLabels.get(deviceType) || deviceType
      const deviceStat = deviceStats.get(deviceKey) || { name: deviceKey, count: 0, revenue: 0 }
      deviceStat.count++
      deviceStat.revenue += revenue
      deviceStats.set(deviceKey, deviceStat)

      // Estadísticas por prioridad
      const priorityKey = priorityLabels.get(priority) || priority
      const priorityStat = priorityStats.get(priorityKey) || { 
        name: priorityKey, 
        count: 0, 
        avgTime: 0, 
        totalTime: 0 
      }
      priorityStat.count++
      if (repair.completedAt && repair.createdAt) {
        const days = differenceInDays(new Date(repair.completedAt), new Date(repair.createdAt))
        priorityStat.totalTime += days
      }
      priorityStats.set(priorityKey, priorityStat)

      // Estadísticas por técnico
      const techStat = technicianStats.get(technicianName) || {
        name: technicianName,
        totalRepairs: 0,
        completedRepairs: 0,
        revenue: 0,
        avgTime: 0,
        efficiency: 0,
        totalTime: 0
      }
      techStat.totalRepairs++
      if (status === 'entregado') {
        techStat.completedRepairs++
        techStat.revenue += revenue
        
        if (repair.completedAt && repair.createdAt) {
          const days = differenceInDays(new Date(repair.completedAt), new Date(repair.createdAt))
          techStat.totalTime += days
        }
      }
      technicianStats.set(technicianName, techStat)
    })

    // Calcular promedios y eficiencias (post-procesamiento)
    priorityStats.forEach(stat => {
      stat.avgTime = stat.count > 0 ? stat.totalTime / stat.count : 0
    })

    technicianStats.forEach(tech => {
      tech.efficiency = tech.totalRepairs > 0 ? (tech.completedRepairs / tech.totalRepairs) * 100 : 0
      tech.avgTime = tech.completedRepairs > 0 ? tech.totalTime / tech.completedRepairs : 0
    })

    // Generar datos mensuales optimizado
    const monthlyData: MonthlyData[] = monthRanges.map(range => {
      const monthRepairs = repairsByMonth.get(range.key) || []
      const completedRepairs = completedByMonth.get(range.key) || []
      
      const revenue = completedRepairs.reduce((sum, r) => sum + (r.finalCost || r.estimatedCost || 0), 0)
      
      let avgRepairTime = 0
      if (completedRepairs.length > 0) {
        const totalTime = completedRepairs.reduce((sum, r) => {
          if (r.completedAt && r.createdAt) {
            return sum + differenceInDays(new Date(r.completedAt), new Date(r.createdAt))
          }
          return sum
        }, 0)
        avgRepairTime = totalTime / completedRepairs.length
      }
      
      return {
        month: range.month,
        monthShort: range.monthShort,
        totalRepairs: monthRepairs.length,
        completedRepairs: completedRepairs.length,
        revenue,
        avgRepairTime
      }
    })

    // Tendencia diaria optimizada (últimos 7 días)
    const dailyTrend: DailyTrend[] = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i)
      const dateKey = format(date, 'yyyy-MM-dd')
      
      // Filtrar reparaciones del día específico
      const dayRepairs = repairs.filter(r => {
        const repairDate = new Date(r.createdAt)
        return format(repairDate, 'yyyy-MM-dd') === dateKey
      })
      
      return {
        date: format(date, 'dd/MM'),
        repairs: dayRepairs.length,
        completed: dayRepairs.filter(r => r.dbStatus === 'entregado').length,
        revenue: dayRepairs.reduce((sum, r) => sum + (r.finalCost || r.estimatedCost || 0), 0)
      }
    })

    // Métricas calculadas finales
    const metrics: AnalyticsMetrics = {
      totalRepairs,
      completedRepairs,
      inProgressRepairs,
      urgentRepairs,
      totalRevenue,
      avgRepairValue: totalRepairs > 0 ? totalRevenue / totalRepairs : 0,
      completionRate: totalRepairs > 0 ? (completedRepairs / totalRepairs) * 100 : 0,
      avgRepairTime: completedWithTime > 0 ? totalRepairTime / completedWithTime : 0,
      onTimeDeliveries,
      onTimeRate: completedWithTime > 0 ? (onTimeDeliveries / completedWithTime) * 100 : 0
    }

    // Construir resultado final
    const result: AnalyticsData = {
      metrics,
      monthlyData,
      statusAnalysis: Array.from(statusStats.values()),
      technicianAnalysis: Array.from(technicianStats.values()).sort((a, b) => b.efficiency - a.efficiency),
      deviceTypeAnalysis: Array.from(deviceStats.values()).sort((a, b) => b.count - a.count),
      priorityAnalysis: Array.from(priorityStats.values()),
      dailyTrend
    }

    // Guardar en cache
    analyticsCache.set(cacheKey, result)
    
    // Limpiar cache antiguo (mantener solo últimas 5 entradas)
    if (analyticsCache.size > 5) {
      const firstKey = analyticsCache.keys().next().value
      if (firstKey) {
        analyticsCache.delete(firstKey)
      }
    }

    return result
  }, [repairs, timeRange])

  // Funciones de utilidad
  const getTopTechnicians = useCallback((limit: number = 5) => {
    return analytics.technicianAnalysis.slice(0, limit)
  }, [analytics.technicianAnalysis])

  const getMetricTrend = useCallback((metric: keyof AnalyticsMetrics) => {
    // Calcular tendencia del último mes vs anterior
    const currentMonth = analytics.monthlyData[analytics.monthlyData.length - 1]
    const previousMonth = analytics.monthlyData[analytics.monthlyData.length - 2]
    
    if (!currentMonth || !previousMonth) return 0
    
    const current = currentMonth[metric as keyof MonthlyData] as number
    const previous = previousMonth[metric as keyof MonthlyData] as number
    
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }, [analytics.monthlyData])

  const getEfficiencyScore = useCallback(() => {
    // Calcular score de eficiencia general (0-100)
    const completionWeight = 0.4
    const timeWeight = 0.3
    const onTimeWeight = 0.3
    
    const completionScore = Math.min(analytics.metrics.completionRate, 100)
    const timeScore = Math.max(0, 100 - (analytics.metrics.avgRepairTime * 5)) // Penalizar días extras
    const onTimeScore = analytics.metrics.onTimeRate
    
    return Math.round(
      (completionScore * completionWeight) +
      (timeScore * timeWeight) +
      (onTimeScore * onTimeWeight)
    )
  }, [analytics.metrics])

  return {
    analytics,
    isLoading,
    
    // Funciones de utilidad
    getTopTechnicians,
    getMetricTrend,
    getEfficiencyScore,
    clearCache,
    
    // Métricas derivadas
    hasData: analytics.metrics.totalRepairs > 0,
    isEmpty: analytics.metrics.totalRepairs === 0
  }
}