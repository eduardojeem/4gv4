/**
 * usePOSAnalytics Hook
 * 
 * Hook para acceder a analytics del POS en tiempo real
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  analyticsEngine,
  type SalesMetrics,
  type ProductMetrics,
  type CategoryMetrics,
  type HourlyMetrics,
  type Alert,
  type SaleEvent,
} from '../lib/analytics-engine'

export interface UsePOSAnalyticsReturn {
  // Metrics
  todayMetrics: SalesMetrics | null
  weekMetrics: SalesMetrics | null
  monthMetrics: SalesMetrics | null

  // Products
  topProducts: ProductMetrics[]
  categories: CategoryMetrics[]
  hourlyMetrics: HourlyMetrics[]

  // Alerts
  alerts: Alert[]
  unacknowledgedAlerts: Alert[]

  // Actions
  addSale: (sale: SaleEvent) => void
  acknowledgeAlert: (id: string) => void
  clearAlerts: () => void
  refreshMetrics: () => void
  exportData: () => ReturnType<typeof analyticsEngine.exportData>
}

export function usePOSAnalytics(): UsePOSAnalyticsReturn {
  // Metrics state
  const [todayMetrics, setTodayMetrics] = useState<SalesMetrics | null>(null)
  const [weekMetrics, setWeekMetrics] = useState<SalesMetrics | null>(null)
  const [monthMetrics, setMonthMetrics] = useState<SalesMetrics | null>(null)

  // Products state
  const [topProducts, setTopProducts] = useState<ProductMetrics[]>([])
  const [categories, setCategories] = useState<CategoryMetrics[]>([])
  const [hourlyMetrics, setHourlyMetrics] = useState<HourlyMetrics[]>([])

  // Alerts state
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unacknowledgedAlerts, setUnacknowledgedAlerts] = useState<Alert[]>([])

  /**
   * Refresh all metrics
   */
  const refreshMetrics = useCallback(() => {
    setTodayMetrics(analyticsEngine.getTodayMetrics())
    setWeekMetrics(analyticsEngine.getWeekMetrics())
    setMonthMetrics(analyticsEngine.getMonthMetrics())
    setTopProducts(analyticsEngine.getTopProducts(10))
    setCategories(analyticsEngine.getCategoryMetrics())
    setHourlyMetrics(analyticsEngine.getHourlyMetrics())
    setAlerts(analyticsEngine.getAlerts())
    setUnacknowledgedAlerts(analyticsEngine.getAlerts(true))
  }, [])

  /**
   * Add sale and refresh metrics
   */
  const addSale = useCallback(
    (sale: SaleEvent) => {
      analyticsEngine.addSale(sale)
      refreshMetrics()
    },
    [refreshMetrics]
  )

  /**
   * Acknowledge alert
   */
  const acknowledgeAlert = useCallback(
    (id: string) => {
      analyticsEngine.acknowledgeAlert(id)
      refreshMetrics()
    },
    [refreshMetrics]
  )

  /**
   * Clear all alerts
   */
  const clearAlerts = useCallback(() => {
    analyticsEngine.clearAlerts()
    refreshMetrics()
  }, [refreshMetrics])

  /**
   * Export data
   */
  const exportData = useCallback(() => {
    return analyticsEngine.exportData()
  }, [])

  /**
   * Setup listeners
   */
  useEffect(() => {
    // Initial load
    refreshMetrics()

    // Listen for changes
    const unsubscribe = analyticsEngine.addListener(() => {
      refreshMetrics()
    })

    // Listen for alerts
    const unsubscribeAlerts = analyticsEngine.addAlertListener((alert) => {
      console.log('🔔 New alert:', alert.title)
      refreshMetrics()
    })

    return () => {
      unsubscribe()
      unsubscribeAlerts()
    }
  }, [refreshMetrics])

  /**
   * Auto-refresh every minute
   */
  useEffect(() => {
    const interval = setInterval(() => {
      refreshMetrics()
    }, 60000) // 1 minute

    return () => clearInterval(interval)
  }, [refreshMetrics])

  return {
    todayMetrics,
    weekMetrics,
    monthMetrics,
    topProducts,
    categories,
    hourlyMetrics,
    alerts,
    unacknowledgedAlerts,
    addSale,
    acknowledgeAlert,
    clearAlerts,
    refreshMetrics,
    exportData,
  }
}
