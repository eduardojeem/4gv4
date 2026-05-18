'use client'

import { useState, useEffect, useCallback } from 'react'
import { alertService, type ProductAlert } from '@/lib/services/alert-service'
import { useBranch } from '@/contexts/branch-context'

export function useProductAlerts() {
  const [alerts, setAlerts] = useState<ProductAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { selectedBranchId } = useBranch()

  const loadAlerts = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const data = await alertService.getActiveAlerts(selectedBranchId)
      setAlerts(data)
    } catch (err) {
      console.error('Error loading alerts:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [selectedBranchId])

  const resolveAlert = useCallback(async (alertId: string) => {
    try {
      const success = await alertService.resolveAlert(alertId)

      if (success) {
        setAlerts((prev) => prev.filter((alert) => alert.id !== alertId))
        return true
      }

      return false
    } catch (err) {
      console.error('Error resolving alert:', err)
      setError(err instanceof Error ? err.message : 'Error al resolver alerta')
      return false
    }
  }, [])

  const resolveAllAlerts = useCallback(async () => {
    try {
      await alertService.resolveAllAlerts(selectedBranchId)
      await loadAlerts()
      return true
    } catch (err) {
      console.error('Error resolving all alerts:', err)
      setError(err instanceof Error ? err.message : 'Error al resolver todas las alertas')
      return false
    }
  }, [loadAlerts, selectedBranchId])

  const generateAlerts = useCallback(async () => {
    try {
      await alertService.generateAutomaticAlerts(selectedBranchId)
      await loadAlerts()
    } catch (err) {
      console.error('Error generating alerts:', err)
      setError(err instanceof Error ? err.message : 'Error al generar alertas')
    }
  }, [loadAlerts, selectedBranchId])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  useEffect(() => {
    const interval = setInterval(generateAlerts, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [generateAlerts])

  return {
    alerts,
    isLoading,
    error,
    refreshAlerts: loadAlerts,
    resolveAlert,
    resolveAllAlerts,
    generateAlerts,
  }
}
