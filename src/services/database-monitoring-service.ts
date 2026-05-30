import type {
  DatabaseMetrics,
  IndexStats,
  MaintenanceResponse,
  MaintenanceTask,
  MaintenanceTaskParams,
  QuickDatabaseMetrics,
} from '@/lib/superadmin/database-monitoring/contracts'

export type {
  ConnectionStats,
  DatabaseAlert,
  DatabaseGrowthPoint,
  DatabaseMetrics,
  IndexStats,
  MaintenanceResponse,
  MaintenanceTask,
  MaintenanceTaskParams,
  MonitoringSource,
  MonitoringSourceId,
  MonitoringStatus,
  QueryPerformance,
  QuickDatabaseMetrics,
  SlowQuery,
  StorageBreakdown,
  TableSize,
} from '@/lib/superadmin/database-monitoring/contracts'

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'Unavailable'
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function buildQuickMetrics(metrics: DatabaseMetrics): QuickDatabaseMetrics {
  const activeAlerts = metrics.alerts.filter((alert) => !alert.resolved)

  return {
    totalSize: formatBytes(metrics.totalSize),
    totalSizeBytes: metrics.totalSize,
    activeConnections: metrics.connectionStats?.activeConnections ?? null,
    connectionUsage: metrics.connectionStats?.connectionUsage ?? null,
    avgQueryTime: metrics.queryPerformance?.avgQueryTime ?? null,
    cacheHitRatio: metrics.queryPerformance?.cacheHitRatio ?? null,
    alertsCount: activeAlerts.length,
    status: metrics.overallStatus,
  }
}

const INDEX_REVIEW_MIN_SIZE_BYTES = 5 * 1024 * 1024
const INDEX_REVIEW_MIN_OBSERVATION_DAYS = 14

function getIndexObservationDays(index: IndexStats, now: Date = new Date()): number | null {
  if (!index.statsResetAt) return null

  const statsReset = new Date(index.statsResetAt)
  const statsResetMs = statsReset.getTime()

  if (Number.isNaN(statsResetMs)) return null

  return (now.getTime() - statsResetMs) / (1000 * 60 * 60 * 24)
}

export function isUnusedIndexReviewCandidate(index: IndexStats, now: Date = new Date()): boolean {
  const observationDays = getIndexObservationDays(index, now)

  if (index.scans > 0) return false
  if (index.sizeBytes < INDEX_REVIEW_MIN_SIZE_BYTES) return false
  if (index.isPrimary || index.isUnique || index.isConstraintBacked) return false
  if (observationDays === null || observationDays < INDEX_REVIEW_MIN_OBSERVATION_DAYS) return false

  return true
}

export function buildOptimizationRecommendations(metrics: DatabaseMetrics, indexStats: IndexStats[]): string[] {
  const recommendations: string[] = []
  const largestTable = metrics.tablesSizes[0]
  const auditLogTable = metrics.tablesSizes.find((table) => table.tableName.endsWith('audit_log') || table.tableName === 'audit_log')
  const reviewCandidateIndexes = indexStats.filter((idx) => isUnusedIndexReviewCandidate(idx))

  if (metrics.missingMetrics.length > 0) {
    recommendations.push(
      `Restore missing telemetry before acting on this dashboard. Missing sources: ${metrics.missingMetrics.join(', ')}.`
    )
  }

  if ((metrics.queryPerformance?.avgQueryTime ?? 0) > 500) {
    recommendations.push('Review slow query paths and add or tune indexes on the hottest filters before latency keeps climbing.')
  }

  if ((metrics.queryPerformance?.cacheHitRatio ?? 100) < 80) {
    recommendations.push('Cache hit ratio is below target. Inspect repeated reads and data access patterns that bypass cache reuse.')
  }

  if ((metrics.connectionStats?.connectionUsage ?? 0) > 80) {
    recommendations.push('Connection pressure is high. Review pooling, long-lived transactions and concurrent background jobs.')
  }

  if (largestTable && largestTable.percentage > 40) {
    recommendations.push(
      `${largestTable.tableName} dominates tracked storage with ${largestTable.percentage.toFixed(1)}%. Evaluate archival, partitioning or targeted cleanup.`
    )
  }

  if (auditLogTable && auditLogTable.percentage > 15) {
    recommendations.push('audit_log already carries meaningful weight. Define retention and automate rotation with explicit audit controls.')
  }

  if (reviewCandidateIndexes.length > 0) {
    const observationDays = getIndexObservationDays(reviewCandidateIndexes[0])
    const observationLabel = observationDays === null ? 'the current stats window' : `${Math.floor(observationDays)} days since stats reset`

    recommendations.push(
      `${reviewCandidateIndexes.length} large non-constraint indexes show zero scans over ${observationLabel}. Review them manually before dropping anything.`
    )
  }

  if ((metrics.totalSize ?? 0) > 1024 * 1024 * 1024) {
    recommendations.push('The database is above 1 GB. Review historical data growth, attached assets and long-retention operational tables.')
  }

  if (recommendations.length === 0) {
    recommendations.push('No immediate pressure signals were found in the currently available telemetry. Keep reviewing retention, indexes and growth trends.')
  }

  return recommendations
}

class DatabaseMonitoringService {
  async getDatabaseMetrics(forceRefresh = false): Promise<{ success: boolean; data?: DatabaseMetrics; error?: string }> {
    try {
      void forceRefresh
      const response = await fetch('/api/superadmin/database-monitoring', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        return {
          success: false,
          error: errorData?.message || errorData?.error || 'Could not load database monitoring data',
        }
      }

      const data = (await response.json()) as DatabaseMetrics

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown monitoring error',
      }
    }
  }

  async getIndexStats(forceRefresh = false): Promise<IndexStats[]> {
    const result = await this.getDatabaseMetrics(forceRefresh)
    return result.success && result.data ? result.data.indexStats : []
  }

  async getDatabaseGrowthHistory(forceRefresh = false): Promise<DatabaseMetrics['growthHistory']> {
    const result = await this.getDatabaseMetrics(forceRefresh)
    return result.success && result.data ? result.data.growthHistory : []
  }

  getOptimizationRecommendations(metrics: DatabaseMetrics, indexStats: IndexStats[]): string[] {
    return buildOptimizationRecommendations(metrics, indexStats)
  }

  async getQuickMetrics(): Promise<{ success: boolean; data?: QuickDatabaseMetrics; error?: string }> {
    const result = await this.getDatabaseMetrics()

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Could not load quick metrics',
      }
    }

    return {
      success: true,
      data: buildQuickMetrics(result.data),
    }
  }

  formatBytes(bytes: number | null): string {
    return formatBytes(bytes)
  }

  async performMaintenanceTask(task: MaintenanceTask, params?: MaintenanceTaskParams): Promise<MaintenanceResponse> {
    try {
      const apiTask = task === 'rotate_logs' ? 'rotate_audit_logs' : task

      const response = await fetch('/api/superadmin/database/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: apiTask, params }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Server-side maintenance failed')
      }

      return (await response.json()) as MaintenanceResponse
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Maintenance request failed',
        task,
        executedAt: new Date().toISOString(),
      }
    }
  }

  async rotateAuditLogs(days: number): Promise<MaintenanceResponse> {
    return this.performMaintenanceTask('rotate_logs', { days })
  }
}

export const databaseMonitoringService = new DatabaseMonitoringService()
