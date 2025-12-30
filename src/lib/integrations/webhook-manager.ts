'use client'

import { createClient } from '@/lib/supabase/client'
import crypto from 'crypto'

// Interfaces para manejo de webhooks
export interface WebhookEndpoint {
  id: string
  name: string
  url: string
  method: 'POST' | 'PUT' | 'PATCH'
  secret: string
  active: boolean
  events: string[]
  headers: Record<string, string>
  timeout: number
  retryAttempts: number
  retryDelay: number
  filters: WebhookFilter[]
  transformations: WebhookTransformation[]
  rateLimiting: WebhookRateLimit
  createdAt: Date
  updatedAt: Date
}

export interface WebhookFilter {
  id: string
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'regex' | 'exists' | 'not_exists'
  value: string
  caseSensitive: boolean
}

export interface WebhookTransformation {
  id: string
  field: string
  action: 'rename' | 'remove' | 'add' | 'modify' | 'format'
  target?: string
  value?: unknown
  script?: string // JavaScript code for custom transformations
}

export interface WebhookRateLimit {
  enabled: boolean
  requestsPerSecond: number
  requestsPerMinute: number
  requestsPerHour: number
  burstLimit: number
}

export interface IncomingWebhook {
  id: string
  endpointId: string
  event: string
  payload: Record<string, unknown>
  headers: Record<string, string>
  sourceIP: string
  userAgent: string
  timestamp: Date
  signature?: string
  verified: boolean
  processed: boolean
  processedAt?: Date
  response?: Record<string, unknown>
  error?: string
  retryCount: number
  nextRetryAt?: Date
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  targetUrl: string
  event: string
  payload: Record<string, unknown>
  headers: Record<string, string>
  timestamp: Date
  status: 'pending' | 'delivered' | 'failed' | 'cancelled'
  statusCode?: number
  response?: Record<string, unknown>
  error?: string
  attempts: WebhookAttempt[]
  nextAttemptAt?: Date
}

export interface WebhookAttempt {
  id: string
  deliveryId: string
  attemptNumber: number
  timestamp: Date
  statusCode?: number
  response?: Record<string, unknown>
  error?: string
  duration: number
}

export interface WebhookSubscription {
  id: string
  userId: string
  endpointUrl: string
  events: string[]
  secret: string
  active: boolean
  filters: WebhookFilter[]
  createdAt: Date
  updatedAt: Date
}

export interface WebhookEvent {
  id: string
  type: string
  data: Record<string, unknown>
  timestamp: Date
  source: string
  version: string
  metadata: Record<string, unknown>
}

export interface WebhookStats {
  endpointId: string
  period: {
    start: Date
    end: Date
  }
  totalReceived: number
  totalProcessed: number
  totalFailed: number
  totalRetries: number
  avgProcessingTime: number
  successRate: number
  errorRate: number
  topEvents: { event: string; count: number }[]
  topErrors: { error: string; count: number }[]
  hourlyDistribution: { hour: number; count: number }[]
}

class WebhookManager {
  private supabase = createClient()
  private endpoints: Map<string, WebhookEndpoint> = new Map()
  private rateLimiters: Map<string, Map<string, number[]>> = new Map() // endpointId -> IP -> timestamps
  private processingQueue: IncomingWebhook[] = []
  private deliveryQueue: WebhookDelivery[] = []
  private isProcessing = false

  // Inicializar manager
  async initialize(): Promise<void> {
    await this.loadEndpoints()
    this.startProcessingLoop()
    this.startDeliveryLoop()
    this.startCleanupLoop()
  }

  // Cargar endpoints desde la base de datos
  private async loadEndpoints(): Promise<void> {
    try {
      const { data: endpoints } = await this.supabase
        .from('webhook_endpoints')
        .select('*')
        .eq('active', true)

      if (endpoints) {
        for (const endpoint of endpoints) {
          this.endpoints.set(endpoint.id, {
            ...endpoint,
            createdAt: new Date(endpoint.created_at),
            updatedAt: new Date(endpoint.updated_at)
          })
        }
      }
    } catch (error) {
      console.error('Error loading webhook endpoints:', error)
    }
  }

