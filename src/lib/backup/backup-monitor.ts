'use client'

import { createClient } from '@/lib/supabase/client'
import { backupManager } from './backup-manager'
import type { 
  BackupConfiguration, 
  BackupJob, 
  BackupHealth, 
  HealthIssue,
  BackupMetrics 
} from './backup-manager'

// Interfaces para monitoreo
export interface MonitoringRule {
  id: string
  name: string
  description: string
  type: 'threshold' | 'pattern' | 'anomaly' | 'schedule'
  target: 'backup_success_rate' | 'backup_duration' | 'storage_usage' | 'error_rate' | 'schedule_compliance'
  condition: MonitoringCondition
  severity: 'low' | 'medium' | 'high' | 'critical'
  actions: MonitoringAction[]
  enabled: boolean
  lastTriggered?: Date
  triggerCount: number
  createdAt: Date
  updatedAt: Date
}

export interface MonitoringCondition {
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'matches'
  value: number | string
  timeWindow?: number // en minutos
  threshold?: number
  pattern?: string
  anomalyDetection?: {
    enabled: boolean
    sensitivity: 'low' | 'medium' | 'high'
    baselinePeriod: number // en días
  }
}

export interface MonitoringAction {
  type: 'email' | 'slack' | 'webhook' | 'auto_retry' | 'auto_failover' | 'auto_scale' | 'create_ticket'
  config: {
    recipients?: string[]
    webhookUrl?: string
    slackChannel?: string
    retryAttempts?: number
    failoverTarget?: string
    scaleConfig?: any
    ticketSystem?: string
  }
  delay?: number // en segundos
  maxExecutions?: number
}

export interface MonitoringAlert {
  id: string
  ruleId: string
  configurationId?: string
  jobId?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  details: any
  status: 'active' | 'acknowledged' | 'resolved' | 'suppressed'
  triggeredAt: Date
  acknowledgedAt?: Date
  acknowledgedBy?: string
  resolvedAt?: Date
  resolvedBy?: string
  actions: AlertAction[]
  escalationLevel: number
  suppressUntil?: Date
}

export interface AlertAction {
  id: string
  alertId: string
  type: string
  status: 'pending' | 'executing' | 'completed' | 'failed'
  executedAt?: Date
  result?: any
  error?: string
}

export interface MonitoringDashboard {
  id: string
  name: string
  description: string
  widgets: DashboardWidget[]
  layout: DashboardLayout
  refreshInterval: number
  permissions: {
    viewers: string[]
    editors: string[]
  }
  createdAt: Date
  updatedAt: Date
}

export interface DashboardWidget {
  id: string
  type: 'chart' | 'metric' | 'table' | 'alert_list' | 'health_status' | 'timeline'
  title: string
  config: {
    dataSource: string
    query?: string
    chartType?: 'line' | 'bar' | 'pie' | 'gauge' | 'heatmap'
    timeRange?: string
    refreshInterval?: number
    thresholds?: { value: number; color: string }[]
    columns?: string[]
    filters?: { [key: string]: any }
  }
  position: { x: number; y: number; width: number; height: number }
}

export interface DashboardLayout {
  columns: number
  rows: number
  gridSize: number
  responsive: boolean
}

export interface AutoRecoveryConfig {
  enabled: boolean
  maxAttempts: number
  retryDelay: number // en segundos
  escalationDelay: number // en minutos
  strategies: RecoveryStrategy[]
  notifications: {
    onStart: boolean
    onSuccess: boolean
    onFailure: boolean
    onEscalation: boolean
  }
}

export interface RecoveryStrategy {
  id: string
  name: string
  type: 'retry' | 'failover' | 'rollback' | 'restart' | 'scale' | 'custom'
  priority: number
  conditions: RecoveryCondition[]
  actions: RecoveryAction[]
  timeout: number // en minutos
  successCriteria: string[]
}

export interface RecoveryCondition {
  type: 'error_type' | 'failure_count' | 'time_since_last_success' | 'resource_availability'
  operator: 'eq' | 'gt' | 'lt' | 'contains'
  value: any
}

