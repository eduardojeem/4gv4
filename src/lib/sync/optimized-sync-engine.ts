import { createClient } from '@/lib/supabase/client'
import { syncPerformanceMonitor } from './sync-performance-monitor'

export interface SyncConfig {
  batchSize: number
  maxConcurrency: number
  retryAttempts: number
  retryDelay: number
  timeout: number
  enableCompression: boolean
  enableCaching: boolean
  cacheExpiry: number
  enablePrioritization: boolean
  enableCircuitBreaker: boolean
}

export interface SyncOperation {
  id: string
  type: 'insert' | 'update' | 'delete' | 'bulk_insert' | 'bulk_update'
  table: string
  data: any
  priority: 'low' | 'medium' | 'high' | 'critical'
  retries: number
  timestamp: Date
  dependencies?: string[]
  metadata?: Record<string, any>
}

export interface SyncResult {
  success: boolean
  operationId: string
  recordsProcessed: number
  recordsSuccess: number
  recordsError: number
  duration: number
  errors: string[]
  metadata: Record<string, any>
}

export interface CircuitBreakerState {
  isOpen: boolean
  failureCount: number
  lastFailureTime: Date | null
  nextAttemptTime: Date | null
}

export class OptimizedSyncEngine {
  private supabase = createClient()
  private config: SyncConfig
  private operationQueue: Map<string, SyncOperation[]> = new Map()
  private activeOperations = new Set<string>()
  private cache = new Map<string, { data: Record<string, unknown>; expiry: Date }>()
  private circuitBreakers = new Map<string, CircuitBreakerState>()
  private compressionWorker?: Worker
  private isProcessing = false
  private processingInterval?: NodeJS.Timeout

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = {
      batchSize: 100,
      maxConcurrency: 5,
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 30000,
      enableCompression: true,
      enableCaching: true,
      cacheExpiry: 300000, // 5 minutos
      enablePrioritization: true,
      enableCircuitBreaker: true,
      ...config
    }

    this.initializeCompressionWorker()
    this.startProcessing()
  }

  private initializeCompressionWorker(): void {
    if (typeof Worker !== 'undefined' && this.config.enableCompression) {
      try {
        // En un entorno real, esto sería un archivo worker separado
        const workerCode = `
          self.onmessage = function(e) {
            const { data, action } = e.data;
            
            if (action === 'compress') {
              // Simulación de compresión
              const compressed = JSON.stringify(data);
              self.postMessage({ compressed, originalSize: JSON.stringify(data).length, compressedSize: compressed.length });
            } else if (action === 'decompress') {
              // Simulación de descompresión
              const decompressed = JSON.parse(data);
              self.postMessage({ decompressed });
            }
          };
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' })
        this.compressionWorker = new Worker(URL.createObjectURL(blob))
      } catch (error) {
        console.warn('Compression worker not available:', error)
      }
    }
  }

  private startProcessing(): void {
    if (this.isProcessing) return

    this.isProcessing = true
    this.processingInterval = setInterval(async () => {
      await this.processQueue()
    }, 100) // Procesar cada 100ms
  }

  async stopProcessing(): Promise<void> {
    this.isProcessing = false
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = undefined
    }

    // Esperar a que terminen las operaciones activas
    while (this.activeOperations.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (this.compressionWorker) {
      this.compressionWorker.terminate()
    }
  }

  async queueOperation(operation: Omit<SyncOperation, 'id' | 'retries' | 'timestamp'>): Promise<string> {
    const id = `${operation.type}_${operation.table}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const syncOperation: SyncOperation = {
      ...operation,
      id,
      retries: 0,
      timestamp: new Date()
    }

    // Agregar a la cola apropiada basada en prioridad
    const queueKey = this.config.enablePrioritization ? operation.priority : 'default'
    
    if (!this.operationQueue.has(queueKey)) {
      this.operationQueue.set(queueKey, [])
    }
    
    this.operationQueue.get(queueKey)!.push(syncOperation)
    
    return id
  }

  async queueBulkOperations(operations: Omit<SyncOperation, 'id' | 'retries' | 'timestamp'>[]): Promise<string[]> {
    const ids: string[] = []
    
    for (const operation of operations) {
      const id = await this.queueOperation(operation)
      ids.push(id)
    }
    
    return ids
  }

  private async processQueue(): Promise<void> {
    if (this.activeOperations.size >= this.config.maxConcurrency) {
      return
    }

    const operation = this.getNextOperation()
    if (!operation) return

    // Verificar circuit breaker
    if (this.config.enableCircuitBreaker && this.isCircuitBreakerOpen(operation.table)) {
      // Retrasar la operación
      setTimeout(() => {
        this.queueOperation(operation)
      }, 5000)
      return
    }

    this.activeOperations.add(operation.id)
    
    try {
      const result = await this.executeOperation(operation)
      
      if (result.success) {
        this.resetCircuitBreaker(operation.table)
      } else {
        this.recordCircuitBreakerFailure(operation.table)
        
        // Reintentar si es necesario
        if (operation.retries < this.config.retryAttempts) {
          operation.retries++
          setTimeout(() => {
            this.queueOperation(operation)
          }, this.config.retryDelay * Math.pow(2, operation.retries)) // Backoff exponencial
        }
      }
    } catch (error) {
      console.error('Error processing operation:', error)
      this.recordCircuitBreakerFailure(operation.table)
    } finally {
      this.activeOperations.delete(operation.id)
    }
  }

  private getNextOperation(): SyncOperation | null {
    if (!this.config.enablePrioritization) {
      const defaultQueue = this.operationQueue.get('default') || []
      return defaultQueue.shift() || null
    }

    // Procesar por prioridad
    const priorities: Array<'critical' | 'high' | 'medium' | 'low'> = ['critical', 'high', 'medium', 'low']
    
    for (const priority of priorities) {
      const queue = this.operationQueue.get(priority) || []
      if (queue.length > 0) {
        return queue.shift()!
      }
    }

    return null
  }

  private async executeOperation(operation: SyncOperation): Promise<SyncResult> {
    const startTime = performance.now()
    
    try {
      let result: SyncResult

      // Verificar caché primero
      if (this.config.enableCaching && operation.type === 'insert') {
        const cached = this.getFromCache(operation.table, operation.data)
        if (cached) {
          return {
            success: true,
            operationId: operation.id,
            recordsProcessed: 1,
            recordsSuccess: 1,
            recordsError: 0,
            duration: performance.now() - startTime,
            errors: [],
            metadata: { fromCache: true }
          }
        }
      }

      switch (operation.type) {
        case 'insert':
          result = await this.executeInsert(operation)
          break
        case 'update':
          result = await this.executeUpdate(operation)
          break
        case 'delete':
          result = await this.executeDelete(operation)
          break
        case 'bulk_insert':
          result = await this.executeBulkInsert(operation)
          break
        case 'bulk_update':
          result = await this.executeBulkUpdate(operation)
          break
        default:
          throw new Error(`Unsupported operation type: ${operation.type}`)
      }

      // Actualizar caché si es exitoso
      if (result.success && this.config.enableCaching) {
        this.updateCache(operation.table, operation.data, result)
      }

      // Registrar métricas
      await syncPerformanceMonitor.recordSyncOperation(
        'product_sync', // Mapear según el tipo de operación
        startTime,
        performance.now(),
        result.recordsProcessed,
        result.recordsSuccess,
        result.errors,
        { operation: operation.type, table: operation.table }
      )

      return result
    } catch (error) {
      const errorResult: SyncResult = {
        success: false,
        operationId: operation.id,
        recordsProcessed: 1,
        recordsSuccess: 0,
        recordsError: 1,
        duration: performance.now() - startTime,
        errors: [String(error)],
        metadata: { operation: operation.type, table: operation.table }
      }

      await syncPerformanceMonitor.recordSyncOperation(
        'product_sync',
        startTime,
        performance.now(),
        errorResult.recordsProcessed,
        errorResult.recordsSuccess,
        errorResult.errors,
        errorResult.metadata
      )

      return errorResult
    }
  }

  private async executeInsert(operation: SyncOperation): Promise<SyncResult> {
    const { data, error } = await this.supabase
      .from(operation.table)
      .insert(operation.data)
      .select()

    if (error) {
      return {
        success: false,
        operationId: operation.id,
        recordsProcessed: 1,
        recordsSuccess: 0,
        recordsError: 1,
        duration: 0,
        errors: [error.message],
        metadata: {}
      }
    }

    return {
      success: true,
      operationId: operation.id,
      recordsProcessed: 1,
      recordsSuccess: 1,
      recordsError: 0,
      duration: 0,
      errors: [],
      metadata: { insertedData: data }
    }
  }

  private async executeUpdate(operation: SyncOperation): Promise<SyncResult> {
    const { id, ...updateData } = operation.data
    
    const { data, error } = await this.supabase
      .from(operation.table)
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) {
      return {
        success: false,
        operationId: operation.id,
        recordsProcessed: 1,
        recordsSuccess: 0,
        recordsError: 1,
        duration: 0,
        errors: [error.message],
        metadata: {}
      }
    }

    return {
      success: true,
      operationId: operation.id,
      recordsProcessed: 1,
      recordsSuccess: data ? data.length : 0,
      recordsError: data ? 0 : 1,
      duration: 0,
      errors: [],
      metadata: { updatedData: data }
    }
  }

  private async executeDelete(operation: SyncOperation): Promise<SyncResult> {
    const { error } = await this.supabase
      .from(operation.table)
      .delete()
      .eq('id', operation.data.id)

    if (error) {
      return {
        success: false,
        operationId: operation.id,
        recordsProcessed: 1,
        recordsSuccess: 0,
        recordsError: 1,
        duration: 0,
        errors: [error.message],
        metadata: {}
      }
    }

    return {
      success: true,
      operationId: operation.id,
      recordsProcessed: 1,
      recordsSuccess: 1,
      recordsError: 0,
      duration: 0,
      errors: [],
      metadata: {}
    }
  }

  private async executeBulkInsert(operation: SyncOperation): Promise<SyncResult> {
    const records = Array.isArray(operation.data) ? operation.data : [operation.data]
    const batches = this.createBatches(records, this.config.batchSize)
    
    let totalProcessed = 0
    let totalSuccess = 0
    let totalErrors = 0
    const errors: string[] = []

    for (const batch of batches) {
      try {
        const { data, error } = await this.supabase
          .from(operation.table)
          .insert(batch)
          .select()

        totalProcessed += batch.length

        if (error) {
          errors.push(error.message)
          totalErrors += batch.length
        } else {
          totalSuccess += data ? data.length : batch.length
        }
      } catch (error) {
        errors.push(String(error))
        totalProcessed += batch.length
        totalErrors += batch.length
      }
    }

    return {
      success: totalErrors === 0,
      operationId: operation.id,
      recordsProcessed: totalProcessed,
      recordsSuccess: totalSuccess,
      recordsError: totalErrors,
      duration: 0,
      errors,
      metadata: { batches: batches.length, batchSize: this.config.batchSize }
    }
  }

  private async executeBulkUpdate(operation: SyncOperation): Promise<SyncResult> {
    const records = Array.isArray(operation.data) ? operation.data : [operation.data]
    
    let totalProcessed = 0
    let totalSuccess = 0
    let totalErrors = 0
    const errors: string[] = []

    // Para bulk update, procesamos uno por uno ya que cada registro puede tener diferentes condiciones
    for (const record of records) {
      try {
        const { id, ...updateData } = record
        
        const { data, error } = await this.supabase
          .from(operation.table)
          .update(updateData)
          .eq('id', id)
          .select()

        totalProcessed++

        if (error) {
          errors.push(error.message)
          totalErrors++
        } else {
          totalSuccess += data ? data.length : 1
        }
      } catch (error) {
        errors.push(String(error))
        totalProcessed++
        totalErrors++
      }
    }

    return {
      success: totalErrors === 0,
      operationId: operation.id,
      recordsProcessed: totalProcessed,
      recordsSuccess: totalSuccess,
      recordsError: totalErrors,
      duration: 0,
      errors,
      metadata: { recordCount: records.length }
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    
    return batches
  }

  private getFromCache(table: string, data: Record<string, unknown>): Record<string, unknown> | null {
    if (!this.config.enableCaching) return null

    const key = this.generateCacheKey(table, data)
    const cached = this.cache.get(key)
    
    if (!cached) return null
    
    if (cached.expiry < new Date()) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data
  }

  private updateCache(table: string, data: Record<string, unknown>, result: SyncResult): void {
    if (!this.config.enableCaching || !result.success) return

    const key = this.generateCacheKey(table, data)
    const expiry = new Date(Date.now() + this.config.cacheExpiry)
    
    this.cache.set(key, { data: result, expiry })
  }

  private generateCacheKey(table: string, data: Record<string, unknown>): string {
    return `${table}_${JSON.stringify(data)}`
  }

  private isCircuitBreakerOpen(table: string): boolean {
    if (!this.config.enableCircuitBreaker) return false

    const state = this.circuitBreakers.get(table)
    if (!state) return false

    if (!state.isOpen) return false

    // Verificar si es tiempo de intentar de nuevo
    if (state.nextAttemptTime && new Date() > state.nextAttemptTime) {
      state.isOpen = false
      state.nextAttemptTime = null
      return false
    }

    return true
  }

  private recordCircuitBreakerFailure(table: string): void {
    if (!this.config.enableCircuitBreaker) return

    let state = this.circuitBreakers.get(table)
    if (!state) {
      state = {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: null,
        nextAttemptTime: null
      }
      this.circuitBreakers.set(table, state)
    }

    state.failureCount++
    state.lastFailureTime = new Date()

    // Abrir circuit breaker después de 5 fallos
    if (state.failureCount >= 5) {
      state.isOpen = true
      state.nextAttemptTime = new Date(Date.now() + 60000) // Intentar de nuevo en 1 minuto
    }
  }

  private resetCircuitBreaker(table: string): void {
    if (!this.config.enableCircuitBreaker) return

    const state = this.circuitBreakers.get(table)
    if (state) {
      state.failureCount = 0
      state.isOpen = false
      state.lastFailureTime = null
      state.nextAttemptTime = null
    }
  }

  // Métodos de utilidad para comprimir datos
  private async compressData(data: Record<string, unknown>): Promise<string> {
    if (!this.config.enableCompression || !this.compressionWorker) {
      return JSON.stringify(data)
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Compression timeout'))
      }, 5000)

      this.compressionWorker!.onmessage = (e) => {
        clearTimeout(timeout)
        resolve(e.data.compressed)
      }

      this.compressionWorker!.onerror = (error) => {
        clearTimeout(timeout)
        reject(error)
      }

      this.compressionWorker!.postMessage({ data, action: 'compress' })
    })
  }

  private async decompressData(compressedData: string): Promise<any> {
    if (!this.config.enableCompression || !this.compressionWorker) {
      return JSON.parse(compressedData)
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Decompression timeout'))
      }, 5000)

      this.compressionWorker!.onmessage = (e) => {
        clearTimeout(timeout)
        resolve(e.data.decompressed)
      }

      this.compressionWorker!.onerror = (error) => {
        clearTimeout(timeout)
        reject(error)
      }

      this.compressionWorker!.postMessage({ data: compressedData, action: 'decompress' })
    })
  }

  // Métodos de monitoreo y estadísticas
  getQueueStatus(): Record<string, number> {
    const status: Record<string, number> = {}
    
    this.operationQueue.forEach((queue, priority) => {
      status[priority] = queue.length
    })
    
    return status
  }

  getActiveOperationsCount(): number {
    return this.activeOperations.size
  }

  getCacheStats(): { size: number; hitRate: number } {
    // En una implementación real, mantendríamos estadísticas de hit rate
    return {
      size: this.cache.size,
      hitRate: 0 // Placeholder
    }
  }

  getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
    const status: Record<string, CircuitBreakerState> = {}
    
    this.circuitBreakers.forEach((state, table) => {
      status[table] = { ...state }
    })
    
    return status
  }

  async clearCache(): Promise<void> {
    this.cache.clear()
  }

  async resetCircuitBreakers(): Promise<void> {
    this.circuitBreakers.clear()
  }

  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  getConfig(): SyncConfig {
    return { ...this.config }
  }
}

export const optimizedSyncEngine = new OptimizedSyncEngine()