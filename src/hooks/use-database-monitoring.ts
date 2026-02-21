"use client"

import { useState, useEffect, useCallback } from 'react'
import { databaseMonitoringService, DatabaseMetrics } from '@/services/database-monitoring-service'

interface UseDatabaseMonitoringReturn {
  metrics: DatabaseMetrics | null
  loading: boolean
  error: string | null
  refreshing: boolean
  refresh: () => Promise<void>
  quickMetrics: {
    totalSize: number
    totalSizeFormatted: string
    activeConnections: number
    connectionUsage: number
  } | null
  performMaintenance: (task: 'reset_stats' | 'clear_logs') => Promise<{ success: boolean; message: string }>
}

export function useDatabaseMonitoring(autoRefresh = true): UseDatabaseMonitoringReturn {
  const [metrics, setMetrics] = useState<DatabaseMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [quickMetrics, setQuickMetrics] = useState<any>(null)

  const loadMetrics = useCallback(async () => {
    try {
      setRefreshing(true)
      
      const result = await databaseMonitoringService.getDatabaseMetrics()
      
      if (result.success && result.data) {
        setMetrics(result.data)
        setError(null)
        
        // También actualizar métricas rápidas
        const quickResult = await databaseMonitoringService.getQuickMetrics()
        if (quickResult.success && quickResult.data) {
          setQuickMetrics(quickResult.data)
        }
      } else {
        setError(result.error || 'Error desconocido')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando métricas')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    await loadMetrics()
  }, [loadMetrics])

  const performMaintenance = useCallback(async (task: 'reset_stats' | 'clear_logs') => {
    setRefreshing(true)
    try {
      const result = await databaseMonitoringService.performMaintenanceTask(task)
      if (result.success) {
        await loadMetrics()
      }
      return result
    } finally {
      setRefreshing(false)
    }
  }, [loadMetrics])

  useEffect(() => {
    loadMetrics()
    
    if (autoRefresh) {
      // Actualizar cada 5 minutos
      const interval = setInterval(loadMetrics, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [loadMetrics, autoRefresh])

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