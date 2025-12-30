import { createClient } from '@supabase/supabase-js'
import React from 'react'

// Interfaces para eventos en tiempo real
export interface RealTimeEvent {
  id: string
  type: 'sale' | 'inventory_change' | 'customer_action' | 'system_event'
  timestamp: Date
  data: Record<string, unknown>
  userId?: string
  sessionId?: string
}

export interface SaleEvent extends RealTimeEvent {
  type: 'sale'
  data: {
    saleId: string
    amount: number
    items: Array<{
      productId: string
      quantity: number
      price: number
    }>
    paymentMethod: string
    customerId?: string
  }
}

export interface InventoryEvent extends RealTimeEvent {
  type: 'inventory_change'
  data: {
    productId: string
    previousStock: number
    newStock: number
    changeType: 'sale' | 'restock' | 'adjustment' | 'return'
    reason?: string
  }
}

export interface CustomerEvent extends RealTimeEvent {
  type: 'customer_action'
  data: {
    customerId: string
    action: 'login' | 'purchase' | 'view_product' | 'add_to_cart' | 'checkout'
    productId?: string
    amount?: number
  }
}

export interface SystemEvent extends RealTimeEvent {
  type: 'system_event'
  data: {
    eventType: 'error' | 'warning' | 'info' | 'performance'
    message: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    component?: string
    metrics?: Record<string, number>
  }
}

// Métricas en tiempo real
export interface RealTimeMetrics {
  sales: {
    currentHourRevenue: number
    currentDayRevenue: number
    salesCount: number
    averageOrderValue: number
    topSellingProducts: Array<{
      productId: string
      name: string
      quantity: number
      revenue: number
    }>
  }
  inventory: {
    lowStockAlerts: Array<{
      productId: string
      name: string
      currentStock: number
      minimumStock: number
      severity: 'low' | 'critical'
    }>
    recentChanges: Array<{
      productId: string
      name: string
      change: number
      timestamp: Date
    }>
  }
  customers: {
    activeUsers: number
    newRegistrations: number
    conversionRate: number
    topCustomers: Array<{
      customerId: string
      name: string
      totalSpent: number
      ordersCount: number
    }>
  }
  system: {
    responseTime: number
    errorRate: number
    activeConnections: number
    cpuUsage: number
    memoryUsage: number
    alerts: Array<{
      type: string
      message: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      timestamp: Date
    }>
  }
}

// Configuración de alertas
export interface AlertRule {
  id: string
  name: string
  type: 'threshold' | 'anomaly' | 'pattern'
  metric: string
  condition: {
    operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'percentage_change'
    value: number
    timeWindow?: number // en minutos
  }
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  notifications: {
    email?: boolean
    sms?: boolean
    webhook?: string
  }
}

export interface Alert {
  id: string
  ruleId: string
  ruleName: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
  acknowledged: boolean
  resolvedAt?: Date
  data: Record<string, unknown>
}

// Clase principal del motor de analytics en tiempo real
export class RealTimeAnalyticsEngine {
  private supabase: ReturnType<typeof createClient> | null = null
  private eventListeners: Map<string, Array<(event: RealTimeEvent) => void>> = new Map()
  private metricsCache: RealTimeMetrics | null = null
  private alertRules: AlertRule[] = []
  private activeAlerts: Alert[] = []
  private updateInterval: NodeJS.Timeout | null = null
  private websocketConnections: Set<WebSocket> = new Set()

  constructor() {
    // Inicializar Supabase (en un entorno real)
    if (typeof window !== 'undefined') {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      )
    }
    
