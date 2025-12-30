import { SyncMetrics, SyncPerformanceMonitor } from './sync-performance-monitor'

export interface BottleneckAnalysis {
  type: 'latency' | 'throughput' | 'error_rate' | 'memory' | 'network' | 'database'
  severity: 'low' | 'medium' | 'high' | 'critical'
  component: string
  description: string
  impact: string
  metrics: {
    current: number
    baseline: number
    threshold: number
    unit: string
  }
  recommendations: string[]
  estimatedImprovement: string
  priority: number
}

export interface SystemBottlenecks {
  overall: {
    score: number // 0-100, donde 100 es óptimo
    status: 'optimal' | 'good' | 'degraded' | 'critical'
    primaryIssues: string[]
  }
  bottlenecks: BottleneckAnalysis[]
  trends: {
    improving: BottleneckAnalysis[]
    degrading: BottleneckAnalysis[]
    stable: BottleneckAnalysis[]
  }
  actionPlan: {
    immediate: BottleneckAnalysis[]
    shortTerm: BottleneckAnalysis[]
    longTerm: BottleneckAnalysis[]
  }
}

export interface PerformanceBaseline {
  operation: string
  expectedLatency: number
  expectedThroughput: number
  expectedErrorRate: number
  expectedMemoryUsage: number
  lastUpdated: Date
}

export class SyncBottleneckAnalyzer {
  private performanceMonitor: SyncPerformanceMonitor
  private baselines: Map<string, PerformanceBaseline> = new Map()

  constructor(performanceMonitor: SyncPerformanceMonitor) {
    this.performanceMonitor = performanceMonitor
    this.initializeBaselines()
  }

  private initializeBaselines(): void {
    // Establecer líneas base para diferentes operaciones
    this.baselines.set('product_sync', {
      operation: 'product_sync',
      expectedLatency: 200, // ms por registro
      expectedThroughput: 50, // registros por segundo
      expectedErrorRate: 2, // porcentaje
      expectedMemoryUsage: 10 * 1024 * 1024, // 10MB
      lastUpdated: new Date()
    })

    this.baselines.set('realtime_event', {
      operation: 'realtime_event',
      expectedLatency: 50, // ms por evento
      expectedThroughput: 100, // eventos por segundo
      expectedErrorRate: 1, // porcentaje
      expectedMemoryUsage: 1 * 1024 * 1024, // 1MB
      lastUpdated: new Date()
    })

    this.baselines.set('catalog_sync', {
      operation: 'catalog_sync',
      expectedLatency: 100, // ms por item
      expectedThroughput: 75, // items por segundo
      expectedErrorRate: 1.5, // porcentaje
      expectedMemoryUsage: 5 * 1024 * 1024, // 5MB
      lastUpdated: new Date()
    })

    this.baselines.set('supplier_sync', {
      operation: 'supplier_sync',
      expectedLatency: 500, // ms por proveedor
      expectedThroughput: 20, // proveedores por segundo
      expectedErrorRate: 5, // porcentaje (más alto debido a dependencias externas)
      expectedMemoryUsage: 15 * 1024 * 1024, // 15MB
      lastUpdated: new Date()
    })

    this.baselines.set('inventory_sync', {
      operation: 'inventory_sync',
      expectedLatency: 150, // ms por item
      expectedThroughput: 40, // items por segundo
      expectedErrorRate: 3, // porcentaje
      expectedMemoryUsage: 8 * 1024 * 1024, // 8MB
      lastUpdated: new Date()
    })
  }

  async analyzeBottlenecks(timeWindow: number = 3600000): Promise<SystemBottlenecks> {
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - timeWindow)
    
    const report = await this.performanceMonitor.generatePerformanceReport(startTime, endTime)
    const recentMetrics = this.performanceMonitor.getRecentMetrics(100)
    
    const bottlenecks = await this.identifyBottlenecks(recentMetrics)
    const trends = this.analyzeTrends(bottlenecks)
    const actionPlan = this.createActionPlan(bottlenecks)
    const overallScore = this.calculateOverallScore(bottlenecks)