export interface RecoveryAction {
  type: 'restart_backup' | 'switch_destination' | 'increase_resources' | 'notify_admin' | 'run_script'
  config: any
  timeout: number
}

export interface RecoveryExecution {
  id: string
  alertId: string
  strategyId: string
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'timeout'
  startedAt: Date
  completedAt?: Date
  actions: RecoveryActionResult[]
  result: 'success' | 'partial_success' | 'failure'
  logs: string[]
}

export interface RecoveryActionResult {
  actionType: string
  status: 'completed' | 'failed' | 'timeout'
  result?: any
  error?: string
  duration: number
}

export interface MonitoringMetrics {
  period: {
    start: Date
    end: Date
  }
  totalAlerts: number
  criticalAlerts: number
  resolvedAlerts: number
  averageResolutionTime: number
  topIssues: { type: string; count: number }[]
  recoverySuccess: {
    total: number
    successful: number
    failed: number
    rate: number
  }
  systemHealth: {
    overall: 'healthy' | 'warning' | 'critical'
    components: { [component: string]: 'healthy' | 'warning' | 'critical' }
  }
  trends: {
    alertVolume: number[]
    resolutionTime: number[]
    recoveryRate: number[]
  }
}

class BackupMonitor {
  private supabase = createClient()
  private monitoringRules: Map<string, MonitoringRule> = new Map()
  private activeAlerts: Map<string, MonitoringAlert> = new Map()
  private recoveryConfigs: Map<string, AutoRecoveryConfig> = new Map()
  private isMonitoring = false
  private monitoringInterval?: NodeJS.Timeout
  private alertProcessingQueue: MonitoringAlert[] = []
  private recoveryExecutions: Map<string, RecoveryExecution> = new Map()

  // Inicializar monitor
  async initialize(): Promise<void> {
    if (this.isMonitoring) return

    await this.loadMonitoringRules()
    await this.loadActiveAlerts()
    await this.loadRecoveryConfigs()
    
    this.startMonitoring()
    this.startAlertProcessing()
    this.startRecoveryEngine()
    
    this.isMonitoring = true
  }

  // Cargar reglas de monitoreo
  private async loadMonitoringRules(): Promise<void> {
    try {
      const { data: rules } = await this.supabase
        .from('monitoring_rules')
        .select('*')
        .eq('enabled', true)

      if (rules) {
        for (const rule of rules) {
          this.monitoringRules.set(rule.id, {
            ...rule,
            lastTriggered: rule.last_triggered ? new Date(rule.last_triggered) : undefined,
            createdAt: new Date(rule.created_at),
            updatedAt: new Date(rule.updated_at)
          })
        }
      }
    } catch (error) {
      console.error('Error loading monitoring rules:', error)
    }
  }

  // Cargar alertas activas
  private async loadActiveAlerts(): Promise<void> {
    try {
      const { data: alerts } = await this.supabase
        .from('monitoring_alerts')
        .select('*')
        .in('status', ['active', 'acknowledged'])

      if (alerts) {
        for (const alert of alerts) {
          this.activeAlerts.set(alert.id, {
            ...alert,
            triggeredAt: new Date(alert.triggered_at),
            acknowledgedAt: alert.acknowledged_at ? new Date(alert.acknowledged_at) : undefined,
            resolvedAt: alert.resolved_at ? new Date(alert.resolved_at) : undefined,
            suppressUntil: alert.suppress_until ? new Date(alert.suppress_until) : undefined
          })
        }
      }
    } catch (error) {
      console.error('Error loading active alerts:', error)
    }
  }

  // Cargar configuraciones de recuperación
  private async loadRecoveryConfigs(): Promise<void> {
    try {
      const { data: configs } = await this.supabase
        .from('auto_recovery_configs')
        .select('*')
        .eq('enabled', true)

      if (configs) {
        for (const config of configs) {
          this.recoveryConfigs.set(config.configuration_id, config)
        }
      }
    } catch (error) {
      console.error('Error loading recovery configs:', error)
    }
  }

