/**
 * Sistema de Monitoreo de Performance
 * 
 * Proporciona funciones para medir y trackear métricas de rendimiento
 * en la aplicación.
 */

import { logger } from '@/lib/logging'

export interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'count' | 'bytes'
  timestamp: number
  metadata?: Record<string, unknown>
}

class PerformanceTracker {
  private metrics: PerformanceMetric[] = []
  private timers: Map<string, number> = new Map()
  private renderCounts: Map<string, number> = new Map()
  private enabled: boolean = process.env.NODE_ENV === 'development'

  /**
   * Inicia un timer para medir duración
   */
  startTimer(name: string): void {
    if (!this.enabled) return
    this.timers.set(name, performance.now())
  }

  /**
   * Finaliza un timer y registra la métrica
   */
  endTimer(name: string, metadata?: Record<string, unknown>): number | null {
    if (!this.enabled) return null

    const startTime = this.timers.get(name)
    if (!startTime) {
      logger.warn(`Timer "${name}" no fue iniciado`)
      return null
    }

    const duration = performance.now() - startTime
    this.timers.delete(name)

    this.trackMetric({
      name,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      metadata
    })

    return duration
  }

  /**
   * Mide la duración de una función
   */
  async measure<T>(
    name: string,
    fn: () => T | Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    if (!this.enabled) return fn()

    this.startTimer(name)
    try {
      const result = await fn()
      const duration = this.endTimer(name, metadata)
      
      if (duration !== null && duration > 100) {
        logger.warn(`Operación lenta detectada: ${name} tomó ${duration.toFixed(2)}ms`, {
          duration,
          metadata
        })
      }

      return result
    } catch (error) {
      this.endTimer(name, { ...metadata, error: true })
      throw error
    }
  }

  /**
   * Registra una métrica personalizada
   */
  trackMetric(metric: PerformanceMetric): void {
    if (!this.enabled) return

    this.metrics.push(metric)

    // Mantener solo las últimas 100 métricas
    if (this.metrics.length > 100) {
      this.metrics.shift()
    }

    // Log en desarrollo
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`📊 Métrica: ${metric.name}`, {
        value: metric.value,
        unit: metric.unit,
        metadata: metric.metadata
      })
    }
  }

  /**
   * Incrementa contador de renders de un componente
   */
  trackRender(componentName: string): void {
    if (!this.enabled) return

    const count = (this.renderCounts.get(componentName) || 0) + 1
    this.renderCounts.set(componentName, count)

    // Advertir si hay muchos re-renders
    if (count > 50 && count % 10 === 0) {
      logger.warn(`⚠️ Componente con muchos re-renders: ${componentName} (${count} renders)`)
    }
  }

  /**
   * Obtiene el conteo de renders de un componente
   */
  getRenderCount(componentName: string): number {
    return this.renderCounts.get(componentName) || 0
  }

  /**
   * Resetea el conteo de renders de un componente
   */
  resetRenderCount(componentName: string): void {
    this.renderCounts.delete(componentName)
  }

  /**
   * Obtiene todas las métricas registradas
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  /**
   * Obtiene métricas filtradas por nombre
   */
  getMetricsByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.name === name)
  }

  /**
   * Calcula estadísticas de una métrica
   */
  getStats(name: string): {
    count: number
    avg: number
    min: number
    max: number
    total: number
  } | null {
    const metrics = this.getMetricsByName(name)
    if (metrics.length === 0) return null

    const values = metrics.map(m => m.value)
    const total = values.reduce((sum, v) => sum + v, 0)

    return {
      count: metrics.length,
      avg: total / metrics.length,
      min: Math.min(...values),
      max: Math.max(...values),
      total
    }
  }

  /**
   * Limpia todas las métricas
   */
  clear(): void {
    this.metrics = []
    this.timers.clear()
    this.renderCounts.clear()
  }

  /**
   * Genera reporte de performance
   */
  generateReport(): string {
    const lines: string[] = [
      '=== Performance Report ===',
      '',
      'Métricas de Tiempo:',
    ]

    // Agrupar métricas por nombre
    const metricsByName = new Map<string, PerformanceMetric[]>()
    this.metrics.forEach(m => {
      const existing = metricsByName.get(m.name) || []
      existing.push(m)
      metricsByName.set(m.name, existing)
    })

    // Estadísticas por métrica
    metricsByName.forEach((metrics, name) => {
      const stats = this.getStats(name)
      if (stats) {
        lines.push(
          `  ${name}:`,
          `    Count: ${stats.count}`,
          `    Avg: ${stats.avg.toFixed(2)}ms`,
          `    Min: ${stats.min.toFixed(2)}ms`,
          `    Max: ${stats.max.toFixed(2)}ms`,
          ''
        )
      }
    })

    // Conteo de renders
    if (this.renderCounts.size > 0) {
      lines.push('Conteo de Renders:')
      this.renderCounts.forEach((count, component) => {
        lines.push(`  ${component}: ${count} renders`)
      })
    }

    return lines.join('\n')
  }

  /**
   * Habilita o deshabilita el tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Verifica si el tracking está habilitado
   */
  isEnabled(): boolean {
    return this.enabled
  }
}

// Instancia singleton
export const performanceTracker = new PerformanceTracker()

// Helpers para uso común
export const trackMetric = (metric: PerformanceMetric) => 
  performanceTracker.trackMetric(metric)

export const startTimer = (name: string) => 
  performanceTracker.startTimer(name)

export const endTimer = (name: string, metadata?: Record<string, unknown>) => 
  performanceTracker.endTimer(name, metadata)

export const measure = <T>(
  name: string,
  fn: () => T | Promise<T>,
  metadata?: Record<string, unknown>
) => performanceTracker.measure(name, fn, metadata)

export const trackRender = (componentName: string) => 
  performanceTracker.trackRender(componentName)

export const getRenderCount = (componentName: string) => 
  performanceTracker.getRenderCount(componentName)

export const getPerformanceReport = () => 
  performanceTracker.generateReport()

// Exponer en window para debugging en desarrollo
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as Window & { __performanceTracker?: unknown }).__performanceTracker = performanceTracker
}
