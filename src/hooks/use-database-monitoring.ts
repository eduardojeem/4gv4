"use client"

import { useState, useEffect, useCallback } from 'react'
import {
  buildQuickMetrics,
  databaseMonitoringService,
  MaintenanceResponse,
  DatabaseMetrics,
  MaintenanceTask,
  MaintenanceTaskParams,
  QuickDatabaseMetrics,
} from '@/services/database-monitoring-service'

interface UseDatabaseMonitoringReturn {
  metrics: DatabaseMetrics | null
  loading: boolean
  error: string | null
  refreshing: boolean
  refresh: () => Promise<void>
  quickMetrics: QuickDatabaseMetrics | null
  performMaintenance: (task: MaintenanceTask, params?: MaintenanceTaskParams) => Promise<MaintenanceResponse>
}

interface UseDatabaseMonitoringOptions {
  autoRefresh?: boolean
  refreshIntervalMs?: number
  includeQuickMetrics?: boolean
}

export function useDatabaseMonitoring({
  autoRefresh = false,
  refreshIntervalMs = 2 * 60 * 1000, // Default: 2 minutes (was 30s, too aggressive)
  includeQuickMetrics = false,
}: UseDatabaseMonitoringOptions = {}): UseDatabaseMonitoringReturn {
  const [metrics, setMetrics] = useState<DatabaseMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [quickMetrics, setQuickMetrics] = useState<QuickDatabaseMetrics | null>(null)

  const loadMetrics = useCallback(async (forceRefresh = false) => {
    try {
      setRefreshing(true)

      const result = await databaseMonitoringService.getDatabaseMetrics(forceRefresh)

      if (result.success && result.data) {
        setMetrics(result.data)
        setError(null)
        setQuickMetrics(includeQuickMetrics ? buildQuickMetrics(result.data) : null)
      } else {
        setError(result.error || 'Error desconocido')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando métricas')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [includeQuickMetrics])

  const refresh = useCallback(async () => {
    await loadMetrics(true) // Force refresh bypasses cache
  }, [loadMetrics])

  const performMaintenance = useCallback(async (task: MaintenanceTask, params?: MaintenanceTaskParams) => {
    setRefreshing(true)
    try {
      const result = await databaseMonitoringService.performMaintenanceTask(task, params)
      if (result.success) {
        await loadMetrics(true) // Force refresh after maintenance
      }
      return result
    } finally {
      setRefreshing(false)
    }
  }, [loadMetrics])

  useEffect(() => {
    void loadMetrics() // Initial load uses cache if available

    if (autoRefresh) {
      const interval = setInterval(() => {
        void loadMetrics(true) // Auto-refresh bypasses cache
      }, refreshIntervalMs)
      return () => clearInterval(interval)
    }
  }, [loadMetrics, autoRefresh, refreshIntervalMs])

  return {
    metrics,
    loading,
    error,
    refreshing,
    refresh,
    quickMetrics,
    performMaintenance
  }
}
