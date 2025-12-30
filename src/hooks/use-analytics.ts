"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Customer } from './use-customer-state'
import { analyticsService, AnalyticsData, PredictionData } from '@/services/analytics-service'
import { toast } from 'sonner'

export interface AnalyticsMetric {
  id: string
  name: string
  enabled: boolean
  type: 'currency' | 'percentage' | 'number' | 'count'
}

export interface ComparisonData {
  current: number
  previous: number
  change: number
  changePercentage: number
}

export function useAnalytics(customers: Customer[]) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [predictions, setPredictions] = useState<PredictionData | null>(null)
  const [comparisons, setComparisons] = useState<Record<string, ComparisonData> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d')

  // Métricas configurables
  const [selectedMetrics, setSelectedMetrics] = useState<AnalyticsMetric[]>([
    { id: 'clv', name: 'Customer Lifetime Value', enabled: true, type: 'currency' },
    { id: 'cac', name: 'Customer Acquisition Cost', enabled: true, type: 'currency' },
    { id: 'churn', name: 'Churn Rate', enabled: true, type: 'percentage' },
    { id: 'nps', name: 'Net Promoter Score', enabled: true, type: 'number' },
    { id: 'arpu', name: 'Average Revenue Per User', enabled: false, type: 'currency' },
    { id: 'retention', name: 'Retention Rate', enabled: false, type: 'percentage' }
  ])

  // Cargar datos de analíticas
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Cargar analíticas principales
      const analyticsResult = await analyticsService.getAnalytics(customers, selectedPeriod)
      if (analyticsResult.success && analyticsResult.data) {
        setAnalytics(analyticsResult.data)
      } else {
        throw new Error(analyticsResult.error || 'Error loading analytics')
      }

      // Cargar predicciones
      const predictionsResult = await analyticsService.getPredictions(customers, selectedPeriod)
      if (predictionsResult.success && predictionsResult.data) {
        setPredictions(predictionsResult.data)
      }

      // Cargar comparaciones
      const comparisonsResult = await analyticsService.getComparisons(customers, selectedPeriod)
      if (comparisonsResult.success && comparisonsResult.data) {
        setComparisons(comparisonsResult.data)
      }

    } catch (err: any) {
      console.error('Error loading analytics:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [customers, selectedPeriod])

  // Actualizar período seleccionado
  const updatePeriod = useCallback((period: '7d' | '30d' | '90d' | '1y') => {
    setSelectedPeriod(period)
  }, [])

  // Toggle métrica
  const toggleMetric = useCallback((metricId: string) => {
    setSelectedMetrics(prev => prev.map(metric => 
      metric.id === metricId ? { ...metric, enabled: !metric.enabled } : metric
    ))
  }, [])

  // Exportar datos
  const exportData = useCallback(async (format: 'pdf' | 'excel') => {
    if (!analytics) {
      throw new Error('No hay datos para exportar')
    }

    try {
      const result = await analyticsService.exportData(analytics, format)
      if (!result.success) {
        throw new Error(result.error || 'Error al exportar datos')
      }
      
      return result.data
    } catch (error: any) {
      console.error('Error exporting data:', error)
      throw error
    }
  }, [analytics])

  // Refrescar datos
  const refreshData = useCallback(() => {
    loadAnalytics()
  }, [loadAnalytics])

  // Cargar datos iniciales
  useEffect(() => {
    if (customers.length > 0) {
      loadAnalytics()
    }
  }, [customers, loadAnalytics])

  // Métricas calculadas
  const calculatedMetrics = useMemo(() => {
    if (!analytics) return null

    return {
      totalRevenue: analytics.monthlyRevenue.reduce((sum, month) => sum + month.revenue, 0),
      totalCustomers: analytics.monthlyRevenue.reduce((sum, month) => sum + month.newCustomers, 0),
      averageOrderValue: analytics.metrics.averageLifetimeValue / Math.max(analytics.metrics.averageOrderCount, 1),
      growthRate: analytics.monthlyRevenue.length > 1 
        ? ((analytics.monthlyRevenue[analytics.monthlyRevenue.length - 1].revenue - 
            analytics.monthlyRevenue[0].revenue) / analytics.monthlyRevenue[0].revenue) * 100
        : 0
    }
  }, [analytics])

  // Insights automáticos
  const insights = useMemo(() => {
    if (!analytics || !calculatedMetrics) return []

    const insights = []

    // Insight de crecimiento
    if (calculatedMetrics.growthRate > 10) {
      insights.push({
        type: 'positive',
        title: 'Crecimiento Acelerado',
        description: `Los ingresos han crecido un ${calculatedMetrics.growthRate.toFixed(1)}% en el período seleccionado`,
        action: 'Considerar expandir estrategias exitosas'
      })
    } else if (calculatedMetrics.growthRate < -5) {
      insights.push({
        type: 'warning',
        title: 'Declive en Ingresos',
        description: `Los ingresos han disminuido un ${Math.abs(calculatedMetrics.growthRate).toFixed(1)}% en el período`,
        action: 'Revisar estrategias de retención y adquisición'
      })
    }

    // Insight de churn rate
    if (analytics.metrics.churnRate > 10) {
      insights.push({
        type: 'warning',
        title: 'Alta Tasa de Abandono',
        description: `La tasa de churn es del ${analytics.metrics.churnRate.toFixed(1)}%, por encima del objetivo`,
        action: 'Implementar programas de retención'
      })
    }

    // Insight de CLV vs CAC
    const clvCacRatio = analytics.metrics.averageLifetimeValue / analytics.metrics.customerAcquisitionCost
    if (clvCacRatio < 3) {
      insights.push({
        type: 'warning',
        title: 'Ratio CLV/CAC Bajo',
        description: `El ratio CLV/CAC es ${clvCacRatio.toFixed(1)}, debería ser mayor a 3`,
        action: 'Optimizar costos de adquisición o aumentar valor de vida'
      })
    }

    return insights
  }, [analytics, calculatedMetrics])

  return {
    // Datos
    analytics,
    predictions,
    comparisons,
    calculatedMetrics,
    insights,
    
    // Estados
    loading,
    error,
    selectedPeriod,
    selectedMetrics,
    
    // Acciones
    setSelectedPeriod: updatePeriod,
    toggleMetric,
    exportData,
    refreshData,
    
    // Métricas habilitadas
    enabledMetrics: selectedMetrics.filter(m => m.enabled)
  }
}