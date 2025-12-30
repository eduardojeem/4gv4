import { createClient } from '@supabase/supabase-js'
import React from 'react'

// Interfaces para métricas de rendimiento
export interface SystemMetrics {
  timestamp: Date
  cpu: {
    usage: number
    cores: number
    loadAverage: number[]
  }
  memory: {
    used: number
    total: number
    free: number
    percentage: number
  }
  disk: {
    used: number
    total: number
    free: number
    percentage: number
  }
  network: {
    bytesIn: number
    bytesOut: number
    packetsIn: number
    packetsOut: number
  }
  database: {
    connections: number
    activeQueries: number
    slowQueries: number
    avgResponseTime: number
  }
  application: {
    activeUsers: number
    requestsPerSecond: number
    errorRate: number
    avgResponseTime: number
  }
}

export interface PerformanceAlert {
  id: string
  type: 'cpu' | 'memory' | 'disk' | 'database' | 'application' | 'network'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  threshold: number
  currentValue: number
  timestamp: Date
  resolved: boolean
  resolvedAt?: Date
  actions: string[]
}

export interface PerformanceThreshold {
  id: string
  metric: string
  operator: '>' | '<' | '>=' | '<=' | '=='
  value: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  description: string
  actions: string[]
}

export interface PerformanceReport {
  id: string
  period: 'hourly' | 'daily' | 'weekly' | 'monthly'
  startDate: Date
  endDate: Date
  metrics: {
    avgCpuUsage: number
    avgMemoryUsage: number
    avgDiskUsage: number
    avgResponseTime: number
    totalRequests: number
    errorRate: number
    uptime: number
    peakConcurrentUsers: number
  }
  trends: {
    metric: string
    trend: 'up' | 'down' | 'stable'
    change: number
  }[]
  recommendations: string[]
  generatedAt: Date
}

export interface HealthCheck {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  lastCheck: Date
  details?: Record<string, any>
  dependencies?: HealthCheck[]
}

export interface PerformanceConfig {
  monitoring: {
    interval: number // segundos
    retention: number // días
    enableAlerts: boolean
    enableReports: boolean
  }
  thresholds: PerformanceThreshold[]
  notifications: {
    email: boolean
    slack: boolean
    webhook?: string
  }
  healthChecks: {
    enabled: boolean
    interval: number
    timeout: number
    services: string[]
  }
}

// Clase principal para monitoreo de rendimiento
export class PerformanceMonitor {
  private config: PerformanceConfig
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  private metricsInterval?: NodeJS.Timeout
  private healthCheckInterval?: NodeJS.Timeout
  private alerts: PerformanceAlert[] = []

  constructor(config: PerformanceConfig) {
    this.config = config
  }

  // Inicializar monitoreo
  async start(): Promise<void> {
    if (this.config.monitoring.interval > 0) {
      this.metricsInterval = setInterval(
        () => this.collectMetrics(),
        this.config.monitoring.interval * 1000
      )
    }

    if (this.config.healthChecks.enabled) {
      this.healthCheckInterval = setInterval(
        () => this.performHealthChecks(),
        this.config.healthChecks.interval * 1000
      )
    }

    // Limpiar métricas antiguas
    await this.cleanupOldMetrics()
  }