    return {
      overall: {
        score: overallScore,
        status: this.getStatusFromScore(overallScore),
        primaryIssues: bottlenecks
          .filter(b => b.severity === 'critical' || b.severity === 'high')
          .slice(0, 3)
          .map(b => b.description)
      },
      bottlenecks,
      trends,
      actionPlan
    }
  }

  private async identifyBottlenecks(metrics: SyncMetrics[]): Promise<BottleneckAnalysis[]> {
    const bottlenecks: BottleneckAnalysis[] = []

    // Agrupar métricas por operación
    const operationGroups = this.groupMetricsByOperation(metrics)

    for (const [operation, operationMetrics] of operationGroups) {
      const baseline = this.baselines.get(operation)
      if (!baseline) continue

      // Analizar latencia
      const latencyBottleneck = this.analyzeLatency(operation, operationMetrics, baseline)
      if (latencyBottleneck) bottlenecks.push(latencyBottleneck)

      // Analizar throughput
      const throughputBottleneck = this.analyzeThroughput(operation, operationMetrics, baseline)
      if (throughputBottleneck) bottlenecks.push(throughputBottleneck)

      // Analizar tasa de errores
      const errorBottleneck = this.analyzeErrorRate(operation, operationMetrics, baseline)
      if (errorBottleneck) bottlenecks.push(errorBottleneck)

      // Analizar uso de memoria
      const memoryBottleneck = this.analyzeMemoryUsage(operation, operationMetrics, baseline)
      if (memoryBottleneck) bottlenecks.push(memoryBottleneck)
    }

    // Analizar cuellos de botella del sistema
    const systemBottlenecks = await this.analyzeSystemBottlenecks(metrics)
    bottlenecks.push(...systemBottlenecks)

    // Ordenar por prioridad
    return bottlenecks.sort((a, b) => b.priority - a.priority)
  }

  private groupMetricsByOperation(metrics: SyncMetrics[]): Map<string, SyncMetrics[]> {
    const groups = new Map<string, SyncMetrics[]>()
    
    metrics.forEach(metric => {
      if (!groups.has(metric.operation)) {
        groups.set(metric.operation, [])
      }
      groups.get(metric.operation)!.push(metric)
    })

    return groups
  }

  private analyzeLatency(
    operation: string, 
    metrics: SyncMetrics[], 
    baseline: PerformanceBaseline
  ): BottleneckAnalysis | null {
    if (metrics.length === 0) return null

    const averageLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length
    const p95Latency = this.calculatePercentile(metrics.map(m => m.latency), 95)
    
    const threshold = baseline.expectedLatency * 1.5 // 50% sobre la línea base
    
    if (averageLatency <= threshold) return null

    const severity = this.calculateSeverity(averageLatency, baseline.expectedLatency, threshold)
    
    return {
      type: 'latency',
      severity,
      component: operation,
      description: `Alta latencia en ${operation}`,
      impact: `Latencia promedio de ${averageLatency.toFixed(0)}ms excede el umbral de ${threshold.toFixed(0)}ms`,
      metrics: {
        current: averageLatency,
        baseline: baseline.expectedLatency,
        threshold,
        unit: 'ms'
      },
      recommendations: this.getLatencyRecommendations(operation, averageLatency, baseline.expectedLatency),
      estimatedImprovement: this.estimateLatencyImprovement(averageLatency, baseline.expectedLatency),
      priority: this.calculatePriority(severity, 'latency')
    }
  }

  private analyzeThroughput(
    operation: string, 
    metrics: SyncMetrics[], 
    baseline: PerformanceBaseline
  ): BottleneckAnalysis | null {
    if (metrics.length === 0) return null

    const averageThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length
    const threshold = baseline.expectedThroughput * 0.7 // 30% bajo la línea base
    
    if (averageThroughput >= threshold) return null

    const severity = this.calculateSeverity(baseline.expectedThroughput, averageThroughput, threshold)
    
    return {
      type: 'throughput',
      severity,
      component: operation,
      description: `Bajo throughput en ${operation}`,
      impact: `Throughput promedio de ${averageThroughput.toFixed(1)} records/sec está por debajo del umbral de ${threshold.toFixed(1)} records/sec`,
      metrics: {
        current: averageThroughput,
        baseline: baseline.expectedThroughput,
        threshold,
        unit: 'records/sec'
      },
      recommendations: this.getThroughputRecommendations(operation, averageThroughput, baseline.expectedThroughput),
      estimatedImprovement: this.estimateThroughputImprovement(averageThroughput, baseline.expectedThroughput),
      priority: this.calculatePriority(severity, 'throughput')
    }
  }

  private analyzeErrorRate(
    operation: string, 
    metrics: SyncMetrics[], 
    baseline: PerformanceBaseline
  ): BottleneckAnalysis | null {
    if (metrics.length === 0) return null

    const averageErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length
    const threshold = baseline.expectedErrorRate * 2 // Doble de la línea base
    
    if (averageErrorRate <= threshold) return null

    const severity = this.calculateSeverity(averageErrorRate, baseline.expectedErrorRate, threshold)
    
    return {
      type: 'error_rate',
      severity,
      component: operation,
      description: `Alta tasa de errores en ${operation}`,
      impact: `Tasa de errores promedio de ${averageErrorRate.toFixed(1)}% excede el umbral de ${threshold.toFixed(1)}%`,
      metrics: {
        current: averageErrorRate,
        baseline: baseline.expectedErrorRate,
        threshold,
        unit: '%'
      },
      recommendations: this.getErrorRateRecommendations(operation, averageErrorRate, baseline.expectedErrorRate),
      estimatedImprovement: this.estimateErrorRateImprovement(averageErrorRate, baseline.expectedErrorRate),
      priority: this.calculatePriority(severity, 'error_rate')
    }
  }

  private analyzeMemoryUsage(
    operation: string, 
    metrics: SyncMetrics[], 
    baseline: PerformanceBaseline
  ): BottleneckAnalysis | null {
    const metricsWithMemory = metrics.filter(m => m.memoryUsage !== undefined)
    if (metricsWithMemory.length === 0) return null

    const averageMemory = metricsWithMemory.reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / metricsWithMemory.length
    const threshold = baseline.expectedMemoryUsage * 2 // Doble de la línea base
    
    if (averageMemory <= threshold) return null

    const severity = this.calculateSeverity(averageMemory, baseline.expectedMemoryUsage, threshold)
    
    return {
      type: 'memory',
      severity,
      component: operation,
      description: `Alto uso de memoria en ${operation}`,
      impact: `Uso promedio de memoria de ${(averageMemory / 1024 / 1024).toFixed(1)}MB excede el umbral de ${(threshold / 1024 / 1024).toFixed(1)}MB`,
      metrics: {
        current: averageMemory,
        baseline: baseline.expectedMemoryUsage,
        threshold,
        unit: 'bytes'
      },
      recommendations: this.getMemoryRecommendations(operation, averageMemory, baseline.expectedMemoryUsage),
      estimatedImprovement: this.estimateMemoryImprovement(averageMemory, baseline.expectedMemoryUsage),
      priority: this.calculatePriority(severity, 'memory')
    }
  }

  private async analyzeSystemBottlenecks(metrics: SyncMetrics[]): Promise<BottleneckAnalysis[]> {
    const bottlenecks: BottleneckAnalysis[] = []

    // Analizar patrones de concurrencia
    const concurrencyBottleneck = this.analyzeConcurrencyPatterns(metrics)
    if (concurrencyBottleneck) bottlenecks.push(concurrencyBottleneck)

    // Analizar patrones de red
    const networkBottleneck = this.analyzeNetworkPatterns(metrics)
    if (networkBottleneck) bottlenecks.push(networkBottleneck)

    // Analizar patrones de base de datos
    const databaseBottleneck = await this.analyzeDatabasePatterns(metrics)
    if (databaseBottleneck) bottlenecks.push(databaseBottleneck)

    return bottlenecks
  }

  private analyzeConcurrencyPatterns(metrics: SyncMetrics[]): BottleneckAnalysis | null {
    // Analizar si hay operaciones concurrentes que se bloquean entre sí
    const timeWindows = this.groupMetricsByTimeWindow(metrics, 1000) // ventanas de 1 segundo
    
    let maxConcurrentOps = 0
    let avgConcurrentOps = 0
    let totalWindows = 0

    timeWindows.forEach(windowMetrics => {
      if (windowMetrics.length > maxConcurrentOps) {
        maxConcurrentOps = windowMetrics.length
      }
      avgConcurrentOps += windowMetrics.length
      totalWindows++
    })

    if (totalWindows > 0) {
      avgConcurrentOps /= totalWindows
    }

    // Si hay más de 10 operaciones concurrentes en promedio, puede ser un cuello de botella
    if (avgConcurrentOps <= 10) return null

    return {
      type: 'throughput',
      severity: maxConcurrentOps > 20 ? 'high' : 'medium',
      component: 'system_concurrency',
      description: 'Alto nivel de concurrencia detectado',
      impact: `Promedio de ${avgConcurrentOps.toFixed(1)} operaciones concurrentes puede causar contención de recursos`,
      metrics: {
        current: avgConcurrentOps,
        baseline: 5,
        threshold: 10,
        unit: 'operaciones concurrentes'
      },
      recommendations: [
        'Implementar cola de trabajos para limitar concurrencia',
        'Usar connection pooling para base de datos',
        'Implementar rate limiting en operaciones externas',
        'Considerar procesamiento asíncrono para operaciones pesadas'
      ],
      estimatedImprovement: 'Reducción del 30-50% en latencia promedio',
      priority: this.calculatePriority(maxConcurrentOps > 20 ? 'high' : 'medium', 'throughput')
    }
  }

  private analyzeNetworkPatterns(metrics: SyncMetrics[]): BottleneckAnalysis | null {
    const networkMetrics = metrics.filter(m => m.networkLatency !== undefined)
    if (networkMetrics.length === 0) return null

    const avgNetworkLatency = networkMetrics.reduce((sum, m) => sum + (m.networkLatency || 0), 0) / networkMetrics.length
    const threshold = 200 // 200ms es considerado alto para operaciones locales

    if (avgNetworkLatency <= threshold) return null

    return {
      type: 'network',
      severity: avgNetworkLatency > 500 ? 'high' : 'medium',
      component: 'network_connectivity',
      description: 'Alta latencia de red detectada',
      impact: `Latencia de red promedio de ${avgNetworkLatency.toFixed(0)}ms está afectando el rendimiento`,
      metrics: {
        current: avgNetworkLatency,
        baseline: 50,
        threshold,
        unit: 'ms'
      },
      recommendations: [
        'Verificar conectividad de red y ancho de banda',
        'Implementar caché local para reducir llamadas de red',
        'Usar CDN para recursos estáticos',
        'Optimizar tamaño de payloads en requests',
        'Implementar compresión de datos'
      ],
      estimatedImprovement: 'Reducción del 40-60% en latencia total',
      priority: this.calculatePriority(avgNetworkLatency > 500 ? 'high' : 'medium', 'network')
    }
  }

  private async analyzeDatabasePatterns(metrics: SyncMetrics[]): Promise<BottleneckAnalysis | null> {
    // Analizar patrones que sugieren problemas de base de datos
    const dbOperations = metrics.filter(m => 
      m.operation.includes('sync') && m.recordsProcessed > 0
    )

    if (dbOperations.length === 0) return null

    const avgRecordsPerOp = dbOperations.reduce((sum, m) => sum + m.recordsProcessed, 0) / dbOperations.length
    const avgDurationPerRecord = dbOperations.reduce((sum, m) => sum + (m.duration / m.recordsProcessed), 0) / dbOperations.length

    // Si toma más de 100ms por registro, puede indicar problemas de DB
    if (avgDurationPerRecord <= 100) return null

    return {
      type: 'database',
      severity: avgDurationPerRecord > 500 ? 'high' : 'medium',
      component: 'database_performance',
      description: 'Rendimiento de base de datos degradado',
      impact: `Tiempo promedio de ${avgDurationPerRecord.toFixed(0)}ms por registro indica posibles problemas de DB`,
      metrics: {
        current: avgDurationPerRecord,
        baseline: 50,
        threshold: 100,
        unit: 'ms/record'
      },
      recommendations: [
        'Revisar y optimizar consultas SQL',
        'Agregar índices faltantes en tablas frecuentemente consultadas',
        'Implementar paginación para consultas grandes',
        'Usar prepared statements para consultas repetitivas',
        'Considerar particionado de tablas grandes',
        'Revisar configuración de connection pool'
      ],
      estimatedImprovement: 'Reducción del 50-70% en tiempo de procesamiento',
      priority: this.calculatePriority(avgDurationPerRecord > 500 ? 'high' : 'medium', 'database')
    }
  }

  private groupMetricsByTimeWindow(metrics: SyncMetrics[], windowMs: number): SyncMetrics[][] {
    const windows = new Map<number, SyncMetrics[]>()
    
    metrics.forEach(metric => {
      const windowStart = Math.floor(metric.startTime / windowMs) * windowMs
      if (!windows.has(windowStart)) {
        windows.set(windowStart, [])
      }
      windows.get(windowStart)!.push(metric)
    })

    return Array.from(windows.values())
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }

  private calculateSeverity(current: number, baseline: number, threshold: number): BottleneckAnalysis['severity'] {
    const ratio = current / baseline
    
    if (ratio >= 3) return 'critical'
    if (ratio >= 2) return 'high'
    if (ratio >= 1.5) return 'medium'
    return 'low'
  }

  private calculatePriority(severity: BottleneckAnalysis['severity'], type: BottleneckAnalysis['type']): number {
    const severityWeight = {
      'critical': 100,
      'high': 75,
      'medium': 50,
      'low': 25
    }

    const typeWeight = {
      'error_rate': 1.2,
      'latency': 1.1,
      'database': 1.1,
      'throughput': 1.0,
      'network': 0.9,
      'memory': 0.8
    }

    return severityWeight[severity] * typeWeight[type]
  }

  private getLatencyRecommendations(operation: string, current: number, baseline: number): string[] {
    const recommendations = []
    
    if (current > baseline * 3) {
      recommendations.push('Revisar algoritmos y estructuras de datos utilizadas')
      recommendations.push('Implementar caché para operaciones repetitivas')
    }
    
    if (operation.includes('sync')) {
      recommendations.push('Implementar procesamiento en lotes para reducir overhead')
      recommendations.push('Usar índices apropiados en consultas de base de datos')
    }
    
    if (operation.includes('realtime')) {
      recommendations.push('Optimizar manejo de eventos WebSocket')
      recommendations.push('Implementar debouncing para eventos frecuentes')
    }

    recommendations.push('Perfilar código para identificar operaciones costosas')
    
    return recommendations
  }

  private getThroughputRecommendations(operation: string, current: number, baseline: number): string[] {
    return [
      'Implementar procesamiento paralelo donde sea posible',
      'Optimizar consultas de base de datos',
      'Usar connection pooling',
      'Implementar paginación para datasets grandes',
      'Considerar procesamiento asíncrono',
      'Revisar y optimizar serialización/deserialización de datos'
    ]
  }

  private getErrorRateRecommendations(operation: string, current: number, baseline: number): string[] {
    return [
      'Implementar retry logic con backoff exponencial',
      'Mejorar validación de datos de entrada',
      'Agregar manejo de errores más robusto',
      'Implementar circuit breaker para servicios externos',
      'Revisar logs para identificar patrones de errores',
      'Agregar monitoreo de salud de dependencias externas'
    ]
  }

  private getMemoryRecommendations(operation: string, current: number, baseline: number): string[] {
    return [
      'Implementar streaming para datasets grandes',
      'Revisar y optimizar estructuras de datos en memoria',
      'Implementar garbage collection más frecuente',
      'Usar lazy loading para datos no críticos',
      'Implementar paginación en lugar de cargar todo en memoria',
      'Revisar posibles memory leaks'
    ]
  }

  private estimateLatencyImprovement(current: number, baseline: number): string {
    const improvement = ((current - baseline) / current) * 100
    return `Reducción estimada del ${improvement.toFixed(0)}% en latencia`
  }

  private estimateThroughputImprovement(current: number, baseline: number): string {
    const improvement = ((baseline - current) / current) * 100
    return `Incremento estimado del ${improvement.toFixed(0)}% en throughput`
  }

  private estimateErrorRateImprovement(current: number, baseline: number): string {
    const improvement = ((current - baseline) / current) * 100
    return `Reducción estimada del ${improvement.toFixed(0)}% en tasa de errores`
  }

  private estimateMemoryImprovement(current: number, baseline: number): string {
    const improvement = ((current - baseline) / current) * 100
    return `Reducción estimada del ${improvement.toFixed(0)}% en uso de memoria`
  }

  private analyzeTrends(bottlenecks: BottleneckAnalysis[]): SystemBottlenecks['trends'] {
    // Para simplificar, clasificamos basado en severidad
    // En una implementación real, compararíamos con datos históricos
    return {
      improving: bottlenecks.filter(b => b.severity === 'low'),
      degrading: bottlenecks.filter(b => b.severity === 'critical' || b.severity === 'high'),
      stable: bottlenecks.filter(b => b.severity === 'medium')
    }
  }

  private createActionPlan(bottlenecks: BottleneckAnalysis[]): SystemBottlenecks['actionPlan'] {
    const sortedBottlenecks = bottlenecks.sort((a, b) => b.priority - a.priority)
    
    return {
      immediate: sortedBottlenecks.filter(b => b.severity === 'critical').slice(0, 3),
      shortTerm: sortedBottlenecks.filter(b => b.severity === 'high').slice(0, 5),
      longTerm: sortedBottlenecks.filter(b => b.severity === 'medium' || b.severity === 'low').slice(0, 7)
    }
  }

  private calculateOverallScore(bottlenecks: BottleneckAnalysis[]): number {
    if (bottlenecks.length === 0) return 100

    const severityPenalties = {
      'critical': 30,
      'high': 20,
      'medium': 10,
      'low': 5
    }

    let totalPenalty = 0
    bottlenecks.forEach(bottleneck => {
      totalPenalty += severityPenalties[bottleneck.severity]
    })

    return Math.max(0, 100 - totalPenalty)
  }

  private getStatusFromScore(score: number): SystemBottlenecks['overall']['status'] {
    if (score >= 90) return 'optimal'
    if (score >= 70) return 'good'
    if (score >= 50) return 'degraded'
    return 'critical'
  }

  async updateBaseline(operation: string, metrics: SyncMetrics[]): Promise<void> {
    if (metrics.length < 10) return // Necesitamos suficientes datos

    const avgLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length
    const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length
    const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length
    const metricsWithMemory = metrics.filter(m => m.memoryUsage !== undefined)
    const avgMemory = metricsWithMemory.length > 0 
      ? metricsWithMemory.reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / metricsWithMemory.length
      : 0

    this.baselines.set(operation, {
      operation,
      expectedLatency: avgLatency,
      expectedThroughput: avgThroughput,
      expectedErrorRate: avgErrorRate,
      expectedMemoryUsage: avgMemory,
      lastUpdated: new Date()
    })
  }

  getBaselines(): PerformanceBaseline[] {
    return Array.from(this.baselines.values())
  }
}

// Crear instancia singleton para exportar
import { syncPerformanceMonitor } from './sync-performance-monitor'
export const syncBottleneckAnalyzer = new SyncBottleneckAnalyzer(syncPerformanceMonitor)