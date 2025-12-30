'use client'

import { createClient } from '@/lib/supabase/client'

// Interfaces para integraciones externas
export interface ExternalIntegration {
  id: string
  name: string
  type: 'payment' | 'shipping' | 'inventory' | 'crm' | 'email' | 'analytics' | 'social' | 'custom'
  provider: string
  status: 'active' | 'inactive' | 'error' | 'pending'
  config: IntegrationConfig
  credentials: IntegrationCredentials
  endpoints: APIEndpoint[]
  webhooks: WebhookConfig[]
  rateLimits: RateLimitConfig
  lastSync: Date
  nextSync: Date
  syncInterval: number // en minutos
  errorCount: number
  lastError?: string
  createdAt: Date
  updatedAt: Date
}

export interface IntegrationConfig {
  baseUrl: string
  version: string
  timeout: number
  retryAttempts: number
  retryDelay: number
  batchSize: number
  syncEnabled: boolean
  webhooksEnabled: boolean
  dataMapping: DataMapping[]
  customHeaders: Record<string, string>
  customParams: Record<string, unknown>
}

export interface IntegrationCredentials {
  apiKey?: string
  secretKey?: string
  accessToken?: string
  refreshToken?: string
  clientId?: string
  clientSecret?: string
  username?: string
  password?: string
  customAuth?: Record<string, string>
  expiresAt?: Date
}

export interface APIEndpoint {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  description: string
  requestSchema?: Record<string, unknown>
  responseSchema?: Record<string, unknown>
  rateLimitPerMinute: number
  cacheTTL: number // en segundos
  enabled: boolean
}

export interface WebhookConfig {
  id: string
  name: string
  url: string
  events: string[]
  secret: string
  enabled: boolean
  retryAttempts: number
  headers: Record<string, string>
  filters: WebhookFilter[]
}

export interface WebhookFilter {
  field: string
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex'
  value: string
}

export interface RateLimitConfig {
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
  burstLimit: number
  backoffStrategy: 'linear' | 'exponential' | 'fixed'
  backoffMultiplier: number
}

export interface DataMapping {
  sourceField: string
  targetField: string
  transformation?: 'uppercase' | 'lowercase' | 'trim' | 'date' | 'number' | 'boolean' | 'custom'
  customTransform?: string // función JavaScript como string
  required: boolean
  defaultValue?: unknown
}

export interface SyncResult {
  integrationId: string
  startTime: Date
  endTime: Date
  status: 'success' | 'partial' | 'failed'
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  recordsDeleted: number
  recordsSkipped: number
  errors: SyncError[]
  warnings: string[]
  nextSyncAt: Date
}

export interface SyncError {
  record: Record<string, unknown>
  error: string
  code: string
  retryable: boolean
  timestamp: Date
}

export interface APIRequest {
  id: string
  integrationId: string
  endpoint: string
  method: string
  headers: Record<string, string>
  body?: Record<string, unknown>
  timestamp: Date
  responseTime?: number
  statusCode?: number
  response?: Record<string, unknown>
  error?: string
  cached: boolean
}

export interface WebhookEvent {
  id: string
  integrationId: string
  webhookId: string
  event: string
  payload: Record<string, unknown>
  headers: Record<string, string>
  timestamp: Date
  processed: boolean
  processedAt?: Date
  error?: string
  retryCount: number
}

class ExternalAPIManager {
  private supabase = createClient()
  private integrations: Map<string, ExternalIntegration> = new Map()
  private requestCache: Map<string, { data: Record<string, unknown>; expiresAt: Date }> = new Map()
  private rateLimiters: Map<string, RateLimiter> = new Map()

  // Inicializar manager
  async initialize(): Promise<void> {
    await this.loadIntegrations()
    this.startSyncScheduler()
    this.startCacheCleanup()
  }