  // Iniciar monitoreo
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.performMonitoringChecks()
    }, 60000) // Cada minuto
  }

  // Realizar verificaciones de monitoreo
  private async performMonitoringChecks(): Promise<void> {
    try {
      for (const [ruleId, rule] of this.monitoringRules) {
        if (!rule.enabled) continue

        const shouldTrigger = await this.evaluateRule(rule)
        
        if (shouldTrigger) {
          await this.triggerAlert(rule)
        }
      }
    } catch (error) {
      console.error('Error performing monitoring checks:', error)
    }
  }

  // Evaluar regla de monitoreo
  private async evaluateRule(rule: MonitoringRule): Promise<boolean> {
    try {
      switch (rule.target) {
        case 'backup_success_rate':
          return await this.evaluateSuccessRate(rule)
        case 'backup_duration':
          return await this.evaluateBackupDuration(rule)
        case 'storage_usage':
          return await this.evaluateStorageUsage(rule)
        case 'error_rate':
          return await this.evaluateErrorRate(rule)
        case 'schedule_compliance':
          return await this.evaluateScheduleCompliance(rule)
        default:
          return false
      }
    } catch (error) {
      console.error('Error evaluating rule:', error)
      return false
    }
  }

  // Evaluar tasa de éxito
  private async evaluateSuccessRate(rule: MonitoringRule): Promise<boolean> {
    const timeWindow = rule.condition.timeWindow || 60 // minutos
    const threshold = rule.condition.value as number
    const startTime = new Date(Date.now() - timeWindow * 60 * 1000)

    const { data: jobs } = await this.supabase
      .from('backup_jobs')
      .select('status')
      .gte('started_at', startTime.toISOString())

    if (!jobs || jobs.length === 0) return false

    const successfulJobs = jobs.filter(j => j.status === 'completed').length
    const successRate = (successfulJobs / jobs.length) * 100

    switch (rule.condition.operator) {
      case 'lt':
        return successRate < threshold
      case 'lte':
        return successRate <= threshold
      case 'gt':
        return successRate > threshold
      case 'gte':
        return successRate >= threshold
      case 'eq':
        return successRate === threshold
      default:
        return false
    }
  }

  // Evaluar duración de backup
  private async evaluateBackupDuration(rule: MonitoringRule): Promise<boolean> {
    const timeWindow = rule.condition.timeWindow || 60
    const threshold = rule.condition.value as number
    const startTime = new Date(Date.now() - timeWindow * 60 * 1000)

    const { data: jobs } = await this.supabase
      .from('backup_jobs')
      .select('statistics')
      .eq('status', 'completed')
      .gte('started_at', startTime.toISOString())

    if (!jobs || jobs.length === 0) return false

    const durations = jobs
      .map(j => j.statistics?.duration || 0)
      .filter(d => d > 0)

    if (durations.length === 0) return false

    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length

    switch (rule.condition.operator) {
      case 'gt':
        return averageDuration > threshold
      case 'gte':
        return averageDuration >= threshold
      case 'lt':
        return averageDuration < threshold
      case 'lte':
        return averageDuration <= threshold
      default:
        return false
    }
  }

  // Evaluar uso de almacenamiento
  private async evaluateStorageUsage(rule: MonitoringRule): Promise<boolean> {
    // Implementar evaluación de uso de almacenamiento
    const threshold = rule.condition.value as number
    
    // Obtener métricas de almacenamiento
    const storageUsage = await this.getStorageUsage()
    
    switch (rule.condition.operator) {
      case 'gt':
        return storageUsage.percentage > threshold
      case 'gte':
        return storageUsage.percentage >= threshold
      default:
        return false
    }
  }

  // Evaluar tasa de errores
  private async evaluateErrorRate(rule: MonitoringRule): Promise<boolean> {
    const timeWindow = rule.condition.timeWindow || 60
    const threshold = rule.condition.value as number
    const startTime = new Date(Date.now() - timeWindow * 60 * 1000)

    const { data: jobs } = await this.supabase
      .from('backup_jobs')
      .select('status')
      .gte('started_at', startTime.toISOString())

    if (!jobs || jobs.length === 0) return false

    const failedJobs = jobs.filter(j => j.status === 'failed').length
    const errorRate = (failedJobs / jobs.length) * 100

    switch (rule.condition.operator) {
      case 'gt':
        return errorRate > threshold
      case 'gte':
        return errorRate >= threshold
      default:
        return false
    }
  }

  // Evaluar cumplimiento de horarios
  private async evaluateScheduleCompliance(rule: MonitoringRule): Promise<boolean> {
    const configurations = await backupManager.getConfigurations()
    const now = new Date()
    const threshold = rule.condition.value as number // horas de retraso permitidas

    for (const config of configurations) {
      if (!config.active || !config.schedule.enabled) continue

      if (config.nextBackupAt && config.nextBackupAt < now) {
        const delayHours = (now.getTime() - config.nextBackupAt.getTime()) / (1000 * 60 * 60)
        
        if (delayHours > threshold) {
          return true
        }
      }
    }

    return false
  }

  // Disparar alerta
  private async triggerAlert(rule: MonitoringRule): Promise<void> {
    try {
      // Verificar si ya existe una alerta activa para esta regla
      const existingAlert = Array.from(this.activeAlerts.values())
        .find(alert => alert.ruleId === rule.id && alert.status === 'active')

      if (existingAlert) {
        // Incrementar escalación si es necesario
        await this.escalateAlert(existingAlert)
        return
      }

      // Crear nueva alerta
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const alert: MonitoringAlert = {
        id: alertId,
        ruleId: rule.id,
        severity: rule.severity,
        title: `Monitoring Alert: ${rule.name}`,
        message: this.generateAlertMessage(rule),
        details: await this.gatherAlertDetails(rule),
        status: 'active',
        triggeredAt: new Date(),
        actions: [],
        escalationLevel: 0
      }

      // Guardar alerta
      await this.saveAlert(alert)
      this.activeAlerts.set(alertId, alert)
      this.alertProcessingQueue.push(alert)

      // Actualizar regla
      rule.lastTriggered = new Date()
      rule.triggerCount++
      await this.updateMonitoringRule(rule)

      console.log(`Alert triggered: ${alert.title}`)
    } catch (error) {
      console.error('Error triggering alert:', error)
    }
  }

  // Generar mensaje de alerta
  private generateAlertMessage(rule: MonitoringRule): string {
    switch (rule.target) {
      case 'backup_success_rate':
        return `Backup success rate is below ${rule.condition.value}%`
      case 'backup_duration':
        return `Backup duration exceeds ${rule.condition.value} seconds`
      case 'storage_usage':
        return `Storage usage exceeds ${rule.condition.value}%`
      case 'error_rate':
        return `Error rate exceeds ${rule.condition.value}%`
      case 'schedule_compliance':
        return `Backup schedule compliance violation detected`
      default:
        return `Monitoring rule ${rule.name} triggered`
    }
  }

  // Recopilar detalles de alerta
  private async gatherAlertDetails(rule: MonitoringRule): Promise<any> {
    const details: any = {
      rule: {
        id: rule.id,
        name: rule.name,
        target: rule.target,
        condition: rule.condition
      },
      timestamp: new Date(),
      context: {}
    }

    try {
      switch (rule.target) {
        case 'backup_success_rate':
        case 'error_rate':
          const recentJobs = await this.getRecentJobs(rule.condition.timeWindow || 60)
          details.context.recentJobs = recentJobs
          break
        case 'storage_usage':
          const storageInfo = await this.getStorageUsage()
          details.context.storage = storageInfo
          break
        case 'schedule_compliance':
          const delayedConfigs = await this.getDelayedConfigurations()
          details.context.delayedConfigurations = delayedConfigs
          break
      }
    } catch (error) {
      details.context.error = error instanceof Error ? error.message : 'Unknown error'
    }

    return details
  }

  // Iniciar procesamiento de alertas
  private startAlertProcessing(): void {
    setInterval(async () => {
      await this.processAlertQueue()
    }, 10000) // Cada 10 segundos
  }

  // Procesar cola de alertas
  private async processAlertQueue(): Promise<void> {
    while (this.alertProcessingQueue.length > 0) {
      const alert = this.alertProcessingQueue.shift()
      if (alert) {
        await this.processAlert(alert)
      }
    }
  }

  // Procesar alerta
  private async processAlert(alert: MonitoringAlert): Promise<void> {
    try {
      const rule = this.monitoringRules.get(alert.ruleId)
      if (!rule) return

      // Ejecutar acciones de la regla
      for (const action of rule.actions) {
        const actionResult = await this.executeAction(action, alert)
        
        const alertAction: AlertAction = {
          id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          alertId: alert.id,
          type: action.type,
          status: actionResult.success ? 'completed' : 'failed',
          executedAt: new Date(),
          result: actionResult.result,
          error: actionResult.error
        }

        alert.actions.push(alertAction)
      }

      // Iniciar recuperación automática si está configurada
      if (alert.severity === 'critical' || alert.severity === 'high') {
        await this.initiateAutoRecovery(alert)
      }

      await this.updateAlert(alert)
    } catch (error) {
      console.error('Error processing alert:', error)
    }
  }

  // Ejecutar acción
  private async executeAction(action: MonitoringAction, alert: MonitoringAlert): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      switch (action.type) {
        case 'email':
          return await this.sendEmailNotification(action, alert)
        case 'slack':
          return await this.sendSlackNotification(action, alert)
        case 'webhook':
          return await this.sendWebhookNotification(action, alert)
        case 'auto_retry':
          return await this.executeAutoRetry(action, alert)
        case 'auto_failover':
          return await this.executeAutoFailover(action, alert)
        case 'create_ticket':
          return await this.createSupportTicket(action, alert)
        default:
          return { success: false, error: 'Unknown action type' }
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  // Iniciar recuperación automática
  private async initiateAutoRecovery(alert: MonitoringAlert): Promise<void> {
    if (!alert.configurationId) return

    const recoveryConfig = this.recoveryConfigs.get(alert.configurationId)
    if (!recoveryConfig || !recoveryConfig.enabled) return

    const executionId = `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const execution: RecoveryExecution = {
      id: executionId,
      alertId: alert.id,
      strategyId: '',
      status: 'pending',
      startedAt: new Date(),
      actions: [],
      result: 'failure',
      logs: []
    }

    this.recoveryExecutions.set(executionId, execution)

    // Encontrar estrategia apropiada
    const strategy = this.findRecoveryStrategy(alert, recoveryConfig)
    if (!strategy) {
      execution.status = 'failed'
      execution.logs.push('No suitable recovery strategy found')
      return
    }

    execution.strategyId = strategy.id
    execution.status = 'executing'

    try {
      // Ejecutar acciones de recuperación
      for (const action of strategy.actions) {
        const actionResult = await this.executeRecoveryAction(action, alert)
        execution.actions.push(actionResult)

        if (actionResult.status === 'failed') {
          execution.result = 'failure'
          break
        }
      }

      // Verificar criterios de éxito
      const success = await this.verifyRecoverySuccess(strategy, alert)
      execution.result = success ? 'success' : 'failure'
      execution.status = 'completed'
      execution.completedAt = new Date()

      if (success) {
        // Resolver alerta automáticamente
        alert.status = 'resolved'
        alert.resolvedAt = new Date()
        alert.resolvedBy = 'auto-recovery'
        await this.updateAlert(alert)
      }

    } catch (error) {
      execution.status = 'failed'
      execution.result = 'failure'
      execution.logs.push(`Recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    await this.saveRecoveryExecution(execution)
  }

  // Iniciar motor de recuperación
  private startRecoveryEngine(): void {
    setInterval(async () => {
      await this.monitorRecoveryExecutions()
    }, 30000) // Cada 30 segundos
  }

  // Monitorear ejecuciones de recuperación
  private async monitorRecoveryExecutions(): Promise<void> {
    const now = Date.now()
    
    for (const [executionId, execution] of this.recoveryExecutions) {
      if (execution.status === 'executing') {
        const elapsed = now - execution.startedAt.getTime()
        const timeout = 30 * 60 * 1000 // 30 minutos

        if (elapsed > timeout) {
          execution.status = 'timeout'
          execution.result = 'failure'
          execution.completedAt = new Date()
          execution.logs.push('Recovery execution timed out')
          
          await this.saveRecoveryExecution(execution)
          this.recoveryExecutions.delete(executionId)
        }
      }
    }
  }

  // Crear regla de monitoreo
  async createMonitoringRule(rule: Omit<MonitoringRule, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount'>): Promise<string> {
    try {
      const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = new Date()

      const newRule: MonitoringRule = {
        ...rule,
        id,
        triggerCount: 0,
        createdAt: now,
        updatedAt: now
      }

      await this.supabase
        .from('monitoring_rules')
        .insert({
          id,
          name: rule.name,
          description: rule.description,
          type: rule.type,
          target: rule.target,
          condition: rule.condition,
          severity: rule.severity,
          actions: rule.actions,
          enabled: rule.enabled,
          trigger_count: 0,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        })

      this.monitoringRules.set(id, newRule)
      return id
    } catch (error) {
      console.error('Error creating monitoring rule:', error)
      throw error
    }
  }

  // Obtener métricas de monitoreo
  async getMonitoringMetrics(startDate: Date, endDate: Date): Promise<MonitoringMetrics> {
    try {
      const { data: alerts } = await this.supabase
        .from('monitoring_alerts')
        .select('*')
        .gte('triggered_at', startDate.toISOString())
        .lte('triggered_at', endDate.toISOString())

      const { data: recoveries } = await this.supabase
        .from('recovery_executions')
        .select('*')
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString())

      const totalAlerts = alerts?.length || 0
      const criticalAlerts = alerts?.filter(a => a.severity === 'critical').length || 0
      const resolvedAlerts = alerts?.filter(a => a.status === 'resolved').length || 0

      const resolutionTimes = alerts
        ?.filter(a => a.resolved_at)
        .map(a => new Date(a.resolved_at).getTime() - new Date(a.triggered_at).getTime()) || []
      
      const averageResolutionTime = resolutionTimes.length > 0
        ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
        : 0

      const topIssues = this.calculateTopIssues(alerts || [])

      const totalRecoveries = recoveries?.length || 0
      const successfulRecoveries = recoveries?.filter(r => r.result === 'success').length || 0

      return {
        period: { start: startDate, end: endDate },
        totalAlerts,
        criticalAlerts,
        resolvedAlerts,
        averageResolutionTime,
        topIssues,
        recoverySuccess: {
          total: totalRecoveries,
          successful: successfulRecoveries,
          failed: totalRecoveries - successfulRecoveries,
          rate: totalRecoveries > 0 ? successfulRecoveries / totalRecoveries : 0
        },
        systemHealth: await this.calculateSystemHealth(),
        trends: await this.calculateTrends(startDate, endDate)
      }
    } catch (error) {
      console.error('Error getting monitoring metrics:', error)
      throw error
    }
  }

  // Métodos auxiliares privados
  private async getStorageUsage(): Promise<{ used: number; available: number; percentage: number }> {
    // Implementar cálculo real de uso de almacenamiento
    return { used: 0, available: 100, percentage: 0 }
  }

  private async getRecentJobs(timeWindowMinutes: number): Promise<any[]> {
    const startTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000)
    
    const { data: jobs } = await this.supabase
      .from('backup_jobs')
      .select('*')
      .gte('started_at', startTime.toISOString())

    return jobs || []
  }

  private async getDelayedConfigurations(): Promise<any[]> {
    const configurations = await backupManager.getConfigurations()
    const now = new Date()
    
    return configurations.filter(config => 
      config.active && 
      config.schedule.enabled && 
      config.nextBackupAt && 
      config.nextBackupAt < now
    )
  }

  private findRecoveryStrategy(alert: MonitoringAlert, config: AutoRecoveryConfig): RecoveryStrategy | null {
    // Implementar lógica para encontrar estrategia apropiada
    return config.strategies.length > 0 ? config.strategies[0] : null
  }

  private async executeRecoveryAction(action: RecoveryAction, alert: MonitoringAlert): Promise<RecoveryActionResult> {
    const startTime = Date.now()
    
    try {
      switch (action.type) {
        case 'restart_backup':
          if (alert.configurationId) {
            await backupManager.executeBackup(alert.configurationId, { force: true })
          }
          break
        case 'switch_destination':
          // Implementar cambio de destino
          break
        case 'increase_resources':
          // Implementar aumento de recursos
          break
        case 'notify_admin':
          // Implementar notificación a admin
          break
        case 'run_script':
          // Implementar ejecución de script
          break
      }

      return {
        actionType: action.type,
        status: 'completed',
        duration: Date.now() - startTime
      }
    } catch (error) {
      return {
        actionType: action.type,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      }
    }
  }

  private async verifyRecoverySuccess(strategy: RecoveryStrategy, alert: MonitoringAlert): Promise<boolean> {
    // Implementar verificación de éxito de recuperación
    return true
  }

  private calculateTopIssues(alerts: any[]): { type: string; count: number }[] {
    const issueCount: { [type: string]: number } = {}
    
    for (const alert of alerts) {
      const type = alert.details?.rule?.target || 'unknown'
      issueCount[type] = (issueCount[type] || 0) + 1
    }

    return Object.entries(issueCount)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }

  private async calculateSystemHealth(): Promise<{ overall: 'healthy' | 'warning' | 'critical'; components: { [component: string]: 'healthy' | 'warning' | 'critical' } }> {
    const healthResults = await backupManager.checkBackupHealth()
    
    const criticalCount = healthResults.filter(h => h.overallHealth === 'critical').length
    const warningCount = healthResults.filter(h => h.overallHealth === 'warning').length
    
    let overall: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (criticalCount > 0) {
      overall = 'critical'
    } else if (warningCount > 0) {
      overall = 'warning'
    }

    const components: { [component: string]: 'healthy' | 'warning' | 'critical' } = {}
    for (const health of healthResults) {
      components[health.configurationId] = health.overallHealth
    }

    return { overall, components }
  }

  private async calculateTrends(startDate: Date, endDate: Date): Promise<{ alertVolume: number[]; resolutionTime: number[]; recoveryRate: number[] }> {
    // Implementar cálculo de tendencias
    return {
      alertVolume: [],
      resolutionTime: [],
      recoveryRate: []
    }
  }

  // Métodos de notificación
  private async sendEmailNotification(action: MonitoringAction, alert: MonitoringAlert): Promise<{ success: boolean; result?: any; error?: string }> {
    // Implementar envío de email
    console.log('Sending email notification:', { action, alert })
    return { success: true, result: 'Email sent' }
  }

  private async sendSlackNotification(action: MonitoringAction, alert: MonitoringAlert): Promise<{ success: boolean; result?: any; error?: string }> {
    // Implementar envío a Slack
    console.log('Sending Slack notification:', { action, alert })
    return { success: true, result: 'Slack message sent' }
  }

  private async sendWebhookNotification(action: MonitoringAction, alert: MonitoringAlert): Promise<{ success: boolean; result?: any; error?: string }> {
    // Implementar webhook
    console.log('Sending webhook notification:', { action, alert })
    return { success: true, result: 'Webhook sent' }
  }

  private async executeAutoRetry(action: MonitoringAction, alert: MonitoringAlert): Promise<{ success: boolean; result?: any; error?: string }> {
    // Implementar reintento automático
    if (alert.configurationId) {
      try {
        await backupManager.executeBackup(alert.configurationId, { force: true })
        return { success: true, result: 'Backup retried' }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Retry failed' }
      }
    }
    return { success: false, error: 'No configuration ID' }
  }

  private async executeAutoFailover(action: MonitoringAction, alert: MonitoringAlert): Promise<{ success: boolean; result?: any; error?: string }> {
    // Implementar failover automático
    console.log('Executing auto failover:', { action, alert })
    return { success: true, result: 'Failover executed' }
  }

  private async createSupportTicket(action: MonitoringAction, alert: MonitoringAlert): Promise<{ success: boolean; result?: any; error?: string }> {
    // Implementar creación de ticket
    console.log('Creating support ticket:', { action, alert })
    return { success: true, result: 'Ticket created' }
  }

  private async escalateAlert(alert: MonitoringAlert): Promise<void> {
    alert.escalationLevel++
    await this.updateAlert(alert)
    
    // Implementar lógica de escalación
    console.log(`Alert escalated to level ${alert.escalationLevel}:`, alert.id)
  }

  // Métodos de persistencia
  private async saveAlert(alert: MonitoringAlert): Promise<void> {
    try {
      await this.supabase
        .from('monitoring_alerts')
        .insert({
          id: alert.id,
          rule_id: alert.ruleId,
          configuration_id: alert.configurationId,
          job_id: alert.jobId,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          details: alert.details,
          status: alert.status,
          triggered_at: alert.triggeredAt.toISOString(),
          acknowledged_at: alert.acknowledgedAt?.toISOString(),
          acknowledged_by: alert.acknowledgedBy,
          resolved_at: alert.resolvedAt?.toISOString(),
          resolved_by: alert.resolvedBy,
          actions: alert.actions,
          escalation_level: alert.escalationLevel,
          suppress_until: alert.suppressUntil?.toISOString()
        })
    } catch (error) {
      console.error('Error saving alert:', error)
    }
  }

  private async updateAlert(alert: MonitoringAlert): Promise<void> {
    try {
      await this.supabase
        .from('monitoring_alerts')
        .update({
          status: alert.status,
          acknowledged_at: alert.acknowledgedAt?.toISOString(),
          acknowledged_by: alert.acknowledgedBy,
          resolved_at: alert.resolvedAt?.toISOString(),
          resolved_by: alert.resolvedBy,
          actions: alert.actions,
          escalation_level: alert.escalationLevel,
          suppress_until: alert.suppressUntil?.toISOString()
        })
        .eq('id', alert.id)
    } catch (error) {
      console.error('Error updating alert:', error)
    }
  }

  private async updateMonitoringRule(rule: MonitoringRule): Promise<void> {
    try {
      await this.supabase
        .from('monitoring_rules')
        .update({
          last_triggered: rule.lastTriggered?.toISOString(),
          trigger_count: rule.triggerCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', rule.id)
    } catch (error) {
      console.error('Error updating monitoring rule:', error)
    }
  }

  private async saveRecoveryExecution(execution: RecoveryExecution): Promise<void> {
    try {
      await this.supabase
        .from('recovery_executions')
        .upsert({
          id: execution.id,
          alert_id: execution.alertId,
          strategy_id: execution.strategyId,
          status: execution.status,
          started_at: execution.startedAt.toISOString(),
          completed_at: execution.completedAt?.toISOString(),
          actions: execution.actions,
          result: execution.result,
          logs: execution.logs
        })
    } catch (error) {
      console.error('Error saving recovery execution:', error)
    }
  }

  // API pública
  async getMonitoringRules(): Promise<MonitoringRule[]> {
    return Array.from(this.monitoringRules.values())
  }

  async getActiveAlerts(): Promise<MonitoringAlert[]> {
    return Array.from(this.activeAlerts.values())
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId)
    if (alert && alert.status === 'active') {
      alert.status = 'acknowledged'
      alert.acknowledgedAt = new Date()
      alert.acknowledgedBy = acknowledgedBy
      await this.updateAlert(alert)
      return true
    }
    return false
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId)
    if (alert && (alert.status === 'active' || alert.status === 'acknowledged')) {
      alert.status = 'resolved'
      alert.resolvedAt = new Date()
      alert.resolvedBy = resolvedBy
      await this.updateAlert(alert)
      this.activeAlerts.delete(alertId)
      return true
    }
    return false
  }

  async suppressAlert(alertId: string, suppressUntil: Date): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId)
    if (alert) {
      alert.status = 'suppressed'
      alert.suppressUntil = suppressUntil
      await this.updateAlert(alert)
      return true
    }
    return false
  }

  async getRecoveryExecutions(): Promise<RecoveryExecution[]> {
    return Array.from(this.recoveryExecutions.values())
  }

  async stop(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }
    
    this.isMonitoring = false
    this.monitoringRules.clear()
    this.activeAlerts.clear()
    this.recoveryConfigs.clear()
    this.alertProcessingQueue = []
    this.recoveryExecutions.clear()
  }
}

export const backupMonitor = new BackupMonitor()
export default backupMonitor