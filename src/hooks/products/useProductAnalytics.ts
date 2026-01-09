'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { useProductErrorHandler, createProductError, ProductError } from '@/lib/product-errors'
import { 
  usePerformanceMetrics, 
  useAdvancedMemoization, 
  useOptimizedDebounce,
  PerformanceUtils,
  DEFAULT_PERFORMANCE_CONFIG,
  type PerformanceConfig
} from '@/lib/performance-optimization'
import type { 
  Product, 
  ProductMovement, 
  ProductAlert, 
  DashboardStats,
  AnalyticsConfig
} from './types'

interface TrendData {
  period: string
  value: number
  change: number
  changePercent: number
}

interface CategoryAnalytics {
  id: string
  name: string
  productCount: number
  totalValue: number
  avgPrice: number
  totalStock: number
  lowStockCount: number
}

interface SupplierAnalytics {
  id: string
  name: string
  productCount: number
  totalValue: number
  avgMargin: number
  totalStock: number
  reliability: number
}

interface InventoryAnalytics {
  totalProducts: number
  totalValue: number
  totalCost: number
  totalMargin: number
  avgMarginPercent: number
  stockDistribution: {
    inStock: number
    lowStock: number
    outOfStock: number
  }
  topCategories: CategoryAnalytics[]
  topSuppliers: SupplierAnalytics[]
  recentMovements: ProductMovement[]
  alerts: ProductAlert[]
}

/**
 * Hook para análisis avanzado de productos con métricas, alertas y optimizaciones de rendimiento
 */