  // Cargar integraciones desde la base de datos
  private async loadIntegrations(): Promise<void> {
    try {
      const { data: integrations } = await this.supabase
        .from('external_integrations')
        .select('*')
        .eq('status', 'active')

      if (integrations) {
        for (const integration of integrations) {
          this.integrations.set(integration.id, {
            ...integration,
            lastSync: new Date(integration.last_sync),
            nextSync: new Date(integration.next_sync),
            createdAt: new Date(integration.created_at),
            updatedAt: new Date(integration.updated_at)
          })

          // Inicializar rate limiter
          this.rateLimiters.set(integration.id, new RateLimiter(integration.rate_limits))
        }
      }
    } catch (error) {
      console.error('Error loading integrations:', error)
    }
  }

  // Registrar nueva integración
  async registerIntegration(integration: Omit<ExternalIntegration, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const id = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = new Date()

      const newIntegration: ExternalIntegration = {
        ...integration,
        id,
        createdAt: now,
        updatedAt: now
      }

      // Validar credenciales
      await this.validateCredentials(newIntegration)

      // Guardar en base de datos
      await this.supabase
        .from('external_integrations')
        .insert({
          id,
          name: integration.name,
          type: integration.type,
          provider: integration.provider,
          status: integration.status,
          config: integration.config,
          credentials: integration.credentials,
          endpoints: integration.endpoints,
          webhooks: integration.webhooks,
          rate_limits: integration.rateLimits,
          last_sync: integration.lastSync.toISOString(),
          next_sync: integration.nextSync.toISOString(),
          sync_interval: integration.syncInterval,
          error_count: integration.errorCount,
          last_error: integration.lastError,
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        })

      // Agregar a memoria
      this.integrations.set(id, newIntegration)
      this.rateLimiters.set(id, new RateLimiter(integration.rateLimits))

      return id
    } catch (error) {
      console.error('Error registering integration:', error)
      throw error
    }
  }

  // Realizar llamada a API externa
  async makeAPICall(
    integrationId: string,
    endpointName: string,
    data?: Record<string, unknown>,
    options?: {
      skipCache?: boolean
      customHeaders?: Record<string, string>
      timeout?: number
    }
  ): Promise<Record<string, unknown>> {
    const integration = this.integrations.get(integrationId)
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`)
    }

    const endpoint = integration.endpoints.find(e => e.name === endpointName)
    if (!endpoint) {
      throw new Error(`Endpoint ${endpointName} not found`)
    }

    if (!endpoint.enabled) {
      throw new Error(`Endpoint ${endpointName} is disabled`)
    }

    // Verificar rate limit
    const rateLimiter = this.rateLimiters.get(integrationId)
    if (rateLimiter && !rateLimiter.canMakeRequest()) {
      throw new Error('Rate limit exceeded')
    }

    // Verificar cache
    const cacheKey = `${integrationId}_${endpointName}_${JSON.stringify(data)}`
    if (!options?.skipCache && endpoint.cacheTTL > 0) {
      const cached = this.requestCache.get(cacheKey)
      if (cached && cached.expiresAt > new Date()) {
        return cached.data
      }
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()

    try {
      // Preparar headers
      const headers = {
        'Content-Type': 'application/json',
        ...integration.config.customHeaders,
        ...options?.customHeaders,
        ...this.buildAuthHeaders(integration.credentials)
      }

      // Construir URL
      const url = `${integration.config.baseUrl}${endpoint.path}`

      // Preparar request
      const requestOptions: RequestInit = {
        method: endpoint.method,
        headers,
        signal: AbortSignal.timeout(options?.timeout || integration.config.timeout)
      }

      if (data && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        requestOptions.body = JSON.stringify(data)
      }

      // Realizar request
      const response = await fetch(url, requestOptions)
      const responseTime = Date.now() - startTime

      let responseData: Record<string, unknown> | string
      try {
        responseData = await response.json()
      } catch {
        responseData = await response.text()
      }

      // Registrar request
      await this.logAPIRequest({
        id: requestId,
        integrationId,
        endpoint: endpointName,
        method: endpoint.method,
        headers,
        body: data,
        timestamp: new Date(),
        responseTime,
        statusCode: response.status,
        response: typeof responseData === 'string' ? { text: responseData } : responseData,
        cached: false
      })

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`)
      }

      // Actualizar rate limiter
      if (rateLimiter) {
        rateLimiter.recordRequest()
      }

      // Guardar en cache
      if (endpoint.cacheTTL > 0) {
        this.requestCache.set(cacheKey, {
          data: typeof responseData === 'string' ? { text: responseData } : responseData,
          expiresAt: new Date(Date.now() + endpoint.cacheTTL * 1000)
        })
      }

      return typeof responseData === 'string' ? { text: responseData } : responseData
    } catch (error) {
      const responseTime = Date.now() - startTime

      // Registrar error
      await this.logAPIRequest({
        id: requestId,
        integrationId,
        endpoint: endpointName,
        method: endpoint.method,
        headers: {},
        body: data,
        timestamp: new Date(),
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        cached: false
      })

      // Incrementar contador de errores
      await this.incrementErrorCount(integrationId, error instanceof Error ? error.message : 'Unknown error')

      throw error
    }
  }

  // Sincronizar datos con integración externa
  async syncIntegration(integrationId: string, force: boolean = false): Promise<SyncResult> {
    const integration = this.integrations.get(integrationId)
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`)
    }

    if (!integration.config.syncEnabled && !force) {
      throw new Error('Sync is disabled for this integration')
    }

    const startTime = new Date()
    const syncResult: SyncResult = {
      integrationId,
      startTime,
      endTime: new Date(),
      status: 'success',
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      recordsSkipped: 0,
      errors: [],
      warnings: [],
      nextSyncAt: new Date(Date.now() + integration.syncInterval * 60000)
    }

    try {
      // Obtener datos desde la API externa
      const externalData = await this.fetchExternalData(integration)
      
      // Procesar datos en lotes
      const batchSize = integration.config.batchSize
      for (let i = 0; i < externalData.length; i += batchSize) {
        const batch = externalData.slice(i, i + batchSize)
        const batchResult = await this.processBatch(integration, batch)
        
        syncResult.recordsProcessed += batchResult.processed
        syncResult.recordsCreated += batchResult.created
        syncResult.recordsUpdated += batchResult.updated
        syncResult.recordsSkipped += batchResult.skipped
        syncResult.errors.push(...batchResult.errors)
        syncResult.warnings.push(...batchResult.warnings)
      }

      // Determinar estado final
      if (syncResult.errors.length > 0) {
        syncResult.status = syncResult.recordsProcessed > syncResult.errors.length ? 'partial' : 'failed'
      }

      // Actualizar última sincronización
      await this.updateLastSync(integrationId, syncResult.nextSyncAt)

    } catch (error) {
      syncResult.status = 'failed'
      syncResult.errors.push({
        record: {},
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'SYNC_FAILED',
        retryable: true,
        timestamp: new Date()
      })
    }

    syncResult.endTime = new Date()

    // Guardar resultado de sincronización
    await this.saveSyncResult(syncResult)

    return syncResult
  }

  // Procesar webhook entrante
  async processWebhook(
    integrationId: string,
    webhookId: string,
    event: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<void> {
    const integration = this.integrations.get(integrationId)
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`)
    }

    const webhook = integration.webhooks.find(w => w.id === webhookId)
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} not found`)
    }

    if (!webhook.enabled) {
      throw new Error('Webhook is disabled')
    }

    // Verificar evento
    if (!webhook.events.includes(event)) {
      throw new Error(`Event ${event} not configured for this webhook`)
    }

    // Verificar firma (si está configurada)
    if (webhook.secret) {
      const signature = headers['x-signature'] || headers['x-hub-signature']
      if (!this.verifyWebhookSignature(payload, webhook.secret, signature)) {
        throw new Error('Invalid webhook signature')
      }
    }

    // Aplicar filtros
    if (!this.passesWebhookFilters(payload, webhook.filters)) {
      return // Filtrado, no procesar
    }

    const webhookEvent: WebhookEvent = {
      id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      integrationId,
      webhookId,
      event,
      payload,
      headers,
      timestamp: new Date(),
      processed: false,
      retryCount: 0
    }

    try {
      // Guardar evento
      await this.saveWebhookEvent(webhookEvent)

      // Procesar evento
      await this.handleWebhookEvent(webhookEvent)

      // Marcar como procesado
      webhookEvent.processed = true
      webhookEvent.processedAt = new Date()
      await this.updateWebhookEvent(webhookEvent)

    } catch (error) {
      webhookEvent.error = error instanceof Error ? error.message : 'Unknown error'
      await this.updateWebhookEvent(webhookEvent)

      // Programar reintento si es retryable
      if (webhookEvent.retryCount < webhook.retryAttempts) {
        await this.scheduleWebhookRetry(webhookEvent)
      }

      throw error
    }
  }

  // Obtener estado de integración
  async getIntegrationStatus(integrationId: string): Promise<{
    status: string
    lastSync: Date
    nextSync: Date
    errorCount: number
    lastError?: string
    recentRequests: number
    successRate: number
  }> {
    const integration = this.integrations.get(integrationId)
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`)
    }

    // Obtener estadísticas de requests recientes
    const { data: recentRequests } = await this.supabase
      .from('api_requests')
      .select('status_code')
      .eq('integration_id', integrationId)
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const totalRequests = recentRequests?.length || 0
    const successfulRequests = recentRequests?.filter(r => r.status_code >= 200 && r.status_code < 300).length || 0
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 1

    return {
      status: integration.status,
      lastSync: integration.lastSync,
      nextSync: integration.nextSync,
      errorCount: integration.errorCount,
      lastError: integration.lastError,
      recentRequests: totalRequests,
      successRate
    }
  }

  // Métodos auxiliares privados
  private buildAuthHeaders(credentials: IntegrationCredentials): Record<string, string> {
    const headers: Record<string, string> = {}

    if (credentials.apiKey) {
      headers['Authorization'] = `Bearer ${credentials.apiKey}`
    }

    if (credentials.accessToken) {
      headers['Authorization'] = `Bearer ${credentials.accessToken}`
    }

    if (credentials.username && credentials.password) {
      const auth = btoa(`${credentials.username}:${credentials.password}`)
      headers['Authorization'] = `Basic ${auth}`
    }

    if (credentials.customAuth) {
      Object.assign(headers, credentials.customAuth)
    }

    return headers
  }

  private async validateCredentials(integration: ExternalIntegration): Promise<void> {
    // Implementar validación específica según el tipo de integración
    try {
      const testEndpoint = integration.endpoints.find(e => e.name === 'test' || e.method === 'GET')
      if (testEndpoint) {
        await this.makeAPICall(integration.id, testEndpoint.name, undefined, { skipCache: true })
      }
    } catch (error) {
      throw new Error(`Invalid credentials: ${error}`)
    }
  }

  private async fetchExternalData(integration: ExternalIntegration): Promise<Array<Record<string, unknown>>> {
    // Implementar lógica específica para obtener datos según el tipo de integración
    const dataEndpoint = integration.endpoints.find(e => e.name.includes('list') || e.name.includes('get'))
    if (dataEndpoint) {
      const result = await this.makeAPICall(integration.id, dataEndpoint.name)
      return Array.isArray(result) ? result : [result]
    }
    return []
  }

  private async processBatch(integration: ExternalIntegration, batch: Array<Record<string, unknown>>): Promise<{
    processed: number
    created: number
    updated: number
    skipped: number
    warnings: string[]
    errors: SyncError[]
  }> {
    const result = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      warnings: [] as string[],
      errors: [] as SyncError[]
    }

    for (const record of batch) {
      try {
        // Transformar datos según mapping
        const transformedRecord = this.transformData(record, integration.config.dataMapping)
        
        // Verificar si el registro ya existe
        const existingRecord = await this.findExistingRecord(transformedRecord, integration.type)
        
        if (existingRecord) {
          // Actualizar registro existente
          const recordId = typeof existingRecord.id === 'string' ? existingRecord.id : String(existingRecord.id)
          await this.updateRecord(recordId, transformedRecord, integration.type)
          result.updated++
        } else {
          // Crear nuevo registro
          await this.createRecord(transformedRecord, integration.type)
          result.created++
        }
        
        result.processed++
      } catch (error) {
        result.errors.push({
          record,
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'PROCESSING_ERROR',
          retryable: true,
          timestamp: new Date()
        } as SyncError)
      }
    }

    return result
  }

  private transformData(data: Record<string, unknown>, mappings: DataMapping[]): Record<string, unknown> {
    const transformed: Record<string, unknown> = {}

    for (const mapping of mappings) {
      let value = this.getNestedValue(data, mapping.sourceField)

      if (value === undefined || value === null) {
        if (mapping.required) {
          throw new Error(`Required field ${mapping.sourceField} is missing`)
        }
        value = mapping.defaultValue
      }

      // Aplicar transformación
      if (mapping.transformation && value !== undefined && value !== null) {
        value = this.applyTransformation(value, mapping.transformation, mapping.customTransform)
      }

      this.setNestedValue(transformed, mapping.targetField, value)
    }

    return transformed
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key]
      }
      return undefined
    }, obj)
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    const target = keys.reduce((current: Record<string, unknown>, key: string) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {}
      }
      return current[key] as Record<string, unknown>
    }, obj)
    target[lastKey] = value
  }

  private applyTransformation(value: unknown, transformation: string, customTransform?: string): unknown {
    switch (transformation) {
      case 'uppercase':
        return String(value).toUpperCase()
      case 'lowercase':
        return String(value).toLowerCase()
      case 'trim':
        return String(value).trim()
      case 'date':
        return new Date(value as string | number | Date)
      case 'number':
        return Number(value)
      case 'boolean':
        return Boolean(value)
      case 'custom':
        if (customTransform) {
          try {
            const func = new Function('value', customTransform)
            return func(value)
          } catch (error) {
            console.error('Custom transformation error:', error)
            return value
          }
        }
        return value
      default:
        return value
    }
  }

  private verifyWebhookSignature(payload: Record<string, unknown>, secret: string, signature?: string): boolean {
    if (!signature) return false
    
    // Implementar verificación de firma según el proveedor
    // Ejemplo para GitHub/GitLab style webhooks
    const crypto = require('crypto')
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex')
    
    return signature === `sha256=${expectedSignature}`
  }

  private passesWebhookFilters(payload: Record<string, unknown>, filters: WebhookFilter[]): boolean {
    return filters.every(filter => {
      const value = this.getNestedValue(payload, filter.field)
      if (value === undefined || value === null) return false

      const stringValue = String(value)
      
      switch (filter.operator) {
        case 'equals':
          return stringValue === filter.value
        case 'contains':
          return stringValue.includes(filter.value)
        case 'startsWith':
          return stringValue.startsWith(filter.value)
        case 'endsWith':
          return stringValue.endsWith(filter.value)
        case 'regex':
          return new RegExp(filter.value).test(stringValue)
        default:
          return false
      }
    })
  }

  private startSyncScheduler(): void {
    setInterval(async () => {
      for (const [id, integration] of this.integrations) {
        if (integration.config.syncEnabled && integration.nextSync <= new Date()) {
          try {
            await this.syncIntegration(id)
          } catch (error) {
            console.error(`Sync failed for integration ${id}:`, error)
          }
        }
      }
    }, 60000) // Verificar cada minuto
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = new Date()
      for (const [key, cached] of this.requestCache) {
        if (cached.expiresAt <= now) {
          this.requestCache.delete(key)
        }
      }
    }, 300000) // Limpiar cada 5 minutos
  }

  // Métodos de persistencia (implementar según necesidades)
  private async logAPIRequest(request: APIRequest): Promise<void> {
    try {
      await this.supabase
        .from('api_requests')
        .insert({
          id: request.id,
          integration_id: request.integrationId,
          endpoint: request.endpoint,
          method: request.method,
          headers: request.headers,
          body: request.body,
          timestamp: request.timestamp.toISOString(),
          response_time: request.responseTime,
          status_code: request.statusCode,
          response: request.response,
          error: request.error,
          cached: request.cached
        })
    } catch (error) {
      console.error('Error logging API request:', error)
    }
  }

  private async incrementErrorCount(integrationId: string, error: string): Promise<void> {
    const integration = this.integrations.get(integrationId)
    if (integration) {
      integration.errorCount++
      integration.lastError = error
      integration.updatedAt = new Date()

      await this.supabase
        .from('external_integrations')
        .update({
          error_count: integration.errorCount,
          last_error: error,
          updated_at: integration.updatedAt.toISOString()
        })
        .eq('id', integrationId)
    }
  }

  private async updateLastSync(integrationId: string, nextSync: Date): Promise<void> {
    const integration = this.integrations.get(integrationId)
    if (integration) {
      integration.lastSync = new Date()
      integration.nextSync = nextSync
      integration.updatedAt = new Date()

      await this.supabase
        .from('external_integrations')
        .update({
          last_sync: integration.lastSync.toISOString(),
          next_sync: nextSync.toISOString(),
          updated_at: integration.updatedAt.toISOString()
        })
        .eq('id', integrationId)
    }
  }

  private async saveSyncResult(result: SyncResult): Promise<void> {
    try {
      await this.supabase
        .from('sync_results')
        .insert({
          integration_id: result.integrationId,
          start_time: result.startTime.toISOString(),
          end_time: result.endTime.toISOString(),
          status: result.status,
          records_processed: result.recordsProcessed,
          records_created: result.recordsCreated,
          records_updated: result.recordsUpdated,
          records_deleted: result.recordsDeleted,
          records_skipped: result.recordsSkipped,
          errors: result.errors,
          warnings: result.warnings,
          next_sync_at: result.nextSyncAt.toISOString()
        })
    } catch (error) {
      console.error('Error saving sync result:', error)
    }
  }

  private async saveWebhookEvent(event: WebhookEvent): Promise<void> {
    try {
      await this.supabase
        .from('webhook_events')
        .insert({
          id: event.id,
          integration_id: event.integrationId,
          webhook_id: event.webhookId,
          event: event.event,
          payload: event.payload,
          headers: event.headers,
          timestamp: event.timestamp.toISOString(),
          processed: event.processed,
          processed_at: event.processedAt?.toISOString(),
          error: event.error,
          retry_count: event.retryCount
        })
    } catch (error) {
      console.error('Error saving webhook event:', error)
    }
  }

  private async updateWebhookEvent(event: WebhookEvent): Promise<void> {
    try {
      await this.supabase
        .from('webhook_events')
        .update({
          processed: event.processed,
          processed_at: event.processedAt?.toISOString(),
          error: event.error,
          retry_count: event.retryCount
        })
        .eq('id', event.id)
    } catch (error) {
      console.error('Error updating webhook event:', error)
    }
  }

  private async handleWebhookEvent(event: WebhookEvent): Promise<void> {
    // Implementar lógica específica según el tipo de evento
    console.log(`Processing webhook event: ${event.event}`, event.payload)
  }

  private async scheduleWebhookRetry(event: WebhookEvent): Promise<void> {
    // Implementar lógica de reintento
    console.log(`Scheduling retry for webhook event: ${event.id}`)
  }

  private async findExistingRecord(record: Record<string, unknown>, type: string): Promise<Record<string, unknown> | null> {
    // Implementar búsqueda de registro existente según el tipo
    return null
  }

  private async createRecord(record: Record<string, unknown>, type: string): Promise<void> {
    // Implementar creación de registro según el tipo
    console.log(`Creating record of type ${type}:`, record)
  }

  private async updateRecord(id: string, record: Record<string, unknown>, type: string): Promise<void> {
    // Implementar actualización de registro según el tipo
    console.log(`Updating record ${id} of type ${type}:`, record)
  }
}

// Rate Limiter auxiliar
class RateLimiter {
  private requests: Date[] = []
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  canMakeRequest(): boolean {
    const now = new Date()
    
    // Limpiar requests antiguos
    this.requests = this.requests.filter(req => 
      now.getTime() - req.getTime() < 60000 // Últimos 60 segundos
    )

    return this.requests.length < this.config.requestsPerMinute
  }

  recordRequest(): void {
    this.requests.push(new Date())
  }
}

export const externalAPIManager = new ExternalAPIManager()
export default externalAPIManager