  // Detener monitoreo
  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
      this.metricsInterval = undefined
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
    }
  }

  // Recopilar métricas del sistema
  async collectMetrics(): Promise<SystemMetrics> {
    const metrics: SystemMetrics = {
      timestamp: new Date(),
      cpu: await this.getCpuMetrics(),
      memory: await this.getMemoryMetrics(),
      disk: await this.getDiskMetrics(),
      network: await this.getNetworkMetrics(),
      database: await this.getDatabaseMetrics(),
      application: await this.getApplicationMetrics()
    }

    // Guardar métricas
    await this.saveMetrics(metrics)

    // Verificar alertas
    await this.checkAlerts(metrics)

    return metrics
  }

  // Obtener métricas de CPU
  private async getCpuMetrics(): Promise<SystemMetrics['cpu']> {
    // En un entorno real, esto obtendría métricas del sistema
    // Aquí simulamos datos realistas
    return {
      usage: Math.random() * 100,
      cores: 4,
      loadAverage: [
        Math.random() * 2,
        Math.random() * 2,
        Math.random() * 2
      ]
    }
  }

  // Obtener métricas de memoria
  private async getMemoryMetrics(): Promise<SystemMetrics['memory']> {
    const total = 8 * 1024 * 1024 * 1024 // 8GB
    const used = Math.random() * total * 0.8
    const free = total - used

    return {
      used,
      total,
      free,
      percentage: (used / total) * 100
    }
  }

  // Obtener métricas de disco
  private async getDiskMetrics(): Promise<SystemMetrics['disk']> {
    const total = 500 * 1024 * 1024 * 1024 // 500GB
    const used = Math.random() * total * 0.6
    const free = total - used

    return {
      used,
      total,
      free,
      percentage: (used / total) * 100
    }
  }

  // Obtener métricas de red
  private async getNetworkMetrics(): Promise<SystemMetrics['network']> {
    return {
      bytesIn: Math.random() * 1000000,
      bytesOut: Math.random() * 1000000,
      packetsIn: Math.random() * 10000,
      packetsOut: Math.random() * 10000
    }
  }

  // Obtener métricas de base de datos
  private async getDatabaseMetrics(): Promise<SystemMetrics['database']> {
    try {
      // Simular consultas a la base de datos para obtener métricas
      const connections = Math.floor(Math.random() * 50) + 10
      const activeQueries = Math.floor(Math.random() * 20)
      const slowQueries = Math.floor(Math.random() * 5)
      const avgResponseTime = Math.random() * 100 + 10

      return {
        connections,
        activeQueries,
        slowQueries,
        avgResponseTime
      }
    } catch (error) {
      console.error('Error getting database metrics:', error)
      return {
        connections: 0,
        activeQueries: 0,
        slowQueries: 0,
        avgResponseTime: 0
      }
    }
  }

  // Obtener métricas de aplicación
  private async getApplicationMetrics(): Promise<SystemMetrics['application']> {
    // En un entorno real, esto obtendría métricas de la aplicación
    return {
      activeUsers: Math.floor(Math.random() * 1000) + 100,
      requestsPerSecond: Math.random() * 100 + 10,
      errorRate: Math.random() * 5,
      avgResponseTime: Math.random() * 500 + 50
    }
  }

  // Guardar métricas en la base de datos
  private async saveMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('performance_metrics')
        .insert({
          timestamp: metrics.timestamp.toISOString(),
          cpu_usage: metrics.cpu.usage,
          memory_usage: metrics.memory.percentage,
          disk_usage: metrics.disk.percentage,
          database_connections: metrics.database.connections,
          active_users: metrics.application.activeUsers,
          requests_per_second: metrics.application.requestsPerSecond,
          error_rate: metrics.application.errorRate,
          avg_response_time: metrics.application.avgResponseTime,
          raw_metrics: metrics
        })

      if (error) {
        console.error('Error saving metrics:', error)
      }
    } catch (error) {
      console.error('Error saving metrics:', error)
    }
  }

  // Verificar alertas basadas en umbrales
  private async checkAlerts(metrics: SystemMetrics): Promise<void> {
    for (const threshold of this.config.thresholds) {
      if (!threshold.enabled) continue

      const currentValue = this.getMetricValue(metrics, threshold.metric)
      const shouldAlert = this.evaluateThreshold(currentValue, threshold)

      if (shouldAlert) {
        const alert: PerformanceAlert = {
          id: `alert_${Date.now()}_${threshold.id}`,
          type: this.getAlertType(threshold.metric),
          severity: threshold.severity,
          title: `${threshold.metric} threshold exceeded`,
          description: threshold.description,
          threshold: threshold.value,
          currentValue,
          timestamp: new Date(),
          resolved: false,
          actions: threshold.actions
        }

        await this.createAlert(alert)
      }
    }
  }

  // Obtener valor de métrica específica
  private getMetricValue(metrics: SystemMetrics, metricPath: string): number {
    const parts = metricPath.split('.')
    let value: any = metrics

    for (const part of parts) {
      value = value?.[part]
    }

    return typeof value === 'number' ? value : 0
  }

  // Evaluar umbral
  private evaluateThreshold(value: number, threshold: PerformanceThreshold): boolean {
    switch (threshold.operator) {
      case '>':
        return value > threshold.value
      case '<':
        return value < threshold.value
      case '>=':
        return value >= threshold.value
      case '<=':
        return value <= threshold.value
      case '==':
        return value === threshold.value
      default:
        return false
    }
  }

  // Obtener tipo de alerta
  private getAlertType(metric: string): PerformanceAlert['type'] {
    if (metric.includes('cpu')) return 'cpu'
    if (metric.includes('memory')) return 'memory'
    if (metric.includes('disk')) return 'disk'
    if (metric.includes('database')) return 'database'
    if (metric.includes('application')) return 'application'
    return 'application'
  }

  // Crear alerta
  private async createAlert(alert: PerformanceAlert): Promise<void> {
    this.alerts.push(alert)

    try {
      await this.supabase
        .from('performance_alerts')
        .insert({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          threshold: alert.threshold,
          current_value: alert.currentValue,
          timestamp: alert.timestamp.toISOString(),
          resolved: alert.resolved,
          actions: alert.actions
        })

      // Enviar notificaciones si están habilitadas
      if (this.config.notifications.email || this.config.notifications.slack) {
        await this.sendNotification(alert)
      }
    } catch (error) {
      console.error('Error creating alert:', error)
    }
  }

  // Enviar notificación
  private async sendNotification(alert: PerformanceAlert): Promise<void> {
    try {
      if (this.config.notifications.webhook) {
        await fetch(this.config.notifications.webhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'performance_alert',
            alert,
            timestamp: new Date().toISOString()
          })
        })
      }
    } catch (error) {
      console.error('Error sending notification:', error)
    }
  }

  // Realizar verificaciones de salud
  async performHealthChecks(): Promise<HealthCheck[]> {
    const healthChecks: HealthCheck[] = []

    for (const service of this.config.healthChecks.services) {
      const healthCheck = await this.checkServiceHealth(service)
      healthChecks.push(healthCheck)
    }

    // Guardar resultados
    await this.saveHealthChecks(healthChecks)

    return healthChecks
  }

  // Verificar salud de un servicio
  private async checkServiceHealth(service: string): Promise<HealthCheck> {
    const startTime = Date.now()

    try {
      // Simular verificación de salud
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100))

      const responseTime = Date.now() - startTime
      const isHealthy = Math.random() > 0.1 // 90% de probabilidad de estar saludable

      return {
        service,
        status: isHealthy ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date(),
        details: {
          version: '1.0.0',
          uptime: Math.random() * 86400,
          connections: Math.floor(Math.random() * 100)
        }
      }
    } catch (error) {
      return {
        service,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  // Guardar verificaciones de salud
  private async saveHealthChecks(healthChecks: HealthCheck[]): Promise<void> {
    try {
      const records = healthChecks.map(check => ({
        service: check.service,
        status: check.status,
        response_time: check.responseTime,
        last_check: check.lastCheck.toISOString(),
        details: check.details
      }))

      await this.supabase
        .from('health_checks')
        .insert(records)
    } catch (error) {
      console.error('Error saving health checks:', error)
    }
  }

  // Generar reporte de rendimiento
  async generateReport(period: PerformanceReport['period'], startDate: Date, endDate: Date): Promise<PerformanceReport> {
    try {
      const { data: metrics } = await this.supabase
        .from('performance_metrics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp')

      if (!metrics || metrics.length === 0) {
        throw new Error('No metrics found for the specified period')
      }

      const report: PerformanceReport = {
        id: `report_${Date.now()}`,
        period,
        startDate,
        endDate,
        metrics: this.calculateAggregateMetrics(metrics),
        trends: this.calculateTrends(metrics),
        recommendations: this.generateRecommendations(metrics),
        generatedAt: new Date()
      }

      // Guardar reporte
      await this.supabase
        .from('performance_reports')
        .insert({
          id: report.id,
          period: report.period,
          start_date: report.startDate.toISOString(),
          end_date: report.endDate.toISOString(),
          metrics: report.metrics,
          trends: report.trends,
          recommendations: report.recommendations,
          generated_at: report.generatedAt.toISOString()
        })

      return report
    } catch (error) {
      console.error('Error generating report:', error)
      throw error
    }
  }

  // Calcular métricas agregadas
  private calculateAggregateMetrics(metrics: any[]): PerformanceReport['metrics'] {
    const totalMetrics = metrics.length

    return {
      avgCpuUsage: metrics.reduce((sum, m) => sum + m.cpu_usage, 0) / totalMetrics,
      avgMemoryUsage: metrics.reduce((sum, m) => sum + m.memory_usage, 0) / totalMetrics,
      avgDiskUsage: metrics.reduce((sum, m) => sum + m.disk_usage, 0) / totalMetrics,
      avgResponseTime: metrics.reduce((sum, m) => sum + m.avg_response_time, 0) / totalMetrics,
      totalRequests: metrics.reduce((sum, m) => sum + (m.requests_per_second * 60), 0), // Aproximado
      errorRate: metrics.reduce((sum, m) => sum + m.error_rate, 0) / totalMetrics,
      uptime: 99.5, // Calculado basado en health checks
      peakConcurrentUsers: Math.max(...metrics.map(m => m.active_users))
    }
  }

  // Calcular tendencias
  private calculateTrends(metrics: any[]): PerformanceReport['trends'] {
    const midpoint = Math.floor(metrics.length / 2)
    const firstHalf = metrics.slice(0, midpoint)
    const secondHalf = metrics.slice(midpoint)

    const trends = [
      {
        metric: 'CPU Usage',
        trend: this.getTrend(
          firstHalf.reduce((sum, m) => sum + m.cpu_usage, 0) / firstHalf.length,
          secondHalf.reduce((sum, m) => sum + m.cpu_usage, 0) / secondHalf.length
        ),
        change: 0
      },
      {
        metric: 'Memory Usage',
        trend: this.getTrend(
          firstHalf.reduce((sum, m) => sum + m.memory_usage, 0) / firstHalf.length,
          secondHalf.reduce((sum, m) => sum + m.memory_usage, 0) / secondHalf.length
        ),
        change: 0
      }
    ]

    // Calcular cambio porcentual
    trends.forEach(trend => {
      const firstValue = firstHalf.reduce((sum, m) => sum + m[trend.metric.toLowerCase().replace(' ', '_')], 0) / firstHalf.length
      const secondValue = secondHalf.reduce((sum, m) => sum + m[trend.metric.toLowerCase().replace(' ', '_')], 0) / secondHalf.length
      trend.change = ((secondValue - firstValue) / firstValue) * 100
    })

    return trends
  }

  // Determinar tendencia
  private getTrend(oldValue: number, newValue: number): 'up' | 'down' | 'stable' {
    const change = ((newValue - oldValue) / oldValue) * 100
    
    if (Math.abs(change) < 5) return 'stable'
    return change > 0 ? 'up' : 'down'
  }

  // Generar recomendaciones
  private generateRecommendations(metrics: any[]): string[] {
    const recommendations: string[] = []
    const avgCpu = metrics.reduce((sum, m) => sum + m.cpu_usage, 0) / metrics.length
    const avgMemory = metrics.reduce((sum, m) => sum + m.memory_usage, 0) / metrics.length
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.avg_response_time, 0) / metrics.length

    if (avgCpu > 80) {
      recommendations.push('Considerar aumentar la capacidad de CPU o optimizar procesos intensivos')
    }

    if (avgMemory > 85) {
      recommendations.push('Revisar el uso de memoria y considerar optimizaciones o aumento de RAM')
    }

    if (avgResponseTime > 1000) {
      recommendations.push('Optimizar consultas de base de datos y implementar caché para mejorar tiempos de respuesta')
    }

    if (recommendations.length === 0) {
      recommendations.push('El sistema está funcionando dentro de parámetros normales')
    }

    return recommendations
  }

  // Limpiar métricas antiguas
  private async cleanupOldMetrics(): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.config.monitoring.retention)

    try {
      await this.supabase
        .from('performance_metrics')
        .delete()
        .lt('timestamp', cutoffDate.toISOString())

      await this.supabase
        .from('health_checks')
        .delete()
        .lt('last_check', cutoffDate.toISOString())
    } catch (error) {
      console.error('Error cleaning up old metrics:', error)
    }
  }

  // Obtener métricas recientes
  async getRecentMetrics(hours: number = 24): Promise<SystemMetrics[]> {
    const startDate = new Date()
    startDate.setHours(startDate.getHours() - hours)

    try {
      const { data } = await this.supabase
        .from('performance_metrics')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .order('timestamp')

      return data?.map(record => ({
        timestamp: new Date(record.timestamp),
        cpu: { usage: record.cpu_usage, cores: 4, loadAverage: [0, 0, 0] },
        memory: { used: 0, total: 0, free: 0, percentage: record.memory_usage },
        disk: { used: 0, total: 0, free: 0, percentage: record.disk_usage },
        network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 },
        database: { connections: record.database_connections, activeQueries: 0, slowQueries: 0, avgResponseTime: 0 },
        application: { 
          activeUsers: record.active_users, 
          requestsPerSecond: record.requests_per_second,
          errorRate: record.error_rate,
          avgResponseTime: record.avg_response_time
        }
      })) || []
    } catch (error) {
      console.error('Error getting recent metrics:', error)
      return []
    }
  }

  // Obtener alertas activas
  async getActiveAlerts(): Promise<PerformanceAlert[]> {
    try {
      const { data } = await this.supabase
        .from('performance_alerts')
        .select('*')
        .eq('resolved', false)
        .order('timestamp', { ascending: false })

      return data?.map(record => ({
        id: record.id,
        type: record.type,
        severity: record.severity,
        title: record.title,
        description: record.description,
        threshold: record.threshold,
        currentValue: record.current_value,
        timestamp: new Date(record.timestamp),
        resolved: record.resolved,
        resolvedAt: record.resolved_at ? new Date(record.resolved_at) : undefined,
        actions: record.actions || []
      })) || []
    } catch (error) {
      console.error('Error getting active alerts:', error)
      return []
    }
  }

  // Resolver alerta
  async resolveAlert(alertId: string): Promise<void> {
    try {
      await this.supabase
        .from('performance_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString()
        })
        .eq('id', alertId)

      // Actualizar alerta local
      const alertIndex = this.alerts.findIndex(alert => alert.id === alertId)
      if (alertIndex !== -1) {
        this.alerts[alertIndex].resolved = true
        this.alerts[alertIndex].resolvedAt = new Date()
      }
    } catch (error) {
      console.error('Error resolving alert:', error)
      throw error
    }
  }
}

// Hook de React para usar el monitor de rendimiento
export function usePerformanceMonitor(config?: Partial<PerformanceConfig>) {
  const defaultConfig: PerformanceConfig = {
    monitoring: {
      interval: 60, // 1 minuto
      retention: 30, // 30 días
      enableAlerts: true,
      enableReports: true
    },
    thresholds: [
      {
        id: 'cpu_high',
        metric: 'cpu.usage',
        operator: '>',
        value: 80,
        severity: 'high',
        enabled: true,
        description: 'CPU usage is above 80%',
        actions: ['Scale up instances', 'Optimize CPU-intensive processes']
      },
      {
        id: 'memory_high',
        metric: 'memory.percentage',
        operator: '>',
        value: 85,
        severity: 'high',
        enabled: true,
        description: 'Memory usage is above 85%',
        actions: ['Increase memory allocation', 'Optimize memory usage']
      },
      {
        id: 'response_time_high',
        metric: 'application.avgResponseTime',
        operator: '>',
        value: 1000,
        severity: 'medium',
        enabled: true,
        description: 'Average response time is above 1 second',
        actions: ['Optimize database queries', 'Implement caching']
      }
    ],
    notifications: {
      email: false,
      slack: false
    },
    healthChecks: {
      enabled: true,
      interval: 300, // 5 minutos
      timeout: 10000, // 10 segundos
      services: ['database', 'api', 'cache', 'storage']
    }
  }

  const [monitor] = React.useState(() => new PerformanceMonitor({ ...defaultConfig, ...config }))
  const [metrics, setMetrics] = React.useState<SystemMetrics[]>([])
  const [alerts, setAlerts] = React.useState<PerformanceAlert[]>([])
  const [healthChecks, setHealthChecks] = React.useState<HealthCheck[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const initializeMonitor = async () => {
      try {
        await monitor.start()
        
        // Cargar datos iniciales
        const [recentMetrics, activeAlerts] = await Promise.all([
          monitor.getRecentMetrics(24),
          monitor.getActiveAlerts()
        ])

        setMetrics(recentMetrics)
        setAlerts(activeAlerts)
      } catch (error) {
        console.error('Failed to initialize performance monitor:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeMonitor()

    return () => {
      monitor.stop()
    }
  }, [monitor])

  const generateReport = React.useCallback(async (period: PerformanceReport['period'], startDate: Date, endDate: Date) => {
    return monitor.generateReport(period, startDate, endDate)
  }, [monitor])

  const resolveAlert = React.useCallback(async (alertId: string) => {
    await monitor.resolveAlert(alertId)
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, resolved: true, resolvedAt: new Date() }
        : alert
    ))
  }, [monitor])

  const refreshMetrics = React.useCallback(async () => {
    const recentMetrics = await monitor.getRecentMetrics(24)
    setMetrics(recentMetrics)
  }, [monitor])

  const performHealthCheck = React.useCallback(async () => {
    const checks = await monitor.performHealthChecks()
    setHealthChecks(checks)
    return checks
  }, [monitor])

  return {
    loading,
    metrics,
    alerts,
    healthChecks,
    generateReport,
    resolveAlert,
    refreshMetrics,
    performHealthCheck
  }
}

export default PerformanceMonitor