  // Registrar nuevo endpoint
  async registerEndpoint(endpoint: Omit<WebhookEndpoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const id = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = new Date()

      const newEndpoint: WebhookEndpoint = {
        ...endpoint,
        id,
        createdAt: now,
        updatedAt: now
      }

      // Guardar en base de datos
      await this.supabase
        .from('webhook_endpoints')
        .insert({
          id,
          name: endpoint.name,
          url: endpoint.url,
          method: endpoint.method,
          secret: endpoint.secret,
          active: endpoint.active,
          events: endpoint.events,
          headers: endpoint.headers,
          timeout: endpoint.timeout,
          retry_attempts: endpoint.retryAttempts,
          retry_delay: endpoint.retryDelay,
          filters: endpoint.filters,
          transformations: endpoint.transformations,
          rate_limiting: endpoint.rateLimiting,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        })

      // Agregar a memoria
      this.endpoints.set(id, newEndpoint)

      return id
    } catch (error) {
      console.error('Error registering webhook endpoint:', error)
      throw error
    }
  }

  // Recibir webhook entrante
  async receiveWebhook(
    endpointId: string,
    event: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
    sourceIP: string,
    userAgent: string
  ): Promise<{ success: boolean; message: string; webhookId?: string }> {
    try {
      const endpoint = this.endpoints.get(endpointId)
      if (!endpoint) {
        return { success: false, message: 'Endpoint not found' }
      }

      if (!endpoint.active) {
        return { success: false, message: 'Endpoint is inactive' }
      }

      // Verificar rate limiting
      if (!this.checkRateLimit(endpointId, sourceIP, endpoint.rateLimiting)) {
        return { success: false, message: 'Rate limit exceeded' }
      }

      // Verificar evento permitido
      if (endpoint.events.length > 0 && !endpoint.events.includes(event)) {
        return { success: false, message: 'Event not allowed' }
      }

      // Verificar firma si está configurada
      let verified = true
      if (endpoint.secret) {
        const signature = headers['x-signature'] || headers['x-hub-signature'] || headers['signature']
        verified = this.verifySignature(payload, endpoint.secret, signature)
        if (!verified) {
          return { success: false, message: 'Invalid signature' }
        }
      }

      // Crear webhook entrante
      const webhookId = `wh_in_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const incomingWebhook: IncomingWebhook = {
        id: webhookId,
        endpointId,
        event,
        payload,
        headers,
        sourceIP,
        userAgent,
        timestamp: new Date(),
        signature: headers['x-signature'] || headers['x-hub-signature'],
        verified,
        processed: false,
        retryCount: 0
      }

      // Guardar webhook
      await this.saveIncomingWebhook(incomingWebhook)

      // Agregar a cola de procesamiento
      this.processingQueue.push(incomingWebhook)

      return { success: true, message: 'Webhook received', webhookId }
    } catch (error) {
      console.error('Error receiving webhook:', error)
      return { success: false, message: 'Internal error' }
    }
  }

  // Procesar webhook
  async processWebhook(webhook: IncomingWebhook): Promise<void> {
    const endpoint = this.endpoints.get(webhook.endpointId)
    if (!endpoint) {
      throw new Error('Endpoint not found')
    }

    try {
      // Aplicar filtros
      if (!this.passesFilters(webhook.payload, endpoint.filters)) {
        webhook.processed = true
        webhook.processedAt = new Date()
        await this.updateIncomingWebhook(webhook)
        return
      }

      // Aplicar transformaciones
      const transformedPayload = this.applyTransformations(webhook.payload, endpoint.transformations)

      // Procesar según el tipo de evento
      await this.handleWebhookEvent(webhook.event, transformedPayload, webhook)

      // Marcar como procesado
      webhook.processed = true
      webhook.processedAt = new Date()
      await this.updateIncomingWebhook(webhook)

    } catch (error) {
      webhook.error = error instanceof Error ? error.message : 'Unknown error'
      webhook.retryCount++

      // Programar reintento si no se han agotado los intentos
      if (webhook.retryCount < endpoint.retryAttempts) {
        webhook.nextRetryAt = new Date(Date.now() + endpoint.retryDelay * webhook.retryCount * 1000)
        this.processingQueue.push(webhook)
      }

      await this.updateIncomingWebhook(webhook)
      throw error
    }
  }

  // Enviar webhook saliente
  async sendWebhook(
    targetUrl: string,
    event: string,
    payload: Record<string, unknown>,
    options?: {
      headers?: Record<string, string>
      secret?: string
      timeout?: number
      retryAttempts?: number
    }
  ): Promise<string> {
    const deliveryId = `wh_out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const delivery: WebhookDelivery = {
      id: deliveryId,
      webhookId: `webhook_${Date.now()}`,
      targetUrl,
      event,
      payload,
      headers: options?.headers || {},
      timestamp: new Date(),
      status: 'pending',
      attempts: []
    }

    // Agregar firma si se proporciona secret
    if (options?.secret) {
      const signature = this.generateSignature(payload, options.secret)
      delivery.headers['X-Signature'] = signature
    }

    // Guardar delivery
    await this.saveWebhookDelivery(delivery)

    // Agregar a cola de entrega
    this.deliveryQueue.push(delivery)

    return deliveryId
  }

  // Entregar webhook
  async deliverWebhook(delivery: WebhookDelivery): Promise<void> {
    const attemptId = `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()

    const attempt: WebhookAttempt = {
      id: attemptId,
      deliveryId: delivery.id,
      attemptNumber: delivery.attempts.length + 1,
      timestamp: new Date(),
      duration: 0
    }

    try {
      // Preparar headers
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Webhook-Delivery/1.0',
        ...delivery.headers
      }

      // Realizar request
      const response = await fetch(delivery.targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(delivery.payload),
        signal: AbortSignal.timeout(30000) // 30 segundos timeout
      })

      attempt.duration = Date.now() - startTime
      attempt.statusCode = response.status

      try {
        attempt.response = await response.text()
      } catch {
        attempt.response = 'No response body'
      }

      if (response.ok) {
        delivery.status = 'delivered'
        delivery.statusCode = response.status
        delivery.response = attempt.response
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

    } catch (error) {
      attempt.duration = Date.now() - startTime
      attempt.error = error instanceof Error ? error.message : 'Unknown error'
      
      delivery.error = attempt.error
      
      // Determinar si se debe reintentar
      const maxAttempts = 3
      if (delivery.attempts.length < maxAttempts) {
        delivery.status = 'pending'
        delivery.nextAttemptAt = new Date(Date.now() + Math.pow(2, delivery.attempts.length) * 60000) // Backoff exponencial
        this.deliveryQueue.push(delivery)
      } else {
        delivery.status = 'failed'
      }
    }

    delivery.attempts.push(attempt)
    await this.updateWebhookDelivery(delivery)
  }

  // Suscribir usuario a webhooks
  async subscribeUser(
    userId: string,
    endpointUrl: string,
    events: string[],
    filters?: WebhookFilter[]
  ): Promise<string> {
    try {
      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const secret = crypto.randomBytes(32).toString('hex')

      const subscription: WebhookSubscription = {
        id: subscriptionId,
        userId,
        endpointUrl,
        events,
        secret,
        active: true,
        filters: filters || [],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await this.supabase
        .from('webhook_subscriptions')
        .insert({
          id: subscriptionId,
          user_id: userId,
          endpoint_url: endpointUrl,
          events,
          secret,
          active: true,
          filters: filters || [],
          created_at: subscription.createdAt.toISOString(),
          updated_at: subscription.updatedAt.toISOString()
        })

      return subscriptionId
    } catch (error) {
      console.error('Error subscribing user to webhooks:', error)
      throw error
    }
  }

  // Obtener estadísticas de webhook
  async getWebhookStats(endpointId: string, startDate: Date, endDate: Date): Promise<WebhookStats> {
    try {
      const { data: webhooks } = await this.supabase
        .from('incoming_webhooks')
        .select('*')
        .eq('endpoint_id', endpointId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())

      if (!webhooks) {
        throw new Error('No webhook data found')
      }

      const totalReceived = webhooks.length
      const totalProcessed = webhooks.filter(w => w.processed).length
      const totalFailed = webhooks.filter(w => w.error).length
      const totalRetries = webhooks.reduce((sum, w) => sum + (w.retry_count || 0), 0)

      const processingTimes = webhooks
        .filter(w => w.processed_at && w.timestamp)
        .map(w => new Date(w.processed_at).getTime() - new Date(w.timestamp).getTime())
      
      const avgProcessingTime = processingTimes.length > 0 
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
        : 0

      const successRate = totalReceived > 0 ? (totalProcessed - totalFailed) / totalReceived : 0
      const errorRate = totalReceived > 0 ? totalFailed / totalReceived : 0

      // Top eventos
      const eventCounts: { [event: string]: number } = {}
      webhooks.forEach(w => {
        eventCounts[w.event] = (eventCounts[w.event] || 0) + 1
      })
      const topEvents = Object.entries(eventCounts)
        .map(([event, count]) => ({ event, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // Top errores
      const errorCounts: { [error: string]: number } = {}
      webhooks.filter(w => w.error).forEach(w => {
        errorCounts[w.error] = (errorCounts[w.error] || 0) + 1
      })
      const topErrors = Object.entries(errorCounts)
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // Distribución por hora
      const hourlyDistribution: { [hour: number]: number } = {}
      webhooks.forEach(w => {
        const hour = new Date(w.timestamp).getHours()
        hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1
      })
      const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: hourlyDistribution[hour] || 0
      }))

      return {
        endpointId,
        period: { start: startDate, end: endDate },
        totalReceived,
        totalProcessed,
        totalFailed,
        totalRetries,
        avgProcessingTime,
        successRate,
        errorRate,
        topEvents,
        topErrors,
        hourlyDistribution: hourlyData
      }
    } catch (error) {
      console.error('Error getting webhook stats:', error)
      throw error
    }
  }

  // Métodos auxiliares privados
  private checkRateLimit(endpointId: string, sourceIP: string, rateLimit: WebhookRateLimit): boolean {
    if (!rateLimit.enabled) return true

    const now = Date.now()
    
    if (!this.rateLimiters.has(endpointId)) {
      this.rateLimiters.set(endpointId, new Map())
    }

    const endpointLimiters = this.rateLimiters.get(endpointId)!
    
    if (!endpointLimiters.has(sourceIP)) {
      endpointLimiters.set(sourceIP, [])
    }

    const requests = endpointLimiters.get(sourceIP)!
    
    // Limpiar requests antiguos
    const oneMinuteAgo = now - 60000
    const oneHourAgo = now - 3600000
    
    const recentRequests = requests.filter(timestamp => timestamp > oneMinuteAgo)
    const hourlyRequests = requests.filter(timestamp => timestamp > oneHourAgo)

    // Verificar límites
    if (recentRequests.length >= rateLimit.requestsPerMinute) return false
    if (hourlyRequests.length >= rateLimit.requestsPerHour) return false

    // Registrar request
    requests.push(now)
    endpointLimiters.set(sourceIP, requests.slice(-rateLimit.requestsPerHour))

    return true
  }

  private verifySignature(payload: Record<string, unknown>, secret: string, signature?: string): boolean {
    if (!signature) return false

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex')

    // Soportar diferentes formatos de firma
    const cleanSignature = signature.replace(/^(sha256=|sha1=)/, '')
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(cleanSignature, 'hex')
    )
  }

  private generateSignature(payload: Record<string, unknown>, secret: string): string {
    return 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex')
  }

  private passesFilters(payload: Record<string, unknown>, filters: WebhookFilter[]): boolean {
    return filters.every(filter => {
      const value = this.getNestedValue(payload, filter.field)
      
      switch (filter.operator) {
        case 'exists':
          return value !== undefined && value !== null
        case 'not_exists':
          return value === undefined || value === null
        case 'equals':
          return this.compareValues(value, filter.value, filter.caseSensitive) === 0
        case 'not_equals':
          return this.compareValues(value, filter.value, filter.caseSensitive) !== 0
        case 'contains':
          return String(value).toLowerCase().includes(filter.value.toLowerCase())
        case 'not_contains':
          return !String(value).toLowerCase().includes(filter.value.toLowerCase())
        case 'starts_with':
          return String(value).toLowerCase().startsWith(filter.value.toLowerCase())
        case 'ends_with':
          return String(value).toLowerCase().endsWith(filter.value.toLowerCase())
        case 'regex':
          return new RegExp(filter.value, filter.caseSensitive ? '' : 'i').test(String(value))
        default:
          return false
      }
    })
  }

  private applyTransformations(payload: Record<string, unknown>, transformations: WebhookTransformation[]): Record<string, unknown> {
    const result = JSON.parse(JSON.stringify(payload)) // Deep clone

    for (const transformation of transformations) {
      switch (transformation.action) {
        case 'rename':
          if (transformation.target) {
            const value = this.getNestedValue(result, transformation.field)
            this.setNestedValue(result, transformation.target, value)
            this.deleteNestedValue(result, transformation.field)
          }
          break
        case 'remove':
          this.deleteNestedValue(result, transformation.field)
          break
        case 'add':
          this.setNestedValue(result, transformation.field, transformation.value)
          break
        case 'modify':
          if (transformation.script) {
            try {
              const currentValue = this.getNestedValue(result, transformation.field)
              const func = new Function('value', 'payload', transformation.script)
              const newValue = func(currentValue, result)
              this.setNestedValue(result, transformation.field, newValue)
            } catch (error) {
              console.error('Transformation script error:', error)
            }
          }
          break
        case 'format':
          const value = this.getNestedValue(result, transformation.field)
          if (value !== undefined && transformation.value) {
            // Aplicar formato específico (fecha, número, etc.)
            const formattedValue = this.formatValue(value, transformation.value)
            this.setNestedValue(result, transformation.field, formattedValue)
          }
          break
      }
    }

    return result
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {}
      return current[key]
    }, obj)
    target[lastKey] = value
  }

  private deleteNestedValue(obj: Record<string, unknown>, path: string): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current, key) => current?.[key], obj)
    if (target) {
      delete target[lastKey]
    }
  }

  private compareValues(a: unknown, b: unknown, caseSensitive: boolean): number {
    const strA = String(a)
    const strB = String(b)
    
    if (caseSensitive) {
      return strA.localeCompare(strB)
    } else {
      return strA.toLowerCase().localeCompare(strB.toLowerCase())
    }
  }

  private formatValue(value: unknown, format: string): unknown {
    switch (format) {
      case 'date':
        return new Date(value).toISOString()
      case 'number':
        return Number(value)
      case 'string':
        return String(value)
      case 'boolean':
        return Boolean(value)
      case 'uppercase':
        return String(value).toUpperCase()
      case 'lowercase':
        return String(value).toLowerCase()
      default:
        return value
    }
  }

  private async handleWebhookEvent(event: string, payload: Record<string, unknown>, webhook: IncomingWebhook): Promise<void> {
    // Implementar lógica específica según el tipo de evento
    console.log(`Handling webhook event: ${event}`, payload)
    
    // Ejemplo: notificar a suscriptores
    await this.notifySubscribers(event, payload)
  }

  private async notifySubscribers(event: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const { data: subscriptions } = await this.supabase
        .from('webhook_subscriptions')
        .select('*')
        .eq('active', true)
        .contains('events', [event])

      if (subscriptions) {
        for (const subscription of subscriptions) {
          // Aplicar filtros de suscripción
          if (this.passesFilters(payload, subscription.filters)) {
            await this.sendWebhook(
              subscription.endpoint_url,
              event,
              payload,
              { secret: subscription.secret }
            )
          }
        }
      }
    } catch (error) {
      console.error('Error notifying subscribers:', error)
    }
  }

  // Loops de procesamiento
  private startProcessingLoop(): void {
    setInterval(async () => {
      if (this.isProcessing || this.processingQueue.length === 0) return

      this.isProcessing = true
      
      try {
        const webhook = this.processingQueue.shift()
        if (webhook) {
          await this.processWebhook(webhook)
        }
      } catch (error) {
        console.error('Error processing webhook:', error)
      } finally {
        this.isProcessing = false
      }
    }, 1000) // Procesar cada segundo
  }

  private startDeliveryLoop(): void {
    setInterval(async () => {
      const now = new Date()
      const readyDeliveries = this.deliveryQueue.filter(d => 
        d.status === 'pending' && (!d.nextAttemptAt || d.nextAttemptAt <= now)
      )

      for (const delivery of readyDeliveries) {
        try {
          await this.deliverWebhook(delivery)
          // Remover de la cola si se entregó exitosamente o falló definitivamente
          if (delivery.status === 'delivered' || delivery.status === 'failed') {
            const index = this.deliveryQueue.indexOf(delivery)
            if (index > -1) {
              this.deliveryQueue.splice(index, 1)
            }
          }
        } catch (error) {
          console.error('Error delivering webhook:', error)
        }
      }
    }, 5000) // Verificar cada 5 segundos
  }

  private startCleanupLoop(): void {
    setInterval(() => {
      // Limpiar rate limiters antiguos
      const oneHourAgo = Date.now() - 3600000
      for (const [endpointId, ipLimiters] of this.rateLimiters) {
        for (const [ip, requests] of ipLimiters) {
          const recentRequests = requests.filter(timestamp => timestamp > oneHourAgo)
          if (recentRequests.length === 0) {
            ipLimiters.delete(ip)
          } else {
            ipLimiters.set(ip, recentRequests)
          }
        }
        if (ipLimiters.size === 0) {
          this.rateLimiters.delete(endpointId)
        }
      }
    }, 300000) // Limpiar cada 5 minutos
  }

  // Métodos de persistencia
  private async saveIncomingWebhook(webhook: IncomingWebhook): Promise<void> {
    try {
      await this.supabase
        .from('incoming_webhooks')
        .insert({
          id: webhook.id,
          endpoint_id: webhook.endpointId,
          event: webhook.event,
          payload: webhook.payload,
          headers: webhook.headers,
          source_ip: webhook.sourceIP,
          user_agent: webhook.userAgent,
          timestamp: webhook.timestamp.toISOString(),
          signature: webhook.signature,
          verified: webhook.verified,
          processed: webhook.processed,
          processed_at: webhook.processedAt?.toISOString(),
          response: webhook.response,
          error: webhook.error,
          retry_count: webhook.retryCount,
          next_retry_at: webhook.nextRetryAt?.toISOString()
        })
    } catch (error) {
      console.error('Error saving incoming webhook:', error)
    }
  }

  private async updateIncomingWebhook(webhook: IncomingWebhook): Promise<void> {
    try {
      await this.supabase
        .from('incoming_webhooks')
        .update({
          processed: webhook.processed,
          processed_at: webhook.processedAt?.toISOString(),
          response: webhook.response,
          error: webhook.error,
          retry_count: webhook.retryCount,
          next_retry_at: webhook.nextRetryAt?.toISOString()
        })
        .eq('id', webhook.id)
    } catch (error) {
      console.error('Error updating incoming webhook:', error)
    }
  }

  private async saveWebhookDelivery(delivery: WebhookDelivery): Promise<void> {
    try {
      await this.supabase
        .from('webhook_deliveries')
        .insert({
          id: delivery.id,
          webhook_id: delivery.webhookId,
          target_url: delivery.targetUrl,
          event: delivery.event,
          payload: delivery.payload,
          headers: delivery.headers,
          timestamp: delivery.timestamp.toISOString(),
          status: delivery.status,
          status_code: delivery.statusCode,
          response: delivery.response,
          error: delivery.error,
          attempts: delivery.attempts,
          next_attempt_at: delivery.nextAttemptAt?.toISOString()
        })
    } catch (error) {
      console.error('Error saving webhook delivery:', error)
    }
  }

  private async updateWebhookDelivery(delivery: WebhookDelivery): Promise<void> {
    try {
      await this.supabase
        .from('webhook_deliveries')
        .update({
          status: delivery.status,
          status_code: delivery.statusCode,
          response: delivery.response,
          error: delivery.error,
          attempts: delivery.attempts,
          next_attempt_at: delivery.nextAttemptAt?.toISOString()
        })
        .eq('id', delivery.id)
    } catch (error) {
      console.error('Error updating webhook delivery:', error)
    }
  }
}

export const webhookManager = new WebhookManager()
export default webhookManager