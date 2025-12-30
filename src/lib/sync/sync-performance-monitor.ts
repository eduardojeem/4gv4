import { createClient } from '@/lib/supabase/client'

export interface SyncMetrics {
  id: string
  operation: 'product_sync' | 'realtime_event' | 'catalog_sync' | 'supplier_sync' | 'inventory_sync'
  startTime: number
  endTime: number
  duration: number
  recordsProcessed: number
  recordsSuccess: number
  recordsError: number
  errorRate: number
  throughput: number // records per second
  latency: number
  memoryUsage?: number
  cpuUsage?: number
  networkLatency?: number
  status: 'success' | 'partial' | 'failed'
  errors: string[]
  metadata: Record<string, any>
  timestamp: Date
}

export interface SyncPerformanceReport {
  period: {
    start: Date
    end: Date
  }
  summary: {
    totalOperations: number
    successRate: number
    averageDuration: number
    averageThroughput: number
    averageLatency: number
    totalRecordsProcessed: number
    totalErrors: number
  }
  operationBreakdown: Record<string, {
    count: number
    successRate: number
    averageDuration: number
    averageThroughput: number
    errorCount: number
  }>
  bottlenecks: {
    slowestOperations: SyncMetrics[]
    highestErrorRates: SyncMetrics[]
    lowestThroughput: SyncMetrics[]
  }
  trends: {
    durationTrend: Array<{ timestamp: Date; value: number }>
    throughputTrend: Array<{ timestamp: Date; value: number }>
    errorRateTrend: Array<{ timestamp: Date; value: number }>
  }
  recommendations: string[]
}

export interface SyncHealthCheck {
  component: string
  status: 'healthy' | 'warning' | 'critical'
  latency: number
  lastSync: Date | null
  errorCount: number
  message: string
  details: Record<string, any>
}

export class SyncPerformanceMonitor {
  private supabase = createClient()
  private metrics: SyncMetrics[] = []
  private isMonitoring = false
  private monitoringInterval?: NodeJS.Timeout
  private performanceObserver?: PerformanceObserver

  async initialize(): Promise<void> {
    await this.createTables()
    this.setupPerformanceObserver()
  }

  private async createTables(): Promise<void> {
    // Crear tabla para métricas de sincronización
    await this.supabase.rpc('create_sync_metrics_table', {})
  }