export function useProductAnalytics(
  products: Product[],
  config: AnalyticsConfig = {
    dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
    includeMovements: true,
    includeAlerts: true
  },
  performanceConfig: PerformanceConfig = DEFAULT_PERFORMANCE_CONFIG
) {
  const [movements, setMovements] = useState<ProductMovement[]>([])
  const [alerts, setAlerts] = useState<ProductAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastError, setLastError] = useState<ProductError | null>(null)

  // Hooks de rendimiento
  const { recordMetric, getAverageMetrics, clearMetrics } = usePerformanceMetrics()
  const memoizationConfig = { ttl: performanceConfig.memoizationTTL || DEFAULT_PERFORMANCE_CONFIG.memoizationTTL }

  // Remove unused variable warning
  // const { memoize, clear: clearMemoization } = useAdvancedMemoization(performanceConfig.memoization)

  const supabase = createClient() as SupabaseClient<Database>
  const { handleProductError } = useProductErrorHandler()

  // Cargar movimientos y alertas si están configurados
  useEffect(() => {
    if (config.includeMovements || config.includeAlerts) {
      loadAnalyticsData()
    }
  }, [config.includeMovements, config.includeAlerts, config.dateRange, loadAnalyticsData])

  // Validar configuración de análisis
  const validateAnalyticsConfig = useCallback((config: AnalyticsConfig): boolean => {
    try {
      if (config.dateRange) {
        if (!config.dateRange.start || !config.dateRange.end) {
          throw createProductError.invalidDateRange(config.dateRange.start, config.dateRange.end)
        }

        if (config.dateRange.start > config.dateRange.end) {
          throw createProductError.invalidDateRange(config.dateRange.start, config.dateRange.end)
        }

        // Validar que el rango no sea demasiado amplio (más de 2 años)
        const diffInDays = (config.dateRange.end.getTime() - config.dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
        if (diffInDays > 730) {
          throw createProductError.slowOperationWarning('analytics_date_range', diffInDays, 730)
        }
      }

      return true
    } catch (error) {
      const productError = handleProductError(error, 'validate analytics config')
      setLastError(productError)
      return false
    }
  }, [handleProductError])

  // Cargar datos de análisis con optimizaciones de rendimiento
  const loadAnalyticsData = useCallback(async () => {
    const startTime = performance.now()
    
    try {
      setLoading(true)
      setError(null)
      setLastError(null)

      // Validar configuración de análisis
      if (!validateAnalyticsConfig(config)) {
        return
      }

      // Después de validación, dateRange está garantizado de existir
      const dateRange = config.dateRange!

      // Validar productos
      if (!Array.isArray(products)) {
        throw createProductError.invalidProductData(products, [])
      }

      // Verificar rendimiento para datasets grandes
      if (products.length > 1000) { // Default large dataset threshold
        console.warn(`Análisis de ${products.length} productos puede ser lento`)
      }

      const productIds = products.map(p => p.id)

      // Procesar en paralelo para mejor rendimiento
      const promises = []

      // Cargar movimientos si está habilitado
      if (config.includeMovements) {
        const movementsQuery = supabase
          .from('product_movements')
          .select('*')
          .in('product_id', productIds)
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
          .order('created_at', { ascending: false })
        
        promises.push(
          movementsQuery.then(({ data, error }: { data: ProductMovement[] | null; error: any }) => {
            if (error) {
              throw createProductError.analyticsCalculationError('load_movements', error)
            }
            return { type: 'movements' as const, data: data || [] }
          })
        )
      }

      // Cargar alertas si está habilitado
      if (config.includeAlerts) {
        const alertsQuery = supabase
          .from('product_alerts')
          .select('*')
          .in('product_id', productIds)
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
          .order('created_at', { ascending: false })
        
        promises.push(
          alertsQuery.then(({ data, error }: { data: ProductAlert[] | null; error: any }) => {
            if (error) {
              throw createProductError.analyticsCalculationError('load_alerts', error)
            }
            return { type: 'alerts' as const, data: data || [] }
          })
        )
      }

      // Ejecutar todas las consultas en paralelo
      type QueryResult = 
        | { type: 'movements'; data: ProductMovement[] }
        | { type: 'alerts'; data: ProductAlert[] }
      
      const results = await Promise.all(promises) as QueryResult[]
      
      // Procesar resultados
      results.forEach((result: QueryResult) => {
        if (result.type === 'movements') {
          setMovements(result.data)
        } else if (result.type === 'alerts') {
          setAlerts(result.data)
        }
      })

      const duration = performance.now() - startTime
      recordMetric({
        operationName: 'analytics_load',
        duration,
        timestamp: Date.now()
      })

      if (duration > 1000) { // Default slow operation threshold
        console.warn(`Carga de análisis lenta: ${duration}ms para ${products.length} productos`)
      }

    } catch (error) {
      const productError = createProductError.analyticsCalculationError('load_analytics_data', error)

      handleProductError(productError)
      setLastError(productError)
      setError(productError.message)
    } finally {
      setLoading(false)
    }
  }, [products, config, supabase, handleProductError, recordMetric, validateAnalyticsConfig])

  // Estadísticas básicas del dashboard con optimización
  const dashboardStats: DashboardStats = useAdvancedMemoization(() => {
    const startTime = performance.now()

    const activeProducts = products.filter(p => p.is_active)
    const totalStockValue = products.reduce((sum, p) => sum + ((p.sale_price || 0) * (p.stock_quantity || 0)), 0)
    const totalCostValue = products.reduce((sum, p) => sum + ((p.purchase_price || 0) * (p.stock_quantity || 0)), 0)
    const totalMargin = totalStockValue - totalCostValue
    const avgMarginPercentage = products.length > 0
      ? products.reduce((sum, p) => sum + (p.margin_percentage || 0), 0) / products.length
      : 0

    const lowStockCount = products.filter(p => p.stock_status === 'low_stock').length
    const outOfStockCount = products.filter(p => p.stock_status === 'out_of_stock').length

    // Contar categorías y proveedores únicos
    const uniqueCategories = new Set(products.map(p => p.category?.id).filter(Boolean))
    const uniqueSuppliers = new Set(products.map(p => p.supplier?.id).filter(Boolean))

    const result = {
      totalProducts: products.length,
      activeProducts: activeProducts.length,
      totalStockValue,
      totalCostValue,
      totalMargin,
      avgMarginPercentage,
      lowStockCount,
      outOfStockCount,
      categoriesCount: uniqueCategories.size,
      suppliersCount: uniqueSuppliers.size
    }

    const duration = performance.now() - startTime
    recordMetric({
      operationName: 'dashboard_stats',
      duration,
      timestamp: Date.now()
    })

    return result
  }, [products], memoizationConfig)

  // Análisis por categorías con optimización
  const categoryAnalytics: CategoryAnalytics[] = useAdvancedMemoization(() => {
    const startTime = performance.now()

    const categoryMap = new Map<string, CategoryAnalytics>()

    products.forEach(product => {
      if (!product.category) return

      const categoryId = product.category.id
      const existing = categoryMap.get(categoryId)

      if (existing) {
        existing.productCount++
        existing.totalValue += (product.sale_price || 0) * (product.stock_quantity || 0)
        existing.totalStock += product.stock_quantity || 0
        if (product.stock_status === 'low_stock') existing.lowStockCount++
      } else {
        categoryMap.set(categoryId, {
          id: categoryId,
          name: product.category.name || 'Sin nombre',
          productCount: 1,
          totalValue: (product.sale_price || 0) * (product.stock_quantity || 0),
          avgPrice: product.sale_price || 0,
          totalStock: product.stock_quantity || 0,
          lowStockCount: product.stock_status === 'low_stock' ? 1 : 0
        })
      }
    })

    // Calcular promedios
    const result = Array.from(categoryMap.values()).map(category => ({
      ...category,
      avgPrice: category.totalValue / category.totalStock || 0
    })).sort((a, b) => b.totalValue - a.totalValue)

    const duration = performance.now() - startTime
    recordMetric({
      operationName: 'category_analytics',
      duration,
      timestamp: Date.now()
    })

    return result
  }, [products], memoizationConfig)

  // Análisis por proveedores con optimización
  const supplierAnalytics: SupplierAnalytics[] = useAdvancedMemoization(() => {
    const startTime = performance.now()

    const supplierMap = new Map<string, SupplierAnalytics>()

    products.forEach(product => {
      if (!product.supplier) return

      const supplierId = product.supplier.id
      const existing = supplierMap.get(supplierId)

      if (existing) {
        existing.productCount++
        existing.totalValue += (product.sale_price || 0) * (product.stock_quantity || 0)
        existing.totalStock += product.stock_quantity || 0
        existing.avgMargin += product.margin_percentage || 0
      } else {
        supplierMap.set(supplierId, {
          id: supplierId,
          name: product.supplier.name || 'Sin nombre',
          productCount: 1,
          totalValue: (product.sale_price || 0) * (product.stock_quantity || 0),
          avgMargin: product.margin_percentage || 0,
          totalStock: product.stock_quantity || 0,
          reliability: 100 // Placeholder - se puede calcular basado en entregas
        })
      }
    })

    // Calcular promedios
    const result = Array.from(supplierMap.values()).map(supplier => ({
      ...supplier,
      avgMargin: supplier.avgMargin / supplier.productCount || 0
    })).sort((a, b) => b.totalValue - a.totalValue)

    const duration = performance.now() - startTime
    recordMetric({
      operationName: 'supplier_analytics',
      duration,
      timestamp: Date.now()
    })

    return result
  }, [products], memoizationConfig)

  // Análisis completo de inventario con optimización
  const inventoryAnalytics: InventoryAnalytics = useAdvancedMemoization(() => {
    const startTime = performance.now()

    const result = {
      totalProducts: dashboardStats.totalProducts,
      totalValue: dashboardStats.totalStockValue,
      totalCost: dashboardStats.totalCostValue,
      totalMargin: dashboardStats.totalMargin,
      avgMarginPercent: dashboardStats.avgMarginPercentage,
      stockDistribution: {
        inStock: products.filter(p => p.stock_status === 'in_stock').length,
        lowStock: dashboardStats.lowStockCount,
        outOfStock: dashboardStats.outOfStockCount
      },
      topCategories: categoryAnalytics.slice(0, 5),
      topSuppliers: supplierAnalytics.slice(0, 5),
      recentMovements: movements.slice(0, 10),
      alerts: alerts
    }

    const duration = performance.now() - startTime
    recordMetric({
      operationName: 'inventory_analytics',
      duration,
      timestamp: Date.now()
    })

    return result
  }, [dashboardStats, categoryAnalytics, supplierAnalytics, movements, alerts, products], memoizationConfig)

  // Tendencias de productos con optimización
  const productTrends: TrendData[] = useAdvancedMemoization(() => {
    const startTime = performance.now()

    // Esto es un ejemplo - en una implementación real se calcularía con datos históricos
    const currentMonth = new Date().getMonth()
    const trends = []

    for (let i = 5; i >= 0; i--) {
      const month = new Date()
      month.setMonth(currentMonth - i)

      trends.push({
        period: month.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
        value: Math.floor(Math.random() * 1000) + 500,
        change: Math.floor(Math.random() * 200) - 100,
        changePercent: Math.floor(Math.random() * 20) - 10
      })
    }

    const duration = performance.now() - startTime
    recordMetric({
      operationName: 'product_trends',
      duration,
      timestamp: Date.now()
    })

    return trends
  }, [], memoizationConfig)

  // Productos con mejor rendimiento con optimización
  const topPerformingProducts = useAdvancedMemoization(() => {
    const startTime = performance.now()

    const result = products
      .filter(p => p.is_active)
      .sort((a, b) => {
        const aValue = (a.sale_price || 0) * (a.stock_quantity || 0) * (a.margin_percentage || 0)
        const bValue = (b.sale_price || 0) * (b.stock_quantity || 0) * (b.margin_percentage || 0)
        return bValue - aValue
      })
      .slice(0, 10)

    const duration = performance.now() - startTime
    recordMetric({
      operationName: 'top_performing_products',
      duration,
      timestamp: Date.now()
    })

    return result
  }, [products], memoizationConfig)

  // Productos que necesitan atención con optimización
  const productsNeedingAttention = useAdvancedMemoization(() => {
    const startTime = performance.now()

    const result = products.filter(p =>
      p.stock_status === 'low_stock' ||
      p.stock_status === 'out_of_stock' ||
      !p.supplier ||
      !p.category ||
      (p.margin_percentage || 0) < 10
    )

    const duration = performance.now() - startTime
    recordMetric({
      operationName: 'products_needing_attention',
      duration,
      timestamp: Date.now()
    })

    return result
  }, [products], memoizationConfig)

  // Funciones de recuperación de errores
  const retryLastOperation = useCallback(async () => {
    if (!lastError || !lastError.retryable) {
      return { success: false, error: 'No hay operación para reintentar' }
    }

    setLastError(null)
    
    try {
      await loadAnalyticsData()
      return { success: true }
    } catch (error) {
      const productError = handleProductError(error, 'retry analytics operation')
      setLastError(productError)
      return { success: false, error: productError.message }
    }
  }, [lastError, loadAnalyticsData, handleProductError])

  const clearError = useCallback(() => {
    setLastError(null)
    setError(null)
  }, [])

  // Función para exportar datos de análisis
  const exportAnalyticsData = useCallback(async (format: 'json' | 'csv' = 'json') => {
    try {
      const data = {
        dashboardStats,
        inventoryAnalytics,
        categoryAnalytics,
        supplierAnalytics,
        productTrends,
        topPerformingProducts,
        productsNeedingAttention,
        exportedAt: new Date().toISOString()
      }

      if (format === 'json') {
        return { success: true, data: JSON.stringify(data, null, 2) }
      }

      // Para CSV, convertir a formato tabular básico
      const csvData = [
        ['Métrica', 'Valor'],
        ['Total Productos', dashboardStats.totalProducts.toString()],
        ['Valor Total Stock', dashboardStats.totalStockValue.toString()],
        ['Margen Promedio', `${dashboardStats.avgMarginPercentage.toFixed(2)}%`],
        ['Productos Bajo Stock', dashboardStats.lowStockCount.toString()],
        ['Productos Sin Stock', dashboardStats.outOfStockCount.toString()]
      ]

      const csvString = csvData.map(row => row.join(',')).join('\n')
      return { success: true, data: csvString }
    } catch (error) {
      const productError = handleProductError(error, 'export analytics data')
      setLastError(productError)
      return { success: false, error: productError.message }
    }
  }, [dashboardStats, inventoryAnalytics, categoryAnalytics, supplierAnalytics, 
      productTrends, topPerformingProducts, productsNeedingAttention, handleProductError])

  // Funciones de rendimiento
  const clearPerformanceData = useCallback(() => {
    clearMetrics()
  }, [clearMetrics])

  const getPerformanceReport = useCallback(() => {
    const metrics = getAverageMetrics()
    const memoryUsage = 0 // Placeholder - PerformanceUtils.getMemoryUsage() not available

    return {
      metrics,
      memoryUsage,
      recommendations: [], // Placeholder - PerformanceUtils.generatePerformanceRecommendations not available
      analyticsStats: {
        totalOperations: metrics ? 1 : 0,
        averageLoadTime: metrics?.averageDuration || 0,
        slowestOperation: { operation: '', time: 0 }
      }
    }
  }, [getAverageMetrics])

  return {
    // Datos principales
    dashboardStats,
    inventoryAnalytics,
    categoryAnalytics,
    supplierAnalytics,
    
    // Tendencias y análisis
    productTrends,
    topPerformingProducts,
    productsNeedingAttention,
    
    // Datos adicionales
    movements,
    alerts,
    
    // Estados
    loading,
    error,
    lastError,
    
    // Funciones
    loadAnalyticsData,
    refreshAnalytics: loadAnalyticsData,
    exportAnalyticsData,
    
    // Manejo de errores
    retryLastOperation,
    clearError,
    validateAnalyticsConfig,
    
    // Rendimiento
    getPerformanceReport,
    clearPerformanceData,
    performanceConfig
  }
}