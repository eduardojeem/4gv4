import { createClient } from '@supabase/supabase-js'

// Interfaces para el monitoreo de integraciones
export interface IntegrationHealth {
  integrationId: string
  name: string
  type: string
  status: 'healthy' | 'warning' | 'critical' | 'offline'
  lastCheck: Date
  responseTime: number
  uptime: number
  errorRate: number
  lastError?: string
  metrics: HealthMetrics
}

export interface HealthMetrics {
  requestsPerMinute: number
  successRate: number
  averageResponseTime: number
  errorCount: number
  timeoutCount: number
  rateLimitHits: number
  dataQuality: number
}

export interface MonitoringRule {
  id: string
  integrationId: string
  name: string
  description: string
  type: 'response_time' | 'error_rate' | 'uptime' | 'data_quality' | 'rate_limit'
  condition: MonitoringCondition
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  cooldownPeriod: number // minutos
  lastTriggered?: Date
  actions: AlertAction[]
}

export interface MonitoringCondition {
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  threshold: number
  duration: number // minutos
  consecutiveFailures?: number
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'sms' | 'slack' | 'auto_retry' | 'failover'
  config: AlertActionConfig
  enabled: boolean
}

export interface AlertActionConfig {
  recipients?: string[]
  webhookUrl?: string
  slackChannel?: string
  retryAttempts?: number
  failoverIntegrationId?: string
  template?: string
  [key: string]: any
}

export interface Alert {
  id: string
  integrationId: string
  ruleId: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  timestamp: Date
  status: 'active' | 'acknowledged' | 'resolved'
  acknowledgedBy?: string
  acknowledgedAt?: Date
  resolvedAt?: Date
  metadata: Record<string, any>
}

export interface IntegrationIncident {
  id: string
  integrationId: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  startTime: Date
  endTime?: Date
  duration?: number
  impactedServices: string[]
  rootCause?: string
  resolution?: string
  timeline: IncidentTimelineEntry[]
}

export interface IncidentTimelineEntry {
  timestamp: Date
  type: 'status_change' | 'update' | 'action_taken'
  description: string
  author: string
}

export interface MonitoringDashboard {
  totalIntegrations: number
  healthyIntegrations: number
  warningIntegrations: number
  criticalIntegrations: number
  offlineIntegrations: number
  activeAlerts: number
  openIncidents: number
  averageUptime: number
  averageResponseTime: number
}

export interface PerformanceTrend {
  integrationId: string
  timestamp: Date
  responseTime: number
  successRate: number
  errorRate: number
  throughput: number
}

export interface SLAMetrics {
  integrationId: string
  period: 'daily' | 'weekly' | 'monthly'
  startDate: Date
  endDate: Date
  uptimeTarget: number
  actualUptime: number
  responseTimeTarget: number
  actualResponseTime: number
  errorRateTarget: number
  actualErrorRate: number
  slaCompliance: number
}

// Clase principal para el monitoreo de integraciones
export class IntegrationMonitor {
  private supabase: any
  private monitoringInterval: NodeJS.Timeout | null = null
  private healthChecks: Map<string, IntegrationHealth> = new Map()
  private rules: Map<string, MonitoringRule> = new Map()
  private activeAlerts: Map<string, Alert> = new Map()

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // Inicializar el sistema de monitoreo
  async initialize(): Promise<void> {
    try {
      await this.loadMonitoringRules()
      await this.loadActiveAlerts()
      await this.startMonitoring()
      
      console.log('Integration monitoring system initialized')
    } catch (error) {
      console.error('Failed to initialize integration monitoring:', error)
      throw error
    }
  }

  // Cargar reglas de monitoreo
  private async loadMonitoringRules(): Promise<void> {
    try {
      const { data: rules, error } = await this.supabase
        .from('integration_monitoring_rules')
        .select('*')
        .eq('enabled', true)

      if (error) throw error

      this.rules.clear()
      rules?.forEach(rule => {
        this.rules.set(rule.id, {
          ...rule,
          condition: JSON.parse(rule.condition),
          actions: JSON.parse(rule.actions),
          lastTriggered: rule.last_triggered ? new Date(rule.last_triggered) : undefined
        })
      })
    } catch (error) {
      console.error('Failed to load monitoring rules:', error)
      throw error
    }
  }

  // Cargar alertas activas
  private async loadActiveAlerts(): Promise<void> {
    try {
      const { data: alerts, error } = await this.supabase
        .from('integration_alerts')
        .select('*')
        .eq('status', 'active')

      if (error) throw error

      this.activeAlerts.clear()
      alerts?.forEach(alert => {
        this.activeAlerts.set(alert.id, {
          ...alert,
          timestamp: new Date(alert.timestamp),
          acknowledgedAt: alert.acknowledged_at ? new Date(alert.acknowledged_at) : undefined,
          resolvedAt: alert.resolved_at ? new Date(alert.resolved_at) : undefined,
          metadata: JSON.parse(alert.metadata || '{}')
        })
      })
    } catch (error) {
      console.error('Failed to load active alerts:', error)
      throw error
    }
  }

  // Iniciar monitoreo continuo
  private async startMonitoring(): Promise<void> {
    // Ejecutar verificación inicial
    await this.performHealthChecks()

    // Configurar monitoreo continuo cada 30 segundos
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthChecks()
        await this.evaluateRules()
        await this.updateMetrics()
      } catch (error) {
        console.error('Error during monitoring cycle:', error)
      }
    }, 30000)
  }

  // Realizar verificaciones de salud
  private async performHealthChecks(): Promise<void> {
    try {
      // Obtener todas las integraciones activas
      const { data: integrations, error } = await this.supabase
        .from('external_integrations')
        .select('*')
        .eq('status', 'active')

      if (error) throw error

      // Verificar cada integración
      const healthPromises = integrations?.map(integration => 
        this.checkIntegrationHealth(integration)
      ) || []

      await Promise.allSettled(healthPromises)
    } catch (error) {
      console.error('Failed to perform health checks:', error)
    }
  }

  // Verificar salud de una integración específica
  private async checkIntegrationHealth(integration: any): Promise<void> {
    const startTime = Date.now()
    let health: IntegrationHealth

    try {
      // Realizar verificación según el tipo de integración
      const result = await this.performHealthCheck(integration)
      const responseTime = Date.now() - startTime

      health = {
        integrationId: integration.id,
        name: integration.name,
        type: integration.type,
        status: this.determineHealthStatus(result, responseTime),
        lastCheck: new Date(),
        responseTime,
        uptime: await this.calculateUptime(integration.id),
        errorRate: await this.calculateErrorRate(integration.id),
        metrics: result.metrics
      }

      if (result.error) {
        health.lastError = result.error
      }

    } catch (error) {
      health = {
        integrationId: integration.id,
        name: integration.name,
        type: integration.type,
        status: 'offline',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        uptime: await this.calculateUptime(integration.id),
        errorRate: 100,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          requestsPerMinute: 0,
          successRate: 0,
          averageResponseTime: 0,
          errorCount: 1,
          timeoutCount: 0,
          rateLimitHits: 0,
          dataQuality: 0
        }
      }
    }

    // Actualizar estado de salud
    this.healthChecks.set(integration.id, health)

    // Persistir en base de datos
    await this.saveHealthCheck(health)
  }

  // Realizar verificación específica según tipo de integración
  private async performHealthCheck(integration: any): Promise<any> {
    const config = JSON.parse(integration.config || '{}')
    
    switch (integration.type) {
      case 'rest_api':
        return await this.checkRestAPI(config)
      case 'webhook':
        return await this.checkWebhook(config)
      case 'database':
        return await this.checkDatabase(config)
      case 'file_sync':
        return await this.checkFileSync(config)
      default:
        throw new Error(`Unsupported integration type: ${integration.type}`)
    }
  }

  // Verificar API REST
  private async checkRestAPI(config: any): Promise<any> {
    const response = await fetch(config.healthCheckUrl || config.baseUrl, {
      method: 'GET',
      headers: config.headers || {},
      timeout: 10000
    })

    const metrics: HealthMetrics = {
      requestsPerMinute: await this.getRequestsPerMinute(config.baseUrl),
      successRate: response.ok ? 100 : 0,
      averageResponseTime: 0, // Se calculará después
      errorCount: response.ok ? 0 : 1,
      timeoutCount: 0,
      rateLimitHits: response.status === 429 ? 1 : 0,
      dataQuality: response.ok ? 100 : 0
    }

    return {
      success: response.ok,
      status: response.status,
      error: response.ok ? null : `HTTP ${response.status}`,
      metrics
    }
  }

  // Verificar webhook
  private async checkWebhook(config: any): Promise<any> {
    // Para webhooks, verificamos la conectividad del endpoint
    try {
      const response = await fetch(config.url, {
        method: 'HEAD',
        timeout: 5000
      })

      return {
        success: response.ok,
        status: response.status,
        metrics: {
          requestsPerMinute: 0,
          successRate: response.ok ? 100 : 0,
          averageResponseTime: 0,
          errorCount: response.ok ? 0 : 1,
          timeoutCount: 0,
          rateLimitHits: 0,
          dataQuality: 100
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        metrics: {
          requestsPerMinute: 0,
          successRate: 0,
          averageResponseTime: 0,
          errorCount: 1,
          timeoutCount: 1,
          rateLimitHits: 0,
          dataQuality: 0
        }
      }
    }
  }

  // Verificar base de datos
  private async checkDatabase(config: any): Promise<any> {
    // Implementar verificación de conexión a base de datos
    // Esto dependería del tipo específico de base de datos
    return {
      success: true,
      metrics: {
        requestsPerMinute: 0,
        successRate: 100,
        averageResponseTime: 50,
        errorCount: 0,
        timeoutCount: 0,
        rateLimitHits: 0,
        dataQuality: 100
      }
    }
  }

  // Verificar sincronización de archivos
  private async checkFileSync(config: any): Promise<any> {
    // Implementar verificación de sincronización de archivos
    return {
      success: true,
      metrics: {
        requestsPerMinute: 0,
        successRate: 100,
        averageResponseTime: 100,
        errorCount: 0,
        timeoutCount: 0,
        rateLimitHits: 0,
        dataQuality: 100
      }
    }
  }

  // Determinar estado de salud basado en resultados
  private determineHealthStatus(result: any, responseTime: number): 'healthy' | 'warning' | 'critical' | 'offline' {
    if (!result.success) {
      return 'offline'
    }

    if (responseTime > 5000 || result.metrics.errorRate > 10) {
      return 'critical'
    }

    if (responseTime > 2000 || result.metrics.errorRate > 5) {
      return 'warning'
    }

    return 'healthy'
  }

  // Evaluar reglas de monitoreo
  private async evaluateRules(): Promise<void> {
    for (const [ruleId, rule] of this.rules) {
      try {
        const health = this.healthChecks.get(rule.integrationId)
        if (!health) continue

        const shouldTrigger = await this.evaluateRule(rule, health)
        
        if (shouldTrigger && this.canTriggerRule(rule)) {
          await this.triggerAlert(rule, health)
        }
      } catch (error) {
        console.error(`Error evaluating rule ${ruleId}:`, error)
      }
    }
  }

  // Evaluar una regla específica
  private async evaluateRule(rule: MonitoringRule, health: IntegrationHealth): Promise<boolean> {
    let value: number

    switch (rule.type) {
      case 'response_time':
        value = health.responseTime
        break
      case 'error_rate':
        value = health.errorRate
        break
      case 'uptime':
        value = health.uptime
        break
      case 'data_quality':
        value = health.metrics.dataQuality
        break
      case 'rate_limit':
        value = health.metrics.rateLimitHits
        break
      default:
        return false
    }

    return this.evaluateCondition(rule.condition, value)
  }

  // Evaluar condición
  private evaluateCondition(condition: MonitoringCondition, value: number): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.threshold
      case 'lt': return value < condition.threshold
      case 'eq': return value === condition.threshold
      case 'gte': return value >= condition.threshold
      case 'lte': return value <= condition.threshold
      default: return false
    }
  }

  // Verificar si se puede disparar una regla (cooldown)
  private canTriggerRule(rule: MonitoringRule): boolean {
    if (!rule.lastTriggered) return true

    const cooldownMs = rule.cooldownPeriod * 60 * 1000
    return Date.now() - rule.lastTriggered.getTime() > cooldownMs
  }

  // Disparar alerta
  private async triggerAlert(rule: MonitoringRule, health: IntegrationHealth): Promise<void> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      integrationId: rule.integrationId,
      ruleId: rule.id,
      severity: rule.severity,
      title: `${rule.name} - ${health.name}`,
      message: this.generateAlertMessage(rule, health),
      timestamp: new Date(),
      status: 'active',
      metadata: {
        health,
        rule: rule.name,
        threshold: rule.condition.threshold,
        actualValue: this.getMetricValue(rule.type, health)
      }
    }

    // Guardar alerta
    await this.saveAlert(alert)
    this.activeAlerts.set(alert.id, alert)

    // Ejecutar acciones
    await this.executeAlertActions(rule.actions, alert, health)

    // Actualizar última activación de la regla
    rule.lastTriggered = new Date()
    await this.updateRule(rule)
  }

  // Generar mensaje de alerta
  private generateAlertMessage(rule: MonitoringRule, health: IntegrationHealth): string {
    const value = this.getMetricValue(rule.type, health)
    return `${rule.description}. Valor actual: ${value}, Umbral: ${rule.condition.threshold}`
  }

  // Obtener valor de métrica
  private getMetricValue(type: string, health: IntegrationHealth): number {
    switch (type) {
      case 'response_time': return health.responseTime
      case 'error_rate': return health.errorRate
      case 'uptime': return health.uptime
      case 'data_quality': return health.metrics.dataQuality
      case 'rate_limit': return health.metrics.rateLimitHits
      default: return 0
    }
  }

  // Ejecutar acciones de alerta
  private async executeAlertActions(actions: AlertAction[], alert: Alert, health: IntegrationHealth): Promise<void> {
    for (const action of actions.filter(a => a.enabled)) {
      try {
        await this.executeAction(action, alert, health)
      } catch (error) {
        console.error(`Failed to execute action ${action.type}:`, error)
      }
    }
  }

  // Ejecutar acción específica
  private async executeAction(action: AlertAction, alert: Alert, health: IntegrationHealth): Promise<void> {
    switch (action.type) {
      case 'email':
        await this.sendEmailAlert(action.config, alert)
        break
      case 'webhook':
        await this.sendWebhookAlert(action.config, alert)
        break
      case 'slack':
        await this.sendSlackAlert(action.config, alert)
        break
      case 'auto_retry':
        await this.performAutoRetry(action.config, health)
        break
      case 'failover':
        await this.performFailover(action.config, health)
        break
    }
  }

  // Enviar alerta por email
  private async sendEmailAlert(config: AlertActionConfig, alert: Alert): Promise<void> {
    // Implementar envío de email
    console.log(`Sending email alert to ${config.recipients?.join(', ')}:`, alert.title)
  }

  // Enviar alerta por webhook
  private async sendWebhookAlert(config: AlertActionConfig, alert: Alert): Promise<void> {
    if (!config.webhookUrl) return

    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert)
    })
  }

  // Enviar alerta a Slack
  private async sendSlackAlert(config: AlertActionConfig, alert: Alert): Promise<void> {
    // Implementar envío a Slack
    console.log(`Sending Slack alert to ${config.slackChannel}:`, alert.title)
  }

  // Realizar reintento automático
  private async performAutoRetry(config: AlertActionConfig, health: IntegrationHealth): Promise<void> {
    const attempts = config.retryAttempts || 3
    console.log(`Performing auto-retry for ${health.name}, attempts: ${attempts}`)
  }

  // Realizar failover
  private async performFailover(config: AlertActionConfig, health: IntegrationHealth): Promise<void> {
    if (!config.failoverIntegrationId) return
    console.log(`Performing failover from ${health.integrationId} to ${config.failoverIntegrationId}`)
  }

  // Métodos de utilidad para cálculos
  private async calculateUptime(integrationId: string): Promise<number> {
    // Calcular uptime basado en histórico
    return 99.5 // Placeholder
  }

  private async calculateErrorRate(integrationId: string): Promise<number> {
    // Calcular tasa de error basada en histórico
    return 2.1 // Placeholder
  }

  private async getRequestsPerMinute(url: string): Promise<number> {
    // Obtener RPM basado en métricas
    return 45 // Placeholder
  }

  // Métodos de persistencia
  private async saveHealthCheck(health: IntegrationHealth): Promise<void> {
    try {
      await this.supabase
        .from('integration_health_checks')
        .upsert({
          integration_id: health.integrationId,
          status: health.status,
          last_check: health.lastCheck.toISOString(),
          response_time: health.responseTime,
          uptime: health.uptime,
          error_rate: health.errorRate,
          last_error: health.lastError,
          metrics: JSON.stringify(health.metrics)
        })
    } catch (error) {
      console.error('Failed to save health check:', error)
    }
  }

  private async saveAlert(alert: Alert): Promise<void> {
    try {
      await this.supabase
        .from('integration_alerts')
        .insert({
          id: alert.id,
          integration_id: alert.integrationId,
          rule_id: alert.ruleId,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          timestamp: alert.timestamp.toISOString(),
          status: alert.status,
          metadata: JSON.stringify(alert.metadata)
        })
    } catch (error) {
      console.error('Failed to save alert:', error)
    }
  }

  private async updateRule(rule: MonitoringRule): Promise<void> {
    try {
      await this.supabase
        .from('integration_monitoring_rules')
        .update({
          last_triggered: rule.lastTriggered?.toISOString()
        })
        .eq('id', rule.id)
    } catch (error) {
      console.error('Failed to update rule:', error)
    }
  }

  // Métodos públicos para gestión
  async getDashboardData(): Promise<MonitoringDashboard> {
    const healthChecks = Array.from(this.healthChecks.values())
    
    return {
      totalIntegrations: healthChecks.length,
      healthyIntegrations: healthChecks.filter(h => h.status === 'healthy').length,
      warningIntegrations: healthChecks.filter(h => h.status === 'warning').length,
      criticalIntegrations: healthChecks.filter(h => h.status === 'critical').length,
      offlineIntegrations: healthChecks.filter(h => h.status === 'offline').length,
      activeAlerts: this.activeAlerts.size,
      openIncidents: 0, // Implementar conteo de incidentes
      averageUptime: healthChecks.reduce((sum, h) => sum + h.uptime, 0) / healthChecks.length,
      averageResponseTime: healthChecks.reduce((sum, h) => sum + h.responseTime, 0) / healthChecks.length
    }
  }

  async getIntegrationHealth(integrationId: string): Promise<IntegrationHealth | null> {
    return this.healthChecks.get(integrationId) || null
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.activeAlerts.values())
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId)
    if (!alert) return

    alert.status = 'acknowledged'
    alert.acknowledgedBy = userId
    alert.acknowledgedAt = new Date()

    await this.supabase
      .from('integration_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: userId,
        acknowledged_at: alert.acknowledgedAt.toISOString()
      })
      .eq('id', alertId)
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId)
    if (!alert) return

    alert.status = 'resolved'
    alert.resolvedAt = new Date()

    await this.supabase
      .from('integration_alerts')
      .update({
        status: 'resolved',
        resolved_at: alert.resolvedAt.toISOString()
      })
      .eq('id', alertId)

    this.activeAlerts.delete(alertId)
  }

  // Detener monitoreo
  async stop(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }
}

// Instancia singleton
export const integrationMonitor = new IntegrationMonitor()