/**
 * Sistema de monitoreo de performance para POS
 * Rastrea métricas de rendimiento y proporciona insights para optimización
 */

interface PerformanceMetric {
  name: string
  value: number
  timestamp: Date
  context?: Record<string, any>
}

interface PerformanceThresholds {
  cartOperationTime: number // ms
  productSearchTime: number // ms
  saleProcessingTime: number // ms
  databaseQueryTime: number // ms
  renderTime: number // ms
}

interface PerformanceReport {
  summary: {
    averageCartOperation: number
    averageProductSearch: number
    averageSaleProcessing: number
    averageDatabaseQuery: number
    averageRenderTime: number
    totalOperations: number
    slowOperations: number
    performanceScore: number
  }
  metrics: PerformanceMetric[]
  recommendations: string[]
  alerts: PerformanceAlert[]
}

interface PerformanceAlert {
  type: 'warning' | 'critical'
  message: string
  metric: string
  value: number
  threshold: number
  timestamp: Date
}

class POSPerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private maxMetrics = 1000
  private thresholds: PerformanceThresholds = {
    cartOperationTime: 300, // 300ms
    productSearchTime: 1000, // 1000ms (1s)
    saleProcessingTime: 3000, // 3s
    databaseQueryTime: 2000, // 2s
    renderTime: 60 // 60ms (~16fps) - Relaxed for complex components
  }
  private alerts: PerformanceAlert[] = []
  private isEnabled = true

  /**
   * Iniciar medición de performance
   */
  startMeasurement(name: string, context?: Record<string, any>): () => void {
    if (!this.isEnabled) return () => {}

    const startTime = performance.now()
    const startMark = `${name}-start-${Date.now()}`
    
    performance.mark(startMark)

    return () => {
      const endTime = performance.now()
      const duration = endTime - startTime
      const endMark = `${name}-end-${Date.now()}`
      
      performance.mark(endMark)
      
      try {
        performance.measure(name, startMark, endMark)
      } catch (error) {
        console.warn('Performance measurement failed:', error)
      }

      this.recordMetric(name, duration, context)
    }
  }

  /**
   * Registrar métrica de performance
   */
  recordMetric(name: string, value: number, context?: Record<string, any>) {
    if (!this.isEnabled) return

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: new Date(),
      context
    }

    this.metrics.unshift(metric)

    // Mantener límite de métricas
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(0, this.maxMetrics)
    }

    // Verificar thresholds y generar alertas
    this.checkThresholds(metric)
  }

  /**
   * Verificar thresholds y generar alertas
   */
  private checkThresholds(metric: PerformanceMetric) {
    let threshold: number | undefined
    let alertType: 'warning' | 'critical' = 'warning'

    switch (metric.name) {
      case 'cart-operation':
        threshold = this.thresholds.cartOperationTime
        alertType = metric.value > threshold * 2 ? 'critical' : 'warning'
        break
      case 'product-search':
        threshold = this.thresholds.productSearchTime
        alertType = metric.value > threshold * 2 ? 'critical' : 'warning'
        break
      case 'sale-processing':
        threshold = this.thresholds.saleProcessingTime
        alertType = metric.value > threshold * 1.5 ? 'critical' : 'warning'
        break
      case 'database-query':
        threshold = this.thresholds.databaseQueryTime
        alertType = metric.value > threshold * 2 ? 'critical' : 'warning'
        break
      case 'render-time':
        threshold = this.thresholds.renderTime
        alertType = metric.value > threshold * 3 ? 'critical' : 'warning'
        break
    }

    if (threshold && metric.value > threshold) {
      const alert: PerformanceAlert = {
        type: alertType,
        message: this.getAlertMessage(metric.name, metric.value, threshold),
        metric: metric.name,
        value: metric.value,
        threshold,
        timestamp: new Date()
      }

      this.alerts.unshift(alert)

      // Mantener solo las últimas 50 alertas
      if (this.alerts.length > 50) {
        this.alerts = this.alerts.slice(0, 50)
      }

      // Log crítico para alertas críticas con objeto serializable
      const logPayload = {
        type: alert.type,
        metric: alert.metric,
        value: Number(alert.value),
        threshold: Number(alert.threshold),
        message: alert.message,
        timestamp: alert.timestamp instanceof Date ? alert.timestamp.toISOString() : String(alert.timestamp)
      }
      if (alertType === 'critical') {
        console.warn('Performance Critical Alert:', JSON.stringify(logPayload, null, 2))
      } else {
        console.log('Performance Warning:', JSON.stringify(logPayload, null, 2))
      }
    }
  }

  /**
   * Generar mensaje de alerta
   */
  private getAlertMessage(metricName: string, value: number, threshold: number): string {
    const messages: Record<string, string> = {
      'cart-operation': `Operación de carrito lenta: ${value.toFixed(0)}ms (límite: ${threshold}ms)`,
      'product-search': `Búsqueda de productos lenta: ${value.toFixed(0)}ms (límite: ${threshold}ms)`,
      'sale-processing': `Procesamiento de venta lento: ${value.toFixed(0)}ms (límite: ${threshold}ms)`,
      'database-query': `Consulta de base de datos lenta: ${value.toFixed(0)}ms (límite: ${threshold}ms)`,
      'render-time': `Tiempo de renderizado alto: ${value.toFixed(1)}ms (límite: ${threshold}ms)`
    }

    return messages[metricName] || `Métrica ${metricName} excede el límite: ${value.toFixed(0)}ms`
  }

  /**
   * Generar reporte de performance
   */
  generateReport(timeRange?: { start: Date; end: Date }): PerformanceReport {
    let filteredMetrics = this.metrics

    if (timeRange) {
      filteredMetrics = this.metrics.filter(
        metric => metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
      )
    }

    const metricsByType = this.groupMetricsByType(filteredMetrics)
    
    const summary = {
      averageCartOperation: this.calculateAverage(metricsByType['cart-operation'] || []),
      averageProductSearch: this.calculateAverage(metricsByType['product-search'] || []),
      averageSaleProcessing: this.calculateAverage(metricsByType['sale-processing'] || []),
      averageDatabaseQuery: this.calculateAverage(metricsByType['database-query'] || []),
      averageRenderTime: this.calculateAverage(metricsByType['render-time'] || []),
      totalOperations: filteredMetrics.length,
      slowOperations: this.countSlowOperations(filteredMetrics),
      performanceScore: this.calculatePerformanceScore(filteredMetrics)
    }

    const recommendations = this.generateRecommendations(summary)
    const recentAlerts = this.alerts.slice(0, 10)

    return {
      summary,
      metrics: filteredMetrics.slice(0, 100), // Últimas 100 métricas
      recommendations,
      alerts: recentAlerts
    }
  }

  /**
   * Agrupar métricas por tipo
   */
  private groupMetricsByType(metrics: PerformanceMetric[]): Record<string, PerformanceMetric[]> {
    return metrics.reduce((groups, metric) => {
      if (!groups[metric.name]) {
        groups[metric.name] = []
      }
      groups[metric.name].push(metric)
      return groups
    }, {} as Record<string, PerformanceMetric[]>)
  }

  /**
   * Calcular promedio de métricas
   */
  private calculateAverage(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0
    const sum = metrics.reduce((total, metric) => total + metric.value, 0)
    return Math.round((sum / metrics.length) * 100) / 100
  }

  /**
   * Contar operaciones lentas
   */
  private countSlowOperations(metrics: PerformanceMetric[]): number {
    return metrics.filter(metric => {
      let threshold: number | undefined
      
      switch (metric.name) {
        case 'cart-operation':
          threshold = this.thresholds.cartOperationTime
          break
        case 'product-search':
          threshold = this.thresholds.productSearchTime
          break
        case 'sale-processing':
          threshold = this.thresholds.saleProcessingTime
          break
        case 'database-query':
          threshold = this.thresholds.databaseQueryTime
          break
        case 'render-time':
          threshold = this.thresholds.renderTime
          break
      }
      
      return threshold && metric.value > threshold
    }).length
  }

  /**
   * Calcular score de performance (0-100)
   */
  private calculatePerformanceScore(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 100

    const slowOperations = this.countSlowOperations(metrics)
    const slowRatio = slowOperations / metrics.length
    
    // Score basado en ratio de operaciones lentas
    const baseScore = Math.max(0, 100 - (slowRatio * 100))
    
    // Penalizar alertas críticas
    const criticalAlerts = this.alerts.filter(alert => alert.type === 'critical').length
    const criticalPenalty = Math.min(criticalAlerts * 5, 30)
    
    return Math.max(0, Math.round(baseScore - criticalPenalty))
  }

  /**
   * Generar recomendaciones de optimización
   */
  private generateRecommendations(summary: PerformanceReport['summary']): string[] {
    const recommendations: string[] = []

    if (summary.averageCartOperation > this.thresholds.cartOperationTime) {
      recommendations.push('Optimizar operaciones de carrito: considerar memoización de cálculos')
    }

    if (summary.averageProductSearch > this.thresholds.productSearchTime) {
      recommendations.push('Optimizar búsqueda de productos: implementar debouncing o índices de búsqueda')
    }

    if (summary.averageSaleProcessing > this.thresholds.saleProcessingTime) {
      recommendations.push('Optimizar procesamiento de ventas: revisar consultas de base de datos')
    }

    if (summary.averageDatabaseQuery > this.thresholds.databaseQueryTime) {
      recommendations.push('Optimizar consultas de base de datos: agregar índices o usar caché')
    }

    if (summary.averageRenderTime > this.thresholds.renderTime) {
      recommendations.push('Optimizar renderizado: usar React.memo y reducir re-renders innecesarios')
    }

    if (summary.performanceScore < 70) {
      recommendations.push('Performance general baja: revisar todas las operaciones críticas')
    }

    if (summary.slowOperations > summary.totalOperations * 0.2) {
      recommendations.push('Alto porcentaje de operaciones lentas: revisar configuración del sistema')
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance óptima: el sistema está funcionando correctamente')
    }

    return recommendations
  }

  /**
   * Obtener métricas de Web Vitals
   */
  getWebVitals(): Promise<Record<string, number>> {
    return new Promise((resolve) => {
      const vitals: Record<string, number> = {}

      // First Contentful Paint
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0]
      if (fcpEntry) {
        vitals.fcp = fcpEntry.startTime
      }

      // Largest Contentful Paint
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          if (lastEntry) {
            vitals.lcp = lastEntry.startTime
          }
        })
        observer.observe({ entryTypes: ['largest-contentful-paint'] })
      }

      // Cumulative Layout Shift
      if ('PerformanceObserver' in window) {
        let clsValue = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
          vitals.cls = clsValue
        })
        observer.observe({ entryTypes: ['layout-shift'] })
      }

      // First Input Delay
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            vitals.fid = (entry as any).processingStart - entry.startTime
          }
        })
        observer.observe({ entryTypes: ['first-input'] })
      }

      // Resolver después de un breve delay para capturar métricas
      setTimeout(() => resolve(vitals), 1000)
    })
  }

  /**
   * Limpiar métricas antiguas
   */
  clearOldMetrics(olderThan: Date) {
    this.metrics = this.metrics.filter(metric => metric.timestamp > olderThan)
    this.alerts = this.alerts.filter(alert => alert.timestamp > olderThan)
  }

  /**
   * Configurar thresholds personalizados
   */
  setThresholds(newThresholds: Partial<PerformanceThresholds>) {
    this.thresholds = { ...this.thresholds, ...newThresholds }
  }

  /**
   * Habilitar/deshabilitar monitoreo
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled
  }

  /**
   * Obtener estado del monitor
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      metricsCount: this.metrics.length,
      alertsCount: this.alerts.length,
      thresholds: this.thresholds,
      lastMetric: this.metrics[0] || null
    }
  }
}

// Instancia singleton
export const posPerformanceMonitor = new POSPerformanceMonitor()

// Funciones de conveniencia
export const measurePerformance = (name: string, context?: Record<string, any>) => {
  return posPerformanceMonitor.startMeasurement(name, context)
}

export const recordMetric = (name: string, value: number, context?: Record<string, any>) => {
  posPerformanceMonitor.recordMetric(name, value, context)
}

export const getPerformanceReport = (timeRange?: { start: Date; end: Date }) => {
  return posPerformanceMonitor.generateReport(timeRange)
}

export const getWebVitals = () => {
  return posPerformanceMonitor.getWebVitals()
}

// Wrappers para operaciones específicas del POS
export const measureCartOperation = async (operation: () => void | Promise<void>) => {
  const endMeasurement = measurePerformance('cart-operation')
  
  try {
    const result = operation()
    if (result instanceof Promise) {
      const promiseResult = await result
      endMeasurement()
      return promiseResult
    } else {
      endMeasurement()
      return result
    }
  } catch (error) {
    endMeasurement()
    throw error
  }
}

export const measureProductSearch = async (searchFn: () => Promise<any>) => {
  const endMeasurement = measurePerformance('product-search')
  
  try {
    const result = await searchFn()
    endMeasurement()
    return result
  } catch (error) {
    endMeasurement()
    throw error
  }
}

export const measureSaleProcessing = async (saleFn: () => Promise<any>) => {
  const endMeasurement = measurePerformance('sale-processing')
  
  try {
    const result = await saleFn()
    endMeasurement()
    return result
  } catch (error) {
    endMeasurement()
    throw error
  }
}

export const measureDatabaseQuery = async (queryFn: () => Promise<any>) => {
  const endMeasurement = measurePerformance('database-query')
  
  try {
    const result = await queryFn()
    endMeasurement()
    return result
  } catch (error) {
    endMeasurement()
    throw error
  }
}

// Configuración por defecto para producción
if (typeof window !== 'undefined') {
  // Limpiar métricas antiguas cada hora
  setInterval(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    posPerformanceMonitor.clearOldMetrics(oneHourAgo)
  }, 60 * 60 * 1000)
}