    this.initializeDefaultAlertRules()
    this.startMetricsCollection()
  }

  // Inicializar reglas de alerta por defecto
  private initializeDefaultAlertRules() {
    this.alertRules = [
      {
        id: 'low-stock-critical',
        name: 'Stock Crítico',
        type: 'threshold',
        metric: 'inventory.stock_level',
        condition: {
          operator: 'less_than',
          value: 5
        },
        severity: 'critical',
        enabled: true,
        notifications: {
          email: true,
          sms: true
        }
      },
      {
        id: 'high-error-rate',
        name: 'Tasa de Error Alta',
        type: 'threshold',
        metric: 'system.error_rate',
        condition: {
          operator: 'greater_than',
          value: 5,
          timeWindow: 5
        },
        severity: 'high',
        enabled: true,
        notifications: {
          email: true
        }
      },
      {
        id: 'sales-spike',
        name: 'Pico de Ventas',
        type: 'anomaly',
        metric: 'sales.hourly_revenue',
        condition: {
          operator: 'percentage_change',
          value: 200,
          timeWindow: 60
        },
        severity: 'medium',
        enabled: true,
        notifications: {
          email: true
        }
      },
      {
        id: 'system-performance',
        name: 'Rendimiento del Sistema',
        type: 'threshold',
        metric: 'system.response_time',
        condition: {
          operator: 'greater_than',
          value: 2000
        },
        severity: 'high',
        enabled: true,
        notifications: {
          email: true
        }
      }
    ]
  }

  // Iniciar recolección de métricas
  private startMetricsCollection() {
    this.updateInterval = setInterval(() => {
      this.updateRealTimeMetrics()
    }, 5000) // Actualizar cada 5 segundos
  }

  // Detener recolección de métricas
  public stopMetricsCollection() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }

  // Registrar evento en tiempo real
  public async recordEvent(event: Omit<RealTimeEvent, 'id' | 'timestamp'>) {
    const fullEvent: RealTimeEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date()
    }

    // Procesar evento
    await this.processEvent(fullEvent)

    // Notificar a listeners
    this.notifyEventListeners(fullEvent)

    // Actualizar métricas
    this.updateMetricsFromEvent(fullEvent)

    // Verificar alertas
    this.checkAlerts(fullEvent)

    return fullEvent
  }

  // Procesar evento
  private async processEvent(event: RealTimeEvent) {
    try {
      // En un entorno real, guardar en base de datos
      if (this.supabase) {
        await this.supabase
          .from('real_time_events')
          .insert({
            id: event.id,
            type: event.type,
            timestamp: event.timestamp.toISOString(),
            data: event.data,
            user_id: event.userId,
            session_id: event.sessionId
          })
      }

      // Procesar según tipo de evento
      switch (event.type) {
        case 'sale':
          await this.processSaleEvent(event as SaleEvent)
          break
        case 'inventory_change':
          await this.processInventoryEvent(event as InventoryEvent)
          break
        case 'customer_action':
          await this.processCustomerEvent(event as CustomerEvent)
          break
        case 'system_event':
          await this.processSystemEvent(event as SystemEvent)
          break
      }
    } catch (error) {
      console.error('Error processing event:', error)
    }
  }

  // Procesar evento de venta
  private async processSaleEvent(event: SaleEvent) {
    // Actualizar métricas de ventas
    // Actualizar inventario
    // Actualizar métricas de cliente
    console.log('Processing sale event:', event)
  }

  // Procesar evento de inventario
  private async processInventoryEvent(event: InventoryEvent) {
    // Verificar niveles de stock
    // Generar alertas si es necesario
    console.log('Processing inventory event:', event)
  }

  // Procesar evento de cliente
  private async processCustomerEvent(event: CustomerEvent) {
    // Actualizar métricas de actividad
    // Actualizar segmentación
    console.log('Processing customer event:', event)
  }

  // Procesar evento del sistema
  private async processSystemEvent(event: SystemEvent) {
    // Monitorear rendimiento
    // Generar alertas críticas
    console.log('Processing system event:', event)
  }

  // Actualizar métricas desde evento
  private updateMetricsFromEvent(event: RealTimeEvent) {
    // Actualizar métricas basadas en el evento
    // En una implementación real, esto actualizaría el cache de métricas
    console.log('Updating metrics from event:', event.type)
  }

  // Actualizar métricas en tiempo real
  private async updateRealTimeMetrics() {
    try {
      const now = new Date()
      const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours())
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      // Simular datos en tiempo real (en producción vendría de la base de datos)
      this.metricsCache = {
        sales: {
          currentHourRevenue: Math.random() * 5000 + 1000,
          currentDayRevenue: Math.random() * 50000 + 10000,
          salesCount: Math.floor(Math.random() * 100) + 20,
          averageOrderValue: Math.random() * 200 + 50,
          topSellingProducts: [
            {
              productId: '1',
              name: 'Producto A',
              quantity: Math.floor(Math.random() * 50) + 10,
              revenue: Math.random() * 2000 + 500
            },
            {
              productId: '2',
              name: 'Producto B',
              quantity: Math.floor(Math.random() * 40) + 8,
              revenue: Math.random() * 1500 + 400
            }
          ]
        },
        inventory: {
          lowStockAlerts: [
            {
              productId: '3',
              name: 'Producto C',
              currentStock: Math.floor(Math.random() * 5) + 1,
              minimumStock: 10,
              severity: 'critical' as const
            }
          ],
          recentChanges: [
            {
              productId: '1',
              name: 'Producto A',
              change: -Math.floor(Math.random() * 10) - 1,
              timestamp: new Date()
            }
          ]
        },
        customers: {
          activeUsers: Math.floor(Math.random() * 100) + 50,
          newRegistrations: Math.floor(Math.random() * 10) + 1,
          conversionRate: Math.random() * 10 + 2,
          topCustomers: [
            {
              customerId: '1',
              name: 'Cliente VIP',
              totalSpent: Math.random() * 5000 + 1000,
              ordersCount: Math.floor(Math.random() * 20) + 5
            }
          ]
        },
        system: {
          responseTime: Math.random() * 500 + 100,
          errorRate: Math.random() * 2,
          activeConnections: Math.floor(Math.random() * 200) + 50,
          cpuUsage: Math.random() * 80 + 10,
          memoryUsage: Math.random() * 70 + 20,
          alerts: this.activeAlerts.slice(0, 5)
        }
      }

      // Notificar a listeners de métricas
      this.notifyMetricsUpdate()
    } catch (error) {
      console.error('Error updating real-time metrics:', error)
    }
  }

  // Verificar alertas
  private checkAlerts(event: RealTimeEvent) {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue

      const shouldTrigger = this.evaluateAlertRule(rule, event)
      if (shouldTrigger) {
        this.triggerAlert(rule, event)
      }
    }
  }

  // Evaluar regla de alerta
  private evaluateAlertRule(rule: AlertRule, event: RealTimeEvent): boolean {
    // Lógica simplificada para evaluación de reglas
    // En producción sería más compleja
    
    if (rule.type === 'threshold') {
      // Evaluar umbrales
      return Math.random() < 0.1 // 10% de probabilidad para demo
    }
    
    if (rule.type === 'anomaly') {
      // Detectar anomalías
      return Math.random() < 0.05 // 5% de probabilidad para demo
    }
    
    return false
  }

  // Disparar alerta
  private triggerAlert(rule: AlertRule, event: RealTimeEvent) {
    const alert: Alert = {
      id: this.generateEventId(),
      ruleId: rule.id,
      ruleName: rule.name,
      message: `Alerta: ${rule.name} - ${this.generateAlertMessage(rule, event)}`,
      severity: rule.severity,
      timestamp: new Date(),
      acknowledged: false,
      data: event.data
    }

    this.activeAlerts.unshift(alert)
    
    // Mantener solo las últimas 100 alertas
    if (this.activeAlerts.length > 100) {
      this.activeAlerts = this.activeAlerts.slice(0, 100)
    }

    // Enviar notificaciones
    this.sendAlertNotifications(alert, rule)
  }

  // Generar mensaje de alerta
  private generateAlertMessage(rule: AlertRule, event: RealTimeEvent): string {
    switch (rule.id) {
      case 'low-stock-critical':
        return 'Stock crítico detectado'
      case 'high-error-rate':
        return 'Tasa de error elevada en el sistema'
      case 'sales-spike':
        return 'Pico inusual de ventas detectado'
      case 'system-performance':
        return 'Degradación del rendimiento del sistema'
      default:
        return 'Condición de alerta activada'
    }
  }

  // Enviar notificaciones de alerta
  private async sendAlertNotifications(alert: Alert, rule: AlertRule) {
    try {
      if (rule.notifications.email) {
        // Enviar email (implementar con servicio de email)
        console.log('Sending email notification for alert:', alert.message)
      }

      if (rule.notifications.sms) {
        // Enviar SMS (implementar con servicio de SMS)
        console.log('Sending SMS notification for alert:', alert.message)
      }

      if (rule.notifications.webhook) {
        // Enviar webhook
        console.log('Sending webhook notification for alert:', alert.message)
      }

      // Notificar a través de WebSocket
      this.broadcastAlert(alert)
    } catch (error) {
      console.error('Error sending alert notifications:', error)
    }
  }

  // Transmitir alerta por WebSocket
  private broadcastAlert(alert: Alert) {
    const message = JSON.stringify({
      type: 'alert',
      data: alert
    })

    this.websocketConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
      }
    })
  }

  // Registrar listener de eventos
  public addEventListener(eventType: string, listener: (event: RealTimeEvent) => void) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, [])
    }
    const eventListeners = this.eventListeners.get(eventType)!
    eventListeners.push(listener)
  }

  // Remover listener de eventos
  public removeEventListener(eventType: string, listener: (event: RealTimeEvent) => void) {
    const eventListeners = this.eventListeners.get(eventType)
    if (eventListeners) {
      const index = eventListeners.indexOf(listener)
      if (index > -1) {
        eventListeners.splice(index, 1)
      }
    }
  }

  // Notificar a listeners de eventos
  private notifyEventListeners(event: RealTimeEvent) {
    const listeners = this.eventListeners.get(event.type) || []
    const wildcard = this.eventListeners.get('*') || []

    const allListeners = ([] as Array<(event: RealTimeEvent) => void>).concat(listeners, wildcard)
    allListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in event listener:', error)
      }
    })
  }

  // Notificar actualización de métricas
  private notifyMetricsUpdate() {
    const metricsListeners = this.eventListeners.get('metrics_update') || []
    metricsListeners.forEach(listener => {
      try {
        listener({
          id: this.generateEventId(),
          type: 'system_event',
          timestamp: new Date(),
          data: this.metricsCache
        } as RealTimeEvent)
      } catch (error) {
        console.error('Error in metrics listener:', error)
      }
    })
  }

  // Obtener métricas actuales
  public getCurrentMetrics(): RealTimeMetrics | null {
    return this.metricsCache
  }

  // Obtener alertas activas
  public getActiveAlerts(): Alert[] {
    return [...this.activeAlerts]
  }

  // Reconocer alerta
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      return true
    }
    return false
  }

  // Resolver alerta
  public resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolvedAt = new Date()
      return true
    }
    return false
  }

  // Agregar conexión WebSocket
  public addWebSocketConnection(ws: WebSocket) {
    this.websocketConnections.add(ws)
    
    ws.onclose = () => {
      this.websocketConnections.delete(ws)
    }
  }

  // Generar ID único para eventos
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Limpiar recursos
  public cleanup() {
    this.stopMetricsCollection()
    this.eventListeners.clear()
    this.websocketConnections.clear()
  }
}

