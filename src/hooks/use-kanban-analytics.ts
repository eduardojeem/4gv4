import { useMemo } from 'react'
import { RepairOrder } from '@/types/repairs'
import { stageToStatus, StatusKey } from '@/lib/repairs/mapping'
import { predictRepairTime } from '@/lib/repair-predictive'
import { differenceInDays, differenceInHours } from 'date-fns'

export interface KanbanMetrics {
  totalItems: number
  byStatus: Record<StatusKey, {
    count: number
    avgPredictedHours: number
    avgWaitTime: number
    urgentCount: number
    overdueCount: number
    totalValue: number
  }>
  overallStats: {
    avgCompletionTime: number
    urgentPercentage: number
    overduePercentage: number
    totalValue: number
    throughput: number // items per day
  }
  trends: {
    bottleneck: StatusKey | null
    fastestColumn: StatusKey | null
    slowestColumn: StatusKey | null
  }
}

export interface KanbanFilters {
  searchTerm: string
  minUrgency: number
  maxUrgency: number
  technicianId?: string
  deviceType?: string
  showOverdueOnly: boolean
  showUrgentOnly: boolean
  dateRange?: {
    from: Date
    to: Date
  }
}

export function useKanbanAnalytics(
  items: RepairOrder[],
  filters: KanbanFilters
): {
  filteredItems: RepairOrder[]
  metrics: KanbanMetrics
  itemsByStatus: Record<StatusKey, RepairOrder[]>
} {
  return useMemo(() => {
    // Apply filters
    const filteredItems = items.filter(item => {
      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase()
        const searchableText = `${item.deviceModel} ${item.issueDescription} ${item.customerName}`.toLowerCase()
        if (!searchableText.includes(searchLower)) return false
      }

      // Urgency filter
      const urgency = item.urgency ?? 3
      if (urgency < filters.minUrgency || urgency > filters.maxUrgency) return false

      // Technician filter
      if (filters.technicianId && item.technician?.id !== filters.technicianId) return false

      // Device type filter
      if (filters.deviceType && item.deviceType !== filters.deviceType) return false

      // Overdue filter
      if (filters.showOverdueOnly) {
        const daysSinceCreated = differenceInDays(new Date(), new Date(item.createdAt))
        if (daysSinceCreated <= 7) return false // Consider overdue after 7 days
      }

      // Urgent filter
      if (filters.showUrgentOnly && urgency < 4) return false

      // Date range filter
      if (filters.dateRange) {
        const itemDate = new Date(item.createdAt)
        if (itemDate < filters.dateRange.from || itemDate > filters.dateRange.to) return false
      }

      return true
    })

    // Group items by status
    const itemsByStatus: Record<StatusKey, RepairOrder[]> = {
      pending: [],
      in_progress: [],
      waiting_parts: [],
      on_hold: [],
      completed: [],
      cancelled: []
    }

    filteredItems.forEach(item => {
      const status = stageToStatus(item.stage)
      itemsByStatus[status].push(item)
    })

    // Calculate metrics for each status
    const byStatus: KanbanMetrics['byStatus'] = {} as KanbanMetrics['byStatus']
    const statusKeys: StatusKey[] = ['pending', 'in_progress', 'waiting_parts', 'on_hold', 'completed', 'cancelled']

    statusKeys.forEach(status => {
      const statusItems = itemsByStatus[status]
      const count = statusItems.length

      // Calculate average predicted hours
      const predictions = statusItems.map(item => predictRepairTime(item).predictedHours)
      const avgPredictedHours = predictions.length > 0 
        ? predictions.reduce((sum, hours) => sum + hours, 0) / predictions.length 
        : 0

      // Calculate average wait time
      const waitTimes = statusItems.map(item => {
        const hoursWaiting = differenceInHours(new Date(), new Date(item.createdAt))
        return Math.max(0, hoursWaiting)
      })
      const avgWaitTime = waitTimes.length > 0 
        ? waitTimes.reduce((sum, hours) => sum + hours, 0) / waitTimes.length 
        : 0

      // Count urgent items (urgency >= 4)
      const urgentCount = statusItems.filter(item => (item.urgency ?? 3) >= 4).length

      // Count overdue items (more than 7 days)
      const overdueCount = statusItems.filter(item => {
        const daysSinceCreated = differenceInDays(new Date(), new Date(item.createdAt))
        return daysSinceCreated > 7
      }).length

      // Calculate total value
      const totalValue = statusItems.reduce((sum, item) => sum + (item.historicalValue ?? 0), 0)

      byStatus[status] = {
        count,
        avgPredictedHours: Math.round(avgPredictedHours * 10) / 10,
        avgWaitTime: Math.round(avgWaitTime * 10) / 10,
        urgentCount,
        overdueCount,
        totalValue
      }
    })

    // Calculate overall stats
    const totalItems = filteredItems.length
    const totalUrgent = filteredItems.filter(item => (item.urgency ?? 3) >= 4).length
    const totalOverdue = filteredItems.filter(item => {
      const daysSinceCreated = differenceInDays(new Date(), new Date(item.createdAt))
      return daysSinceCreated > 7
    }).length
    const totalValue = filteredItems.reduce((sum, item) => sum + (item.historicalValue ?? 0), 0)

    // Calculate completion time for completed items
    const completedItems = itemsByStatus.completed
    const completionTimes = completedItems
      .filter(item => item.updatedAt)
      .map(item => differenceInHours(new Date(item.updatedAt!), new Date(item.createdAt)))
    const avgCompletionTime = completionTimes.length > 0 
      ? completionTimes.reduce((sum, hours) => sum + hours, 0) / completionTimes.length 
      : 0

    // Calculate throughput (items completed per day)
    const recentCompletions = completedItems.filter(item => {
      if (!item.updatedAt) return false
      const daysSinceCompletion = differenceInDays(new Date(), new Date(item.updatedAt))
      return daysSinceCompletion <= 7 // Last 7 days
    })
    const throughput = recentCompletions.length / 7

    // Identify trends
    const statusCounts = statusKeys.map(status => ({ status, count: byStatus[status].count }))
    const bottleneck = statusCounts.reduce((max, current) => 
      current.count > max.count ? current : max
    ).status

    const avgWaitTimes = statusKeys.map(status => ({ 
      status, 
      avgWaitTime: byStatus[status].avgWaitTime 
    }))
    const slowestColumn = avgWaitTimes.reduce((max, current) => 
      current.avgWaitTime > max.avgWaitTime ? current : max
    ).status

    const fastestColumn = avgWaitTimes.reduce((min, current) => 
      current.avgWaitTime < min.avgWaitTime && current.avgWaitTime > 0 ? current : min
    ).status

    const metrics: KanbanMetrics = {
      totalItems,
      byStatus,
      overallStats: {
        avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
        urgentPercentage: totalItems > 0 ? Math.round((totalUrgent / totalItems) * 100) : 0,
        overduePercentage: totalItems > 0 ? Math.round((totalOverdue / totalItems) * 100) : 0,
        totalValue,
        throughput: Math.round(throughput * 10) / 10
      },
      trends: {
        bottleneck: bottleneck !== 'completed' ? bottleneck : null,
        fastestColumn: fastestColumn !== slowestColumn ? fastestColumn : null,
        slowestColumn
      }
    }

    return {
      filteredItems,
      metrics,
      itemsByStatus
    }
  }, [items, filters])
}