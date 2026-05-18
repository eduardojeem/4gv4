import { useMemo } from 'react'
import { Repair } from '@/types/repairs'
import { differenceInDays, format, subDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { isActiveRepair, isCompletedRepair, resolveRepairStatus } from '@/lib/constants/repair-status'

export interface TechnicianMetrics {
  totalJobs: number
  activeJobs: number
  completedJobs: number
  avgCompletionTime: number
  completionRate: number
  onTimeDeliveries: number
  onTimeRate: number
  totalRevenue: number
  avgJobValue: number
  efficiency: number
  workload: 'light' | 'normal' | 'heavy' | 'overloaded'
  loadState: 'no_load' | 'light_load' | 'medium_load' | 'high_load'
}

export interface WeeklyData {
  week: string
  completed: number
  revenue: number
  avgTime: number
}

export interface StatusDistribution {
  status: string
  count: number
  percentage: number
}

export interface PriorityBreakdown {
  priority: string
  count: number
  avgTime: number
}

export interface TechnicianAnalytics {
  metrics: TechnicianMetrics
  weeklyTrend: WeeklyData[]
  statusDistribution: StatusDistribution[]
  priorityBreakdown: PriorityBreakdown[]
  recentActivity: Repair[]
}

export function useTechnicianAnalytics(repairs: Repair[]): TechnicianAnalytics {
  return useMemo(() => {
    if (!repairs.length) {
      return {
        metrics: {
          totalJobs: 0,
          activeJobs: 0,
          completedJobs: 0,
          avgCompletionTime: 0,
          completionRate: 0,
          onTimeDeliveries: 0,
          onTimeRate: 0,
          totalRevenue: 0,
          avgJobValue: 0,
          efficiency: 0,
          workload: 'light',
          loadState: 'no_load'
        },
        weeklyTrend: [],
        statusDistribution: [],
        priorityBreakdown: [],
        recentActivity: []
      }
    }

    // Separar reparaciones activas y completadas
    const activeRepairs = repairs.filter(isActiveRepair)
    const completedRepairs = repairs.filter(isCompletedRepair)
    const deliveredRepairs = repairs.filter(r => resolveRepairStatus(r) === 'entregado')

    // Calcular métricas básicas
    const totalJobs = repairs.length
    const activeJobs = activeRepairs.length
    const completedJobs = completedRepairs.length

    // Calcular tiempo promedio de completado
    const completedWithDates = completedRepairs.filter(r => r.completedAt && r.createdAt)
    const totalCompletionTime = completedWithDates.reduce((sum, r) => {
      const start = new Date(r.createdAt).getTime()
      const end = new Date(r.completedAt!).getTime()
      return sum + differenceInDays(end, start)
    }, 0)
    const avgCompletionTime = completedWithDates.length > 0 
      ? totalCompletionTime / completedWithDates.length 
      : 0

    // Calcular entregas a tiempo (≤7 días)
    const onTimeDeliveries = completedWithDates.filter(r => {
      const days = differenceInDays(new Date(r.completedAt!), new Date(r.createdAt))
      return days <= 7
    }).length

    // Calcular solo el valor ya entregado para no mezclar presupuestos con ingresos reales
    const totalRevenue = deliveredRepairs.reduce((sum, repair) =>
      sum + (repair.finalCost ?? repair.paidAmount ?? 0), 0
    )

    // Determinar carga de trabajo y estado
    let workload: TechnicianMetrics['workload'] = 'light'
    let loadState: TechnicianMetrics['loadState'] = 'no_load'

    if (activeJobs === 0) {
      workload = 'light'
      loadState = 'no_load'
    } else if (activeJobs <= 2) {
      workload = 'normal'
      loadState = 'light_load'
    } else if (activeJobs <= 4) {
      workload = 'heavy'
      loadState = 'medium_load'
    } else {
      workload = 'overloaded'
      loadState = 'high_load'
    }

    // Calcular eficiencia (basada en tasa de completado y tiempo promedio)
    const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0
    const timeEfficiency = avgCompletionTime > 0 ? Math.max(0, 100 - (avgCompletionTime * 10)) : 100
    const efficiency = (completionRate * 0.6) + (timeEfficiency * 0.4)

    // Tendencia semanal (últimas 8 semanas)
    const weeklyTrend: WeeklyData[] = Array.from({ length: 8 }, (_, i) => {
      const weekStart = startOfWeek(subDays(new Date(), i * 7))
      const weekEnd = endOfWeek(weekStart)
      
      const weekRepairs = deliveredRepairs.filter(r => {
        if (!r.completedAt) return false
        const completedDate = new Date(r.completedAt)
        return isWithinInterval(completedDate, { start: weekStart, end: weekEnd })
      })

      const weekRevenue = weekRepairs.reduce((sum, repair) =>
        sum + (repair.finalCost ?? repair.paidAmount ?? 0), 0
      )

      const weekAvgTime = weekRepairs.length > 0
        ? weekRepairs.reduce((sum, r) => {
            if (r.completedAt && r.createdAt) {
              const days = differenceInDays(new Date(r.completedAt), new Date(r.createdAt))
              return sum + days
            }
            return sum
          }, 0) / weekRepairs.length
        : 0

      return {
        week: format(weekStart, 'dd/MM', { locale: es }),
        completed: weekRepairs.length,
        revenue: weekRevenue,
        avgTime: weekAvgTime
      }
    }).reverse()

    // Distribución por estado
    const statusCounts = new Map<string, number>()
    repairs.forEach(r => {
      const status = resolveRepairStatus(r)
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1)
    })

    const statusDistribution: StatusDistribution[] = Array.from(statusCounts.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: (count / totalJobs) * 100
    }))

    // Desglose por prioridad
    const priorityCounts = new Map<string, { count: number; totalTime: number }>()
    repairs.forEach(r => {
      const priority = r.priority || 'medium'
      const current = priorityCounts.get(priority) || { count: 0, totalTime: 0 }
      
      let time = 0
      if (r.completedAt && r.createdAt) {
        time = differenceInDays(new Date(r.completedAt), new Date(r.createdAt))
      }
      
      priorityCounts.set(priority, {
        count: current.count + 1,
        totalTime: current.totalTime + time
      })
    })

    const priorityBreakdown: PriorityBreakdown[] = Array.from(priorityCounts.entries()).map(([priority, data]) => ({
      priority,
      count: data.count,
      avgTime: data.count > 0 ? data.totalTime / data.count : 0
    }))

    // Actividad reciente (últimas 10 reparaciones)
    const recentActivity = [...repairs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)

    const metrics: TechnicianMetrics = {
      totalJobs,
      activeJobs,
      completedJobs,
      avgCompletionTime,
      completionRate,
      onTimeDeliveries,
      onTimeRate: completedWithDates.length > 0 ? (onTimeDeliveries / completedWithDates.length) * 100 : 0,
      totalRevenue,
      avgJobValue: deliveredRepairs.length > 0 ? totalRevenue / deliveredRepairs.length : 0,
      efficiency,
      workload,
      loadState
    }

    return {
      metrics,
      weeklyTrend,
      statusDistribution,
      priorityBreakdown,
      recentActivity
    }
  }, [repairs])
}