// Instancia singleton del motor de analytics
export const realTimeAnalytics = new RealTimeAnalyticsEngine()

// Hook para usar analytics en tiempo real en React
export function useRealTimeAnalytics() {
  const [metrics, setMetrics] = React.useState<RealTimeMetrics | null>(null)
  const [alerts, setAlerts] = React.useState<Alert[]>([])
  const [connected, setConnected] = React.useState(false)

  React.useEffect(() => {
    // Listener para actualizaciones de métricas
    const metricsListener = (event: RealTimeEvent) => {
      if (event.type === 'system_event' && event.data) {
        setMetrics(event.data)
      }
    }

    // Listener para alertas
    const alertListener = (event: RealTimeEvent) => {
      if (event.type === 'system_event') {
        setAlerts(realTimeAnalytics.getActiveAlerts())
      }
    }

    realTimeAnalytics.addEventListener('metrics_update', metricsListener)
    realTimeAnalytics.addEventListener('*', alertListener)

    // Obtener datos iniciales
    setMetrics(realTimeAnalytics.getCurrentMetrics())
    setAlerts(realTimeAnalytics.getActiveAlerts())
    setConnected(true)

    return () => {
      realTimeAnalytics.removeEventListener('metrics_update', metricsListener)
      realTimeAnalytics.removeEventListener('*', alertListener)
    }
  }, [])

  const recordEvent = React.useCallback((event: Omit<RealTimeEvent, 'id' | 'timestamp'>) => {
    return realTimeAnalytics.recordEvent(event)
  }, [])

  const acknowledgeAlert = React.useCallback((alertId: string) => {
    const success = realTimeAnalytics.acknowledgeAlert(alertId)
    if (success) {
      setAlerts(realTimeAnalytics.getActiveAlerts())
    }
    return success
  }, [])

  const resolveAlert = React.useCallback((alertId: string) => {
    const success = realTimeAnalytics.resolveAlert(alertId)
    if (success) {
      setAlerts(realTimeAnalytics.getActiveAlerts())
    }
    return success
  }, [])

  return {
    metrics,
    alerts,
    connected,
    recordEvent,
    acknowledgeAlert,
    resolveAlert
  }
}

// Exportar tipos
export type {
  RealTimeEvent,
  SaleEvent,
  InventoryEvent,
  CustomerEvent,
  SystemEvent,
  RealTimeMetrics,
  AlertRule,
  Alert
}
