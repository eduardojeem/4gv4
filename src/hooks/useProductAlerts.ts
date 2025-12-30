'use client'

import { useState, useEffect, useCallback } from 'react'
import { alertService, type ProductAlert } from '@/lib/services/alert-service'

export function useProductAlerts() {
  const [alerts, setAlerts] = useState<ProductAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Función para cargar alertas
  const loadAlerts = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const data = await alertService.getActiveAlerts()
      setAlerts(data)
    } catch (err) {
      console.error('Error loading alerts:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Función para resolver una alerta
  const resolveAlert = useCallback(async (alertId: string) => {
    try {
      const success = await alertService.resolveAlert(alertId)
      
      if (success) {
        // Actualizar estado local
        setAlerts(prev => prev.filter(alert => alert.id !== alertId))
        return true
      }
      
      return false
    } catch (err) {
      console.error('Error resolving alert:', err)
      setError(err instanceof Error ? err.message : 'Error al resolver alerta')
      return false
    }
  }, [])

  // Función para resolver todas las alertas
  const resolveAllAlerts = useCallback(async () => {
    try {
      await alertService.resolveAllAlerts()
      // Recargar alertas después de resolver todas
      await loadAlerts()
      return true
    } catch (err) {
      console.error('Error resolving all alerts:', err)
      setError(err instanceof Error ? err.message : 'Error al resolver todas las alertas')
      return false
    }
  }, [loadAlerts])

  // Función para generar alertas automáticamente
  const generateAlerts = useCallback(async () => {
    try {
      await alertService.generateAutomaticAlerts()
      // Recargar alertas después de generar nuevas
      await loadAlerts()
    } catch (err) {
      console.error('Error generating alerts:', err)
      setError(err instanceof Error ? err.message : 'Error al generar alertas')
    }
  }, [loadAlerts])

  // Cargar alertas al montar el componente
  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  // Generar alertas automáticamente cada 5 minutos
  useEffect(() => {
    const interval = setInterval(generateAlerts, 5 * 60 * 1000) // 5 minutos
    return () => clearInterval(interval)
  }, [generateAlerts])

  return {
    alerts,
    isLoading,
    error,
    refreshAlerts: loadAlerts,
    resolveAlert,
    resolveAllAlerts,
    generateAlerts
  }
}