import { deliveredRepairRevenue, deliveryPromiseOutcome } from '@/lib/repairs/analytics-values'

import { useMemo } from 'react'
import { useRepairs } from '@/contexts/RepairsContext'
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays, subDays } from 'date-fns'
import { es } from 'date-fns/locale'

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
  onTimeRate: number | null
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
  timedCount: number
}

export function useRepairAnalytics(timeRange: string) {
  const { repairs: allRepairs, isLoading, error } = useRepairs()

  return useMemo(() => {
    const now = new Date()
    const monthCount = timeRange === '12months' ? 12 : timeRange === '3months' ? 3 : 6
    const periodStart = startOfMonth(subMonths(now, monthCount - 1))
    const repairs = allRepairs.filter(repair => {
      const created = new Date(repair.createdAt)
      return created >= periodStart && created <= now
    })
    // Pre-calcular fechas una sola vez
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

    // Usar Maps para mejor rendimiento O(1) lookup
    type RepairItem = (typeof repairs)[number]
    const repairsByMonth = new Map<string, RepairItem[]>()
    const completedByMonth = new Map<string, RepairItem[]>()
    const technicianStats = new Map<string, TechnicianPerformance>()
    const statusStats = new Map<string, { name: string; count: number; revenue: number }>()
    const deviceStats = new Map<string, { name: string; count: number; revenue: number }>()
    const priorityStats = new Map<string, { name: string; count: number; avgTime: number; totalTime: number; timedCount: number }>()

    // Labels maps para evitar recálculos
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

    // Inicializar Maps
    monthRanges.forEach(range => {
      repairsByMonth.set(range.key, [])
      completedByMonth.set(range.key, [])
    })

    // Métricas acumulativas
    let totalRepairs = 0
    let completedRepairs = 0
    let inProgressRepairs = 0
    let urgentRepairs = 0
    let totalRevenue = 0
    let onTimeDeliveries = 0
    let totalRepairTime = 0
    let completedWithTime = 0
    let completedWithPromise = 0

    // Procesar todas las reparaciones en una sola iteración
    repairs.forEach(repair => {
      totalRepairs++
      const repairDate = new Date(repair.createdAt)
      const monthKey = format(repairDate, 'yyyy-MM')
      const status = repair.dbStatus || 'unknown'
      const deviceType = repair.deviceType || 'unknown'
      const priority = repair.priority || 'medium'
      const technicianName = repair.technician?.name || 'Sin asignar'
      const revenue = deliveredRepairRevenue(repair)

      // Agregar a mes correspondiente
      const monthRepairs = repairsByMonth.get(monthKey)
      if (monthRepairs) {
        monthRepairs.push(repair)
      }

      // Métricas generales
      totalRevenue += revenue

      if (status === 'entregado') {
        completedRepairs++
        const monthCompleted = completedByMonth.get(monthKey)
        if (monthCompleted) {
          monthCompleted.push(repair)
        }

        // Calcular tiempo de reparación
        if (repair.completedAt && repair.createdAt) {
          const repairTime = differenceInDays(new Date(repair.completedAt), new Date(repair.createdAt))
          totalRepairTime += repairTime
          completedWithTime++
          
          const onTime = deliveryPromiseOutcome(repair)
          if (onTime !== null) {
            completedWithPromise++
            if (onTime) onTimeDeliveries++
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
      const priorityStat = priorityStats.get(priorityKey) || { name: priorityKey, count: 0, avgTime: 0, totalTime: 0, timedCount: 0 }
      priorityStat.count++
      if (status === 'entregado' && repair.completedAt && repair.createdAt) {
        priorityStat.timedCount++
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
        totalTime: 0,
        timedCount: 0
      }
      techStat.totalRepairs++
      if (status === 'entregado') {
        techStat.completedRepairs++
        techStat.revenue += revenue
        if (repair.completedAt && repair.createdAt) {
          techStat.totalTime += differenceInDays(new Date(repair.completedAt), new Date(repair.createdAt))
          techStat.timedCount++
        }
      }
      technicianStats.set(technicianName, techStat)
    })

    // Calcular promedios y eficiencias
    priorityStats.forEach(stat => {
      stat.avgTime = stat.timedCount > 0 ? stat.totalTime / stat.timedCount : 0
    })

    technicianStats.forEach(tech => {
      tech.avgTime = tech.timedCount > 0 ? tech.totalTime / tech.timedCount : 0
      tech.efficiency = tech.totalRepairs > 0 ? (tech.completedRepairs / tech.totalRepairs) * 100 : 0
    })

    // Generar datos mensuales optimizado
    const monthlyData: MonthlyData[] = monthRanges.map(range => {
      const monthRepairs = repairsByMonth.get(range.key) || []
      const completedRepairs = completedByMonth.get(range.key) || []
      
      const revenue = completedRepairs.reduce((sum: number, r) => sum + deliveredRepairRevenue(r), 0)
      
      const timedRepairs = completedRepairs.filter(r => r.completedAt && r.createdAt)
      let avgRepairTime = 0
      if (timedRepairs.length > 0) {
        const totalTime = timedRepairs.reduce((sum: number, r) => {
          if (r.completedAt && r.createdAt) {
            return sum + differenceInDays(new Date(r.completedAt), new Date(r.createdAt))
          }
          return sum
        }, 0)
        avgRepairTime = totalTime / timedRepairs.length
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

    // Tendencia diaria (últimos 7 días)
    const dailyTrend = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i)
      const dayRepairs = repairs.filter(r => {
        const repairDate = new Date(r.createdAt)
        return format(repairDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      })
      
      return {
        date: format(date, 'dd/MM'),
        repairs: dayRepairs.length,
        completed: dayRepairs.filter(r => r.dbStatus === 'entregado').length,
        revenue: dayRepairs.filter(r => r.dbStatus === 'entregado').reduce((sum, r) => sum + deliveredRepairRevenue(r), 0)
      }
    })

    // Métricas calculadas
    const metrics: AnalyticsMetrics = {
      totalRepairs,
      completedRepairs,
      inProgressRepairs,
      urgentRepairs,
      totalRevenue,
      avgRepairValue: completedRepairs > 0 ? totalRevenue / completedRepairs : 0,
      completionRate: totalRepairs > 0 ? (completedRepairs / totalRepairs) * 100 : 0,
      avgRepairTime: completedWithTime > 0 ? totalRepairTime / completedWithTime : 0,
      onTimeDeliveries,
      onTimeRate: completedWithPromise > 0 ? (onTimeDeliveries / completedWithPromise) * 100 : null
    }

    return {
      isLoading,
      error,
      periodLabel: `${format(periodStart, 'dd/MM/yyyy')} – ${format(now, 'dd/MM/yyyy')}`,
      metrics,
      monthlyData,
      statusAnalysis: Array.from(statusStats.values()),
      technicianAnalysis: Array.from(technicianStats.values()).sort((a, b) => b.efficiency - a.efficiency),
      deviceTypeAnalysis: Array.from(deviceStats.values()).sort((a, b) => b.count - a.count),
      priorityAnalysis: Array.from(priorityStats.values()),
      dailyTrend
    }
  }, [allRepairs, timeRange, isLoading, error])
}
