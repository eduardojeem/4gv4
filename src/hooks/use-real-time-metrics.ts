"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { Customer } from './use-customer-state'
import { metricsService, RealTimeMetrics, CustomerMetrics } from '@/services/metrics-service'
import { toast } from 'sonner'

export interface MetricsAlert {
  id: string
  type: 'threshold' | 'anomaly' | 'trend' | 'system'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  value: number
  threshold?: number
  timestamp: string
  acknowledged: boolean
}

export interface MetricsThreshold {
  metric: string
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  value: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
}

export function useRealTimeMetrics(customers: Customer[]) {
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null)
  const [customerMetrics, setCustomerMetrics] = useState<CustomerMetrics | null>(null)
  const [alerts, setAlerts] = useState<MetricsAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Configuración de umbrales
  const [thresholds, setThresholds] = useState<MetricsThreshold[]>([
    {
      metric: 'todayRevenue',
      operator: 'lt',
      value: 1000000, // Gs 1,000,000
      severity: 'medium',
      enabled: true
    },
    {
      metric: 'pendingSupport',
      operator: 'gt',
      value: 10,
      severity: 'high',
      enabled: true
    },
    {
      metric: 'onlineCustomers',
      operator: 'lt',
      value: 5,
      severity: 'low',
      enabled: true
    },
    {
      metric: 'systemHealth',
      operator: 'eq',
      value: 0, // 0 = critical, 1 = warning, 2 = good, 3 = excellent
      severity: 'critical',
      enabled: true
    }
  ])

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Cargar métricas iniciales
  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Cargar métricas de clientes
      const customerResult = await metricsService.getCustomerMetrics()
      if (customerResult.success && customerResult.data) {
        setCustomerMetrics(customerResult.data)
      } else {
        throw new Error(customerResult.error || 'Error loading customer metrics')
      }

      // Cargar métricas en tiempo real
      const realTimeResult = await metricsService.getRealTimeMetrics()
      if (realTimeResult.success && realTimeResult.data) {
        setRealTimeMetrics(realTimeResult.data)
        setLastUpdate(new Date())
        checkThresholds(realTimeResult.data)
      } else {
        throw new Error(realTimeResult.error || 'Error loading real-time metrics')
      }

      setIsConnected(true)
    } catch (err: any) {
      console.error('Error loading metrics:', err)
      setError(err.message)
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Verificar umbrales y generar alertas
  const checkThresholds = useCallback((metrics: RealTimeMetrics) => {
    const newAlerts: MetricsAlert[] = []

    thresholds.forEach(threshold => {
      if (!threshold.enabled) return

      const metricValue = getMetricValue(metrics, threshold.metric)
      if (metricValue === null) return

      const shouldAlert = evaluateThreshold(metricValue, threshold)
      
      if (shouldAlert) {
        const alertId = `${threshold.metric}-${threshold.operator}-${threshold.value}-${Date.now()}`
        
        // Verificar si ya existe una alerta similar reciente
        const existingAlert = alerts.find(alert => 
          alert.id.startsWith(`${threshold.metric}-${threshold.operator}-${threshold.value}`) &&
          new Date(alert.timestamp) > new Date(Date.now() - 5 * 60 * 1000) // 5 minutos
        )

        if (!existingAlert) {
          newAlerts.push({
            id: alertId,
            type: 'threshold',
            severity: threshold.severity,
            title: getAlertTitle(threshold.metric, threshold.severity),
            message: getAlertMessage(threshold.metric, metricValue, threshold),
            value: metricValue,
            threshold: threshold.value,
            timestamp: new Date().toISOString(),
            acknowledged: false
          })
        }
      }
    })

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 50)) // Mantener solo las últimas 50 alertas
      
      // Mostrar toast para alertas críticas
      newAlerts.forEach(alert => {
        if (alert.severity === 'critical') {
          toast.error(alert.title, {
            description: alert.message,
            duration: 10000
          })
        } else if (alert.severity === 'high') {
          toast.warning(alert.title, {
            description: alert.message,
            duration: 5000
          })
        }
      })
    }
  }, [thresholds, alerts])

  // Obtener valor de métrica por nombre
  const getMetricValue = (metrics: RealTimeMetrics, metricName: string): number | null => {
    switch (metricName) {
      case 'onlineCustomers': return metrics.onlineCustomers
      case 'todayOrders': return metrics.todayOrders
      case 'todayRevenue': return metrics.todayRevenue
      case 'pendingSupport': return metrics.pendingSupport
      case 'activePromotions': return metrics.activePromotions
      case 'systemHealth': 
        const healthMap = { 'excellent': 3, 'good': 2, 'warning': 1, 'critical': 0 }
        return healthMap[metrics.systemHealth] ?? 0
      default: return null
    }
  }

  // Evaluar si se debe generar alerta
  const evaluateThreshold = (value: number, threshold: MetricsThreshold): boolean => {
    switch (threshold.operator) {
      case 'gt': return value > threshold.value
      case 'lt': return value < threshold.value
      case 'eq': return value === threshold.value
      case 'gte': return value >= threshold.value
      case 'lte': return value <= threshold.value
      default: return false
    }
  }

  // Generar título de alerta
  const getAlertTitle = (metric: string, severity: string): string => {
    const titles: Record<string, Record<string, string>> = {
      todayRevenue: {
        low: 'Ingresos Bajos',
        medium: 'Ingresos por Debajo del Objetivo',
        high: 'Ingresos Críticos',
        critical: 'Ingresos Extremadamente Bajos'
      },
      pendingSupport: {
        low: 'Tickets de Soporte Acumulándose',
        medium: 'Alto Volumen de Soporte',
        high: 'Soporte Sobrecargado',
        critical: 'Crisis en Soporte'
      },
      onlineCustomers: {
        low: 'Pocos Clientes Activos',
        medium: 'Actividad de Clientes Baja',
        high: 'Muy Pocos Clientes Online',
        critical: 'Sin Clientes Activos'
      },
      systemHealth: {
        low: 'Sistema con Problemas Menores',
        medium: 'Sistema con Advertencias',
        high: 'Sistema Degradado',
        critical: 'Sistema en Estado Crítico'
      }
    }

    return titles[metric]?.[severity] || `Alerta de ${metric}`
  }

  // Generar mensaje de alerta
  const getAlertMessage = (metric: string, value: number, threshold: MetricsThreshold): string => {
    const formatValue = (val: number) => {
      if (metric === 'todayRevenue') return `Gs ${val.toLocaleString()}`
      if (metric === 'systemHealth') {
        const healthNames = ['Crítico', 'Advertencia', 'Bueno', 'Excelente']
        return healthNames[val] || 'Desconocido'
      }
      return val.toString()
    }

    const operatorText = {
      'gt': 'mayor que',
      'lt': 'menor que',
      'eq': 'igual a',
      'gte': 'mayor o igual que',
      'lte': 'menor o igual que'
    }

    return `Valor actual: ${formatValue(value)} (${operatorText[threshold.operator]} ${formatValue(threshold.value)})`
  }

  // Inicializar métricas en tiempo real
  useEffect(() => {
    loadMetrics()

    // Configurar actualización automática cada 30 segundos
    intervalRef.current = setInterval(async () => {
      try {
        const result = await metricsService.getRealTimeMetrics()
        if (result.success && result.data) {
          setRealTimeMetrics(result.data)
          setLastUpdate(new Date())
          checkThresholds(result.data)
          setIsConnected(true)
        } else {
          setIsConnected(false)
        }
      } catch (err) {
        console.error('Error updating real-time metrics:', err)
        setIsConnected(false)
      }
    }, 30000)

    // Configurar suscripción a actualizaciones en tiempo real
    unsubscribeRef.current = metricsService.subscribeToRealTimeUpdates((metrics) => {
      setRealTimeMetrics(metrics)
      setLastUpdate(new Date())
      checkThresholds(metrics)
      setIsConnected(true)
    })

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [loadMetrics, checkThresholds])

  // Actualizar métricas de clientes cuando cambian los datos
  useEffect(() => {
    if (customers.length > 0) {
      loadMetrics()
    }
  }, [customers, loadMetrics])

  // Reconocer alerta
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ))
  }, [])

  // Eliminar alerta
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }, [])

  // Actualizar umbral
  const updateThreshold = useCallback((metric: string, updates: Partial<MetricsThreshold>) => {
    setThresholds(prev => prev.map(threshold => 
      threshold.metric === metric ? { ...threshold, ...updates } : threshold
    ))
  }, [])

  // Agregar nuevo umbral
  const addThreshold = useCallback((threshold: MetricsThreshold) => {
    setThresholds(prev => [...prev, threshold])
  }, [])

  // Eliminar umbral
  const removeThreshold = useCallback((metric: string) => {
    setThresholds(prev => prev.filter(threshold => threshold.metric !== metric))
  }, [])

  // Forzar actualización
  const forceUpdate = useCallback(() => {
    loadMetrics()
  }, [loadMetrics])

  return {
    // Datos
    realTimeMetrics,
    customerMetrics,
    alerts,
    thresholds,
    
    // Estados
    loading,
    error,
    isConnected,
    lastUpdate,
    
    // Acciones
    acknowledgeAlert,
    dismissAlert,
    updateThreshold,
    addThreshold,
    removeThreshold,
    forceUpdate,
    
    // Métricas calculadas
    unacknowledgedAlerts: alerts.filter(alert => !alert.acknowledged),
    criticalAlerts: alerts.filter(alert => alert.severity === 'critical' && !alert.acknowledged),
    alertsByType: alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }
}