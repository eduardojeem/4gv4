import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseMetrics } from '@/services/database-monitoring-service'
import { useDatabaseMonitoring } from '@/hooks/use-database-monitoring'

const serviceMocks = vi.hoisted(() => ({
  getDatabaseMetrics: vi.fn(),
  performMaintenanceTask: vi.fn(),
}))

vi.mock('@/services/database-monitoring-service', () => ({
  buildQuickMetrics: (metrics: DatabaseMetrics) => ({
    totalSize: `${metrics.totalSize} bytes`,
    totalSizeBytes: metrics.totalSize,
    activeConnections: metrics.connectionStats.activeConnections,
    connectionUsage: metrics.connectionStats.connectionUsage,
    avgQueryTime: metrics.queryPerformance.avgQueryTime,
    cacheHitRatio: metrics.queryPerformance.cacheHitRatio,
    alertsCount: metrics.alerts.filter(alert => !alert.resolved).length,
    status: 'good' as const,
  }),
  databaseMonitoringService: {
    getDatabaseMetrics: serviceMocks.getDatabaseMetrics,
    performMaintenanceTask: serviceMocks.performMaintenanceTask,
  },
}))

const metrics: DatabaseMetrics = {
  totalSize: 1024,
  tablesSizes: [],
  connectionStats: {
    activeConnections: 8,
    maxConnections: 100,
    connectionUsage: 8,
    avgConnectionTime: 40,
  },
  queryPerformance: {
    slowQueries: [],
    avgQueryTime: 120,
    queriesPerSecond: 10,
    cacheHitRatio: 90,
  },
  storageBreakdown: {
    tables: 700,
    indexes: 200,
    logs: 80,
    temp: 20,
    other: 24,
  },
  alerts: [],
}

describe('useDatabaseMonitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.getDatabaseMetrics.mockResolvedValue({
      success: true,
      data: metrics,
    })
    serviceMocks.performMaintenanceTask.mockResolvedValue({
      success: true,
      message: 'ok',
    })
  })

  it('passes maintenance params through to the service', async () => {
    const { result } = renderHook(() => useDatabaseMonitoring())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.performMaintenance('rotate_logs', { days: 30 })
    })

    expect(serviceMocks.performMaintenanceTask).toHaveBeenCalledWith('rotate_logs', { days: 30 })
  })

  it('derives quick metrics from the loaded metrics without an extra fetch', async () => {
    const { result } = renderHook(() => useDatabaseMonitoring({ includeQuickMetrics: true }))

    await waitFor(() => {
      expect(result.current.quickMetrics?.totalSizeBytes).toBe(1024)
    })

    expect(serviceMocks.getDatabaseMetrics).toHaveBeenCalledTimes(1)
  })
})