  private setupPerformanceObserver(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach(entry => {
          if (entry.name.includes('sync')) {
            this.recordNavigationMetric(entry)
          }
        })
      })
      
      this.performanceObserver.observe({ entryTypes: ['measure', 'navigation'] })
    }
  }

  private recordNavigationMetric(entry: PerformanceEntry): void {
    // Registrar métricas de navegación relacionadas con sincronización
    console.log('Performance entry:', entry)
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return

    this.isMonitoring = true
    
    // Monitoreo continuo cada 30 segundos
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks()
      await this.cleanupOldMetrics()
    }, 30000)

    console.log('Sync performance monitoring started')
  }

  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }

    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
    }

    console.log('Sync performance monitoring stopped')
  }

  async recordSyncOperation(
    operation: SyncMetrics['operation'],
    startTime: number,
    endTime: number,
    recordsProcessed: number,
    recordsSuccess: number,
    errors: string[] = [],
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const duration = endTime - startTime
    const recordsError = recordsProcessed - recordsSuccess
    const errorRate = recordsProcessed > 0 ? (recordsError / recordsProcessed) * 100 : 0
    const throughput = duration > 0 ? recordsProcessed / (duration / 1000) : 0
    const latency = duration / Math.max(recordsProcessed, 1)

    const metric: SyncMetrics = {
      id: `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation,
      startTime,
      endTime,
      duration,
      recordsProcessed,
      recordsSuccess,
      recordsError,
      errorRate,
      throughput,
      latency,
      status: recordsError === 0 ? 'success' : recordsError < recordsProcessed ? 'partial' : 'failed',
      errors,
      metadata,
      timestamp: new Date()
    }

    // Agregar métricas del sistema si están disponibles
    if (typeof window !== 'undefined' && 'performance' in window) {
      const memory = (performance as any).memory
      if (memory) {
        metric.memoryUsage = memory.usedJSHeapSize
      }
    }

    this.metrics.push(metric)
    await this.saveMetric(metric)
  }

  private async saveMetric(metric: SyncMetrics): Promise<void> {
    try {
      await this.supabase
        .from('sync_metrics')
        .insert([{
          operation: metric.operation,
          start_time: new Date(metric.startTime),
          end_time: new Date(metric.endTime),
          duration: metric.duration,
          records_processed: metric.recordsProcessed,
          records_success: metric.recordsSuccess,
          records_error: metric.recordsError,
          error_rate: metric.errorRate,
          throughput: metric.throughput,
          latency: metric.latency,
          memory_usage: metric.memoryUsage,
          cpu_usage: metric.cpuUsage,
          network_latency: metric.networkLatency,
          status: metric.status,
          errors: metric.errors,
          metadata: metric.metadata,
          timestamp: metric.timestamp
        }])
    } catch (error) {
      console.error('Error saving sync metric:', error)
    }
  }

  async performHealthChecks(): Promise<SyncHealthCheck[]> {
    const healthChecks: SyncHealthCheck[] = []

    // Verificar conexión a Supabase
    const supabaseHealth = await this.checkSupabaseHealth()
    healthChecks.push(supabaseHealth)

    // Verificar sincronización de productos
    const productSyncHealth = await this.checkProductSyncHealth()
    healthChecks.push(productSyncHealth)

    // Verificar tiempo real
    const realtimeHealth = await this.checkRealtimeHealth()
    healthChecks.push(realtimeHealth)

    // Verificar integraciones externas
    const integrationHealth = await this.checkIntegrationHealth()
    healthChecks.push(integrationHealth)

    return healthChecks
  }

  private async checkSupabaseHealth(): Promise<SyncHealthCheck> {
    const startTime = performance.now()
    
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('id')
        .limit(1)

      const latency = performance.now() - startTime

      if (error) {
        return {
          component: 'supabase',
          status: 'critical',
          latency,
          lastSync: null,
          errorCount: 1,
          message: `Supabase connection failed: ${error.message}`,
          details: { error: error.message }
        }
      }

      return {
        component: 'supabase',
        status: latency > 1000 ? 'warning' : 'healthy',
        latency,
        lastSync: new Date(),
        errorCount: 0,
        message: latency > 1000 ? 'High latency detected' : 'Connection healthy',
        details: { responseTime: latency }
      }
    } catch (error) {
      return {
        component: 'supabase',
        status: 'critical',
        latency: performance.now() - startTime,
        lastSync: null,
        errorCount: 1,
        message: `Connection error: ${error}`,
        details: { error: String(error) }
      }
    }
  }

  private async checkProductSyncHealth(): Promise<SyncHealthCheck> {
    // Verificar la última sincronización de productos
    const recentMetrics = this.metrics
      .filter(m => m.operation === 'product_sync')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5)

    if (recentMetrics.length === 0) {
      return {
        component: 'product_sync',
        status: 'warning',
        latency: 0,
        lastSync: null,
        errorCount: 0,
        message: 'No recent product sync operations',
        details: {}
      }
    }

    const lastSync = recentMetrics[0]
    const averageErrorRate = recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length
    const averageLatency = recentMetrics.reduce((sum, m) => sum + m.latency, 0) / recentMetrics.length

    let status: SyncHealthCheck['status'] = 'healthy'
    let message = 'Product sync operating normally'

    if (averageErrorRate > 10) {
      status = 'critical'
      message = `High error rate: ${averageErrorRate.toFixed(1)}%`
    } else if (averageErrorRate > 5 || averageLatency > 500) {
      status = 'warning'
      message = `Performance degraded - Error rate: ${averageErrorRate.toFixed(1)}%, Latency: ${averageLatency.toFixed(0)}ms`
    }

    return {
      component: 'product_sync',
      status,
      latency: averageLatency,
      lastSync: lastSync.timestamp,
      errorCount: recentMetrics.reduce((sum, m) => sum + m.recordsError, 0),
      message,
      details: {
        averageErrorRate,
        averageLatency,
        recentOperations: recentMetrics.length
      }
    }
  }

  private async checkRealtimeHealth(): Promise<SyncHealthCheck> {
    // Verificar eventos de tiempo real
    const recentRealtime = this.metrics
      .filter(m => m.operation === 'realtime_event')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10)

    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    const recentEvents = recentRealtime.filter(m => m.timestamp > fiveMinutesAgo)

    let status: SyncHealthCheck['status'] = 'healthy'
    let message = 'Real-time sync active'

    if (recentEvents.length === 0) {
      status = 'warning'
      message = 'No recent real-time events'
    }

    const averageLatency = recentEvents.length > 0 
      ? recentEvents.reduce((sum, m) => sum + m.latency, 0) / recentEvents.length 
      : 0

    return {
      component: 'realtime',
      status,
      latency: averageLatency,
      lastSync: recentEvents.length > 0 ? recentEvents[0].timestamp : null,
      errorCount: recentEvents.reduce((sum, m) => sum + m.recordsError, 0),
      message,
      details: {
        recentEvents: recentEvents.length,
        averageLatency
      }
    }
  }

  private async checkIntegrationHealth(): Promise<SyncHealthCheck> {
    // Verificar integraciones externas
    const recentIntegrations = this.metrics
      .filter(m => m.operation === 'supplier_sync')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5)

    if (recentIntegrations.length === 0) {
      return {
        component: 'integrations',
        status: 'warning',
        latency: 0,
        lastSync: null,
        errorCount: 0,
        message: 'No recent integration sync operations',
        details: {}
      }
    }

    const averageErrorRate = recentIntegrations.reduce((sum, m) => sum + m.errorRate, 0) / recentIntegrations.length
    const averageLatency = recentIntegrations.reduce((sum, m) => sum + m.latency, 0) / recentIntegrations.length

    let status: SyncHealthCheck['status'] = 'healthy'
    let message = 'Integrations operating normally'

    if (averageErrorRate > 15) {
      status = 'critical'
      message = `Integration failures: ${averageErrorRate.toFixed(1)}% error rate`
    } else if (averageErrorRate > 8) {
      status = 'warning'
      message = `Integration issues detected: ${averageErrorRate.toFixed(1)}% error rate`
    }

    return {
      component: 'integrations',
      status,
      latency: averageLatency,
      lastSync: recentIntegrations[0].timestamp,
      errorCount: recentIntegrations.reduce((sum, m) => sum + m.recordsError, 0),
      message,
      details: {
        averageErrorRate,
        averageLatency,
        activeIntegrations: recentIntegrations.length
      }
    }
  }

  async generatePerformanceReport(startDate: Date, endDate: Date): Promise<SyncPerformanceReport> {
    const metrics = await this.getMetricsInRange(startDate, endDate)
    
    if (metrics.length === 0) {
      return this.createEmptyReport(startDate, endDate)
    }

    const summary = this.calculateSummary(metrics)
    const operationBreakdown = this.calculateOperationBreakdown(metrics)
    const bottlenecks = this.identifyBottlenecks(metrics)
    const trends = this.calculateTrends(metrics)
    const recommendations = this.generateRecommendations(summary, bottlenecks)

    return {
      period: { start: startDate, end: endDate },
      summary,
      operationBreakdown,
      bottlenecks,
      trends,
      recommendations
    }
  }

  private async getMetricsInRange(startDate: Date, endDate: Date): Promise<SyncMetrics[]> {
    try {
      const { data, error } = await this.supabase
        .from('sync_metrics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true })

      if (error) throw error

      return (data || []).map(row => ({
        id: row.id,
        operation: row.operation,
        startTime: new Date(row.start_time).getTime(),
        endTime: new Date(row.end_time).getTime(),
        duration: row.duration,
        recordsProcessed: row.records_processed,
        recordsSuccess: row.records_success,
        recordsError: row.records_error,
        errorRate: row.error_rate,
        throughput: row.throughput,
        latency: row.latency,
        memoryUsage: row.memory_usage,
        cpuUsage: row.cpu_usage,
        networkLatency: row.network_latency,
        status: row.status,
        errors: row.errors || [],
        metadata: row.metadata || {},
        timestamp: new Date(row.timestamp)
      }))
    } catch (error) {
      console.error('Error fetching metrics:', error)
      return this.metrics.filter(m => 
        m.timestamp >= startDate && m.timestamp <= endDate
      )
    }
  }

  private calculateSummary(metrics: SyncMetrics[]) {
    const totalOperations = metrics.length
    const successfulOperations = metrics.filter(m => m.status === 'success').length
    const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0
    const averageDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations
    const averageThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / totalOperations
    const averageLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / totalOperations
    const totalRecordsProcessed = metrics.reduce((sum, m) => sum + m.recordsProcessed, 0)
    const totalErrors = metrics.reduce((sum, m) => sum + m.recordsError, 0)

    return {
      totalOperations,
      successRate,
      averageDuration,
      averageThroughput,
      averageLatency,
      totalRecordsProcessed,
      totalErrors
    }
  }

  private calculateOperationBreakdown(metrics: SyncMetrics[]) {
    const breakdown: Record<string, any> = {}

    const operations = [...new Set(metrics.map(m => m.operation))]
    
    operations.forEach(operation => {
      const operationMetrics = metrics.filter(m => m.operation === operation)
      const count = operationMetrics.length
      const successCount = operationMetrics.filter(m => m.status === 'success').length
      const successRate = count > 0 ? (successCount / count) * 100 : 0
      const averageDuration = operationMetrics.reduce((sum, m) => sum + m.duration, 0) / count
      const averageThroughput = operationMetrics.reduce((sum, m) => sum + m.throughput, 0) / count
      const errorCount = operationMetrics.reduce((sum, m) => sum + m.recordsError, 0)

      breakdown[operation] = {
        count,
        successRate,
        averageDuration,
        averageThroughput,
        errorCount
      }
    })

    return breakdown
  }

  private identifyBottlenecks(metrics: SyncMetrics[]) {
    const sortedByDuration = [...metrics].sort((a, b) => b.duration - a.duration)
    const sortedByErrorRate = [...metrics].sort((a, b) => b.errorRate - a.errorRate)
    const sortedByThroughput = [...metrics].sort((a, b) => a.throughput - b.throughput)

    return {
      slowestOperations: sortedByDuration.slice(0, 5),
      highestErrorRates: sortedByErrorRate.slice(0, 5),
      lowestThroughput: sortedByThroughput.slice(0, 5)
    }
  }

  private calculateTrends(metrics: SyncMetrics[]) {
    const hourlyBuckets = new Map<string, SyncMetrics[]>()
    
    metrics.forEach(metric => {
      const hour = new Date(metric.timestamp)
      hour.setMinutes(0, 0, 0)
      const key = hour.toISOString()
      
      if (!hourlyBuckets.has(key)) {
        hourlyBuckets.set(key, [])
      }
      hourlyBuckets.get(key)!.push(metric)
    })

    const durationTrend: Array<{ timestamp: Date; value: number }> = []
    const throughputTrend: Array<{ timestamp: Date; value: number }> = []
    const errorRateTrend: Array<{ timestamp: Date; value: number }> = []

    hourlyBuckets.forEach((bucketMetrics, timeKey) => {
      const timestamp = new Date(timeKey)
      const avgDuration = bucketMetrics.reduce((sum, m) => sum + m.duration, 0) / bucketMetrics.length
      const avgThroughput = bucketMetrics.reduce((sum, m) => sum + m.throughput, 0) / bucketMetrics.length
      const avgErrorRate = bucketMetrics.reduce((sum, m) => sum + m.errorRate, 0) / bucketMetrics.length

      durationTrend.push({ timestamp, value: avgDuration })
      throughputTrend.push({ timestamp, value: avgThroughput })
      errorRateTrend.push({ timestamp, value: avgErrorRate })
    })

    return {
      durationTrend: durationTrend.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
      throughputTrend: throughputTrend.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
      errorRateTrend: errorRateTrend.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    }
  }

  private generateRecommendations(
    summary: SyncPerformanceReport['summary'],
    bottlenecks: SyncPerformanceReport['bottlenecks']
  ): string[] {
    const recommendations: string[] = []

    if (summary.successRate < 95) {
      recommendations.push(`Tasa de éxito baja (${summary.successRate.toFixed(1)}%). Revisar manejo de errores y reintentos.`)
    }

    if (summary.averageDuration > 5000) {
      recommendations.push(`Duración promedio alta (${summary.averageDuration.toFixed(0)}ms). Considerar optimización de consultas.`)
    }

    if (summary.averageThroughput < 10) {
      recommendations.push(`Throughput bajo (${summary.averageThroughput.toFixed(1)} records/sec). Implementar procesamiento en lotes.`)
    }

    if (bottlenecks.slowestOperations.length > 0) {
      const slowest = bottlenecks.slowestOperations[0]
      recommendations.push(`Operación más lenta: ${slowest.operation} (${slowest.duration}ms). Priorizar optimización.`)
    }

    if (bottlenecks.highestErrorRates.length > 0) {
      const errorProne = bottlenecks.highestErrorRates[0]
      if (errorProne.errorRate > 5) {
        recommendations.push(`Alta tasa de errores en ${errorProne.operation} (${errorProne.errorRate.toFixed(1)}%). Revisar validaciones.`)
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Sistema funcionando dentro de parámetros normales.')
    }

    return recommendations
  }

  private createEmptyReport(startDate: Date, endDate: Date): SyncPerformanceReport {
    return {
      period: { start: startDate, end: endDate },
      summary: {
        totalOperations: 0,
        successRate: 0,
        averageDuration: 0,
        averageThroughput: 0,
        averageLatency: 0,
        totalRecordsProcessed: 0,
        totalErrors: 0
      },
      operationBreakdown: {},
      bottlenecks: {
        slowestOperations: [],
        highestErrorRates: [],
        lowestThroughput: []
      },
      trends: {
        durationTrend: [],
        throughputTrend: [],
        errorRateTrend: []
      },
      recommendations: ['No hay datos suficientes para generar recomendaciones.']
    }
  }

  private async cleanupOldMetrics(): Promise<void> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    try {
      await this.supabase
        .from('sync_metrics')
        .delete()
        .lt('timestamp', thirtyDaysAgo.toISOString())
    } catch (error) {
      console.error('Error cleaning up old metrics:', error)
    }

    // Limpiar métricas en memoria
    this.metrics = this.metrics.filter(m => m.timestamp > thirtyDaysAgo)
  }

  // Métodos de utilidad para instrumentar código existente
  async measureSyncOperation<T>(
    operation: SyncMetrics['operation'],
    fn: () => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    const startTime = performance.now()
    let recordsProcessed = 0
    let recordsSuccess = 0
    const errors: string[] = []

    try {
      const result = await fn()
      
      // Intentar extraer métricas del resultado si es posible
      if (typeof result === 'object' && result !== null) {
        const resultObj = result as any
        recordsProcessed = resultObj.recordsProcessed || resultObj.length || 1
        recordsSuccess = resultObj.recordsSuccess || resultObj.length || 1
      } else {
        recordsProcessed = 1
        recordsSuccess = 1
      }

      await this.recordSyncOperation(
        operation,
        startTime,
        performance.now(),
        recordsProcessed,
        recordsSuccess,
        errors,
        metadata
      )

      return result
    } catch (error) {
      errors.push(String(error))
      recordsProcessed = 1
      recordsSuccess = 0

      await this.recordSyncOperation(
        operation,
        startTime,
        performance.now(),
        recordsProcessed,
        recordsSuccess,
        errors,
        metadata
      )

      throw error
    }
  }

  getRecentMetrics(limit: number = 50): SyncMetrics[] {
    return this.metrics
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  getCurrentStatus(): {
    isMonitoring: boolean
    totalMetrics: number
    recentErrors: number
    averageLatency: number
  } {
    const recentMetrics = this.getRecentMetrics(10)
    const recentErrors = recentMetrics.reduce((sum, m) => sum + m.recordsError, 0)
    const averageLatency = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.latency, 0) / recentMetrics.length
      : 0

    return {
      isMonitoring: this.isMonitoring,
      totalMetrics: this.metrics.length,
      recentErrors,
      averageLatency
    }
  }
}

export const syncPerformanceMonitor = new SyncPerformanceMonitor()