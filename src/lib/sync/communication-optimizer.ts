import { createClient } from '@/lib/supabase/client'
import { syncPerformanceMonitor } from './sync-performance-monitor'

export interface ConnectionConfig {
  maxConcurrentConnections: number
  connectionTimeout: number
  keepAliveInterval: number
  retryAttempts: number
  retryDelay: number
  compressionEnabled: boolean
  batchSize: number
  poolSize: number
  idleTimeout: number
}

export interface CompressionConfig {
  enabled: boolean
  algorithm: 'gzip' | 'deflate' | 'brotli'
  level: number
  threshold: number // Minimum size to compress
}

export interface CacheConfig {
  enabled: boolean
  ttl: number // Time to live in milliseconds
  maxSize: number // Maximum cache size in MB
  strategy: 'lru' | 'lfu' | 'fifo'
}

export interface ProtocolMetrics {
  timestamp: Date
  operation: string
  latency: number
  throughput: number
  compressionRatio?: number
  cacheHitRate?: number
  connectionPoolUtilization: number
  errorRate: number
  retryCount: number
}

export interface OptimizationResult {
  timestamp: Date
  previousConfig: ConnectionConfig
  newConfig: ConnectionConfig
  improvementPercentage: number
  metrics: {
    latencyReduction: number
    throughputIncrease: number
    errorRateReduction: number
  }
  recommendations: string[]
}

export class ConnectionPool {
  private connections: Map<string, any> = new Map()
  private activeConnections: Set<string> = new Set()
  private config: ConnectionConfig
  private lastUsed: Map<string, number> = new Map()

  constructor(config: ConnectionConfig) {
    this.config = config
    this.startCleanupInterval()
  }

  async getConnection(key: string = 'default'): Promise<any> {
    if (this.connections.has(key) && this.activeConnections.size < this.config.maxConcurrentConnections) {
      this.lastUsed.set(key, Date.now())
      this.activeConnections.add(key)
      return this.connections.get(key)
    }

    if (this.activeConnections.size >= this.config.maxConcurrentConnections) {
      throw new Error('Connection pool exhausted')
    }

    const connection = await this.createConnection()
    this.connections.set(key, connection)
    this.activeConnections.add(key)
    this.lastUsed.set(key, Date.now())
    
    return connection
  }

  releaseConnection(key: string = 'default'): void {
    this.activeConnections.delete(key)
  }

  private async createConnection(): Promise<any> {
    return createClient()
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now()
      const toRemove: string[] = []

      this.lastUsed.forEach((lastUsed, key) => {
        if (now - lastUsed > this.config.idleTimeout && !this.activeConnections.has(key)) {
          toRemove.push(key)
        }
      })

      toRemove.forEach(key => {
        this.connections.delete(key)
        this.lastUsed.delete(key)
      })
    }, this.config.idleTimeout / 2)
  }

  getUtilization(): number {
    return this.activeConnections.size / this.config.maxConcurrentConnections
  }

  getStats(): { total: number; active: number; idle: number; utilization: number } {
    return {
      total: this.connections.size,
      active: this.activeConnections.size,
      idle: this.connections.size - this.activeConnections.size,
      utilization: this.getUtilization()
    }
  }
}

export class DataCompressor {
  private config: CompressionConfig

  constructor(config: CompressionConfig) {
    this.config = config
  }

  async compress(data: Record<string, unknown>): Promise<{ compressed: string; ratio: number; originalSize: number; compressedSize: number }> {
    if (!this.config.enabled) {
      const serialized = JSON.stringify(data)
      return {
        compressed: serialized,
        ratio: 1,
        originalSize: serialized.length,
        compressedSize: serialized.length
      }
    }

    const serialized = JSON.stringify(data)
    const originalSize = serialized.length

    if (originalSize < this.config.threshold) {
      return {
        compressed: serialized,
        ratio: 1,
        originalSize,
        compressedSize: originalSize
      }
    }

    // Simulación de compresión (en un entorno real usarías librerías como pako)
    const compressionRatio = this.getCompressionRatio(this.config.algorithm, this.config.level)
    const compressedSize = Math.floor(originalSize * compressionRatio)
    const compressed = this.simulateCompression(serialized, compressionRatio)

    return {
      compressed,
      ratio: originalSize / compressedSize,
      originalSize,
      compressedSize
    }
  }

  async decompress(compressedData: string, originalSize: number): Promise<any> {
    if (!this.config.enabled) {
      return JSON.parse(compressedData)
    }

    // Simulación de descompresión
    const decompressed = this.simulateDecompression(compressedData, originalSize)
    return JSON.parse(decompressed)
  }

  private getCompressionRatio(algorithm: string, level: number): number {
    const baseRatios = {
      gzip: 0.3,
      deflate: 0.35,
      brotli: 0.25
    }

    const baseRatio = baseRatios[algorithm as keyof typeof baseRatios] || 0.4
    const levelMultiplier = 1 - (level / 10) * 0.1 // Better compression with higher levels
    
    return Math.max(0.1, baseRatio * levelMultiplier)
  }

  private simulateCompression(data: string, ratio: number): string {
    // Simulación simple: truncar y agregar metadata
    const targetLength = Math.floor(data.length * ratio)
    return `COMPRESSED:${ratio}:${data.substring(0, targetLength)}`
  }

  private simulateDecompression(compressed: string, originalSize: number): string {
    // Simulación simple: extraer datos originales
    if (compressed.startsWith('COMPRESSED:')) {
      const parts = compressed.split(':')
      const ratio = parseFloat(parts[1])
      const truncatedData = parts.slice(2).join(':')
      
      // Simular restauración de datos
      return truncatedData.padEnd(originalSize, ' ')
    }
    
    return compressed
  }
}

export class RequestCache {
  private cache: Map<string, { data: Record<string, unknown>; timestamp: number; accessCount: number }> = new Map()
  private config: CacheConfig
  private accessOrder: string[] = []

  constructor(config: CacheConfig) {
    this.config = config
    this.startCleanupInterval()
  }

  get(key: string): Record<string, unknown> | null {
    if (!this.config.enabled) return null

    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > this.config.ttl) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      return null
    }

    entry.accessCount++
    this.updateAccessOrder(key)
    
    return entry.data
  }

  set(key: string, data: Record<string, unknown>): void {
    if (!this.config.enabled) return

    const now = Date.now()
    
    // Check cache size limit
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLeastUsed()
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      accessCount: 1
    })

    this.updateAccessOrder(key)
  }

  private evictLeastUsed(): void {
    if (this.cache.size === 0) return

    let keyToEvict: string

    switch (this.config.strategy) {
      case 'lru':
        keyToEvict = this.accessOrder[0]
        break
      case 'lfu':
        keyToEvict = Array.from(this.cache.entries())
          .sort((a, b) => a[1].accessCount - b[1].accessCount)[0][0]
        break
      case 'fifo':
        keyToEvict = Array.from(this.cache.keys())[0]
        break
      default:
        keyToEvict = this.accessOrder[0]
    }

    this.cache.delete(keyToEvict)
    this.removeFromAccessOrder(keyToEvict)
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key)
    this.accessOrder.push(key)
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now()
      const keysToDelete: string[] = []

      this.cache.forEach((entry, key) => {
        if (now - entry.timestamp > this.config.ttl) {
          keysToDelete.push(key)
        }
      })

      keysToDelete.forEach(key => {
        this.cache.delete(key)
        this.removeFromAccessOrder(key)
      })
    }, this.config.ttl / 2)
  }

  getHitRate(): number {
    const totalRequests = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.accessCount, 0)
    
    if (totalRequests === 0) return 0
    
    const hits = this.cache.size
    return hits / totalRequests
  }

  getStats(): { size: number; hitRate: number; totalRequests: number } {
    const totalRequests = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.accessCount, 0)
    
    return {
      size: this.cache.size,
      hitRate: this.getHitRate(),
      totalRequests
    }
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder = []
  }
}

export class CommunicationOptimizer {
  private connectionPool: ConnectionPool
  private compressor: DataCompressor
  private cache: RequestCache
  private metrics: ProtocolMetrics[] = []
  private config: ConnectionConfig
  private compressionConfig: CompressionConfig
  private cacheConfig: CacheConfig

  constructor(
    connectionConfig: ConnectionConfig,
    compressionConfig: CompressionConfig,
    cacheConfig: CacheConfig
  ) {
    this.config = connectionConfig
    this.compressionConfig = compressionConfig
    this.cacheConfig = cacheConfig
    
    this.connectionPool = new ConnectionPool(connectionConfig)
    this.compressor = new DataCompressor(compressionConfig)
    this.cache = new RequestCache(cacheConfig)
  }

  async optimizedRequest<T>(
    operation: string,
    requestFn: () => Promise<T>,
    cacheKey?: string,
    options: {
      useCache?: boolean
      useCompression?: boolean
      retryOnFailure?: boolean
    } = {}
  ): Promise<T> {
    const startTime = performance.now()
    let result: T
    let fromCache = false
    let compressionRatio = 1
    let retryCount = 0

    const {
      useCache = true,
      useCompression = true,
      retryOnFailure = true
    } = options

    // Try cache first
    if (useCache && cacheKey) {
      const cachedResult = this.cache.get(cacheKey)
      if (cachedResult) {
        fromCache = true
        result = cachedResult
      }
    }

    if (!fromCache) {
      // Execute request with retries
      while (retryCount <= this.config.retryAttempts) {
        try {
          const connection = await this.connectionPool.getConnection()
          
          try {
            result = await Promise.race([
              requestFn(),
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), this.config.connectionTimeout)
              )
            ])

            // Handle compression if enabled
            if (useCompression && result) {
              const compressionResult = await this.compressor.compress(result)
              compressionRatio = compressionResult.ratio
              
              // In a real implementation, you'd send the compressed data
              // For demo purposes, we'll just track the compression ratio
            }

            // Cache the result
            if (useCache && cacheKey) {
              this.cache.set(cacheKey, result)
            }

            break
          } finally {
            this.connectionPool.releaseConnection()
          }
        } catch (error) {
          retryCount++
          
          if (retryCount > this.config.retryAttempts || !retryOnFailure) {
            throw error
          }
          
          // Exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, retryCount - 1)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    const endTime = performance.now()
    const latency = endTime - startTime

    // Record metrics
    await this.recordMetrics({
      timestamp: new Date(),
      operation,
      latency,
      throughput: 1000 / latency, // Operations per second
      compressionRatio: compressionRatio > 1 ? compressionRatio : undefined,
      cacheHitRate: fromCache ? 1 : 0,
      connectionPoolUtilization: this.connectionPool.getUtilization(),
      errorRate: retryCount > 0 ? retryCount / (retryCount + 1) : 0,
      retryCount
    })

    return result!
  }

  async batchRequest<T>(
    operation: string,
    requests: Array<() => Promise<T>>,
    options: {
      batchSize?: number
      useCompression?: boolean
      parallel?: boolean
    } = {}
  ): Promise<T[]> {
    const {
      batchSize = this.config.batchSize,
      useCompression = true,
      parallel = true
    } = options

    const startTime = performance.now()
    const results: T[] = []
    
    // Process requests in batches
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize)
      
      let batchResults: T[]
      
      if (parallel) {
        batchResults = await Promise.all(
          batch.map(request => this.optimizedRequest(
            `${operation}_batch_item`,
            request,
            undefined,
            { useCompression }
          ))
        )
      } else {
        batchResults = []
        for (const request of batch) {
          const result = await this.optimizedRequest(
            `${operation}_batch_item`,
            request,
            undefined,
            { useCompression }
          )
          batchResults.push(result)
        }
      }
      
      results.push(...batchResults)
    }

    const endTime = performance.now()
    const latency = endTime - startTime

    await this.recordMetrics({
      timestamp: new Date(),
      operation: `${operation}_batch`,
      latency,
      throughput: results.length / (latency / 1000),
      connectionPoolUtilization: this.connectionPool.getUtilization(),
      errorRate: 0,
      retryCount: 0
    })

    return results
  }

  private async recordMetrics(metrics: ProtocolMetrics): Promise<void> {
    this.metrics.push(metrics)
    
    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }

    // Record in performance monitor
    await syncPerformanceMonitor.recordSyncOperation(
      metrics.operation,
      Date.now() - metrics.latency,
      Date.now(),
      1,
      metrics.errorRate === 0 ? 1 : 0,
      metrics.errorRate > 0 ? ['Communication error'] : [],
      {
        latency: metrics.latency,
        throughput: metrics.throughput,
        compressionRatio: metrics.compressionRatio,
        cacheHitRate: metrics.cacheHitRate,
        connectionPoolUtilization: metrics.connectionPoolUtilization,
        retryCount: metrics.retryCount
      }
    )
  }

  async optimizeConfiguration(): Promise<OptimizationResult> {
    const recentMetrics = this.metrics.slice(-100) // Last 100 operations
    
    if (recentMetrics.length < 10) {
      throw new Error('Insufficient metrics for optimization')
    }

    const previousConfig = { ...this.config }
    const newConfig = await this.calculateOptimalConfiguration(recentMetrics)
    
    const improvement = this.calculateImprovement(recentMetrics, newConfig)
    
    // Apply new configuration
    this.config = newConfig
    this.connectionPool = new ConnectionPool(newConfig)

    return {
      timestamp: new Date(),
      previousConfig,
      newConfig,
      improvementPercentage: improvement.overall,
      metrics: {
        latencyReduction: improvement.latency,
        throughputIncrease: improvement.throughput,
        errorRateReduction: improvement.errorRate
      },
      recommendations: this.generateOptimizationRecommendations(recentMetrics, newConfig)
    }
  }

  private async calculateOptimalConfiguration(metrics: ProtocolMetrics[]): Promise<ConnectionConfig> {
    const avgLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length
    const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length
    const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length
    const avgPoolUtilization = metrics.reduce((sum, m) => sum + m.connectionPoolUtilization, 0) / metrics.length

    const newConfig = { ...this.config }

    // Optimize connection pool size
    if (avgPoolUtilization > 0.8) {
      newConfig.maxConcurrentConnections = Math.min(
        newConfig.maxConcurrentConnections * 1.5,
        50
      )
    } else if (avgPoolUtilization < 0.3) {
      newConfig.maxConcurrentConnections = Math.max(
        newConfig.maxConcurrentConnections * 0.8,
        5
      )
    }

    // Optimize timeout based on latency
    if (avgLatency > newConfig.connectionTimeout * 0.8) {
      newConfig.connectionTimeout = Math.min(avgLatency * 2, 30000)
    }

    // Optimize batch size based on throughput
    if (avgThroughput < 10) {
      newConfig.batchSize = Math.min(newConfig.batchSize * 1.5, 100)
    } else if (avgThroughput > 50) {
      newConfig.batchSize = Math.max(newConfig.batchSize * 0.8, 10)
    }

    // Optimize retry configuration based on error rate
    if (avgErrorRate > 0.1) {
      newConfig.retryAttempts = Math.min(newConfig.retryAttempts + 1, 5)
      newConfig.retryDelay = Math.min(newConfig.retryDelay * 1.2, 5000)
    } else if (avgErrorRate < 0.01) {
      newConfig.retryAttempts = Math.max(newConfig.retryAttempts - 1, 1)
      newConfig.retryDelay = Math.max(newConfig.retryDelay * 0.8, 100)
    }

    return newConfig
  }

  private calculateImprovement(metrics: ProtocolMetrics[], newConfig: ConnectionConfig): {
    overall: number
    latency: number
    throughput: number
    errorRate: number
  } {
    const avgLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length
    const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length
    const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length

    // Estimate improvements based on configuration changes
    const poolSizeRatio = newConfig.maxConcurrentConnections / this.config.maxConcurrentConnections
    const timeoutRatio = newConfig.connectionTimeout / this.config.connectionTimeout
    const batchSizeRatio = newConfig.batchSize / this.config.batchSize

    const latencyImprovement = Math.max(0, (1 - timeoutRatio) * 20 + (poolSizeRatio - 1) * 10)
    const throughputImprovement = Math.max(0, (poolSizeRatio - 1) * 15 + (batchSizeRatio - 1) * 10)
    const errorRateImprovement = Math.max(0, avgErrorRate * 50) // Assume 50% error reduction

    const overallImprovement = (latencyImprovement + throughputImprovement + errorRateImprovement) / 3

    return {
      overall: overallImprovement,
      latency: latencyImprovement,
      throughput: throughputImprovement,
      errorRate: errorRateImprovement
    }
  }

  private generateOptimizationRecommendations(metrics: ProtocolMetrics[], newConfig: ConnectionConfig): string[] {
    const recommendations: string[] = []
    
    const avgLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length
    const avgThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length
    const avgErrorRate = metrics.reduce((sum, m) => sum + m.errorRate, 0) / metrics.length
    const avgPoolUtilization = metrics.reduce((sum, m) => sum + m.connectionPoolUtilization, 0) / metrics.length

    if (avgLatency > 1000) {
      recommendations.push('Considerar implementar CDN o cache distribuido para reducir latencia')
    }

    if (avgThroughput < 10) {
      recommendations.push('Optimizar consultas de base de datos y considerar indexación')
    }

    if (avgErrorRate > 0.05) {
      recommendations.push('Investigar causas de errores y mejorar manejo de excepciones')
    }

    if (avgPoolUtilization > 0.9) {
      recommendations.push('Considerar escalado horizontal o aumento de recursos')
    }

    const cacheHitRate = metrics
      .filter(m => m.cacheHitRate !== undefined)
      .reduce((sum, m) => sum + (m.cacheHitRate || 0), 0) / 
      metrics.filter(m => m.cacheHitRate !== undefined).length

    if (cacheHitRate < 0.5) {
      recommendations.push('Optimizar estrategia de cache y TTL')
    }

    const avgCompressionRatio = metrics
      .filter(m => m.compressionRatio !== undefined)
      .reduce((sum, m) => sum + (m.compressionRatio || 1), 0) / 
      metrics.filter(m => m.compressionRatio !== undefined).length

    if (avgCompressionRatio < 2) {
      recommendations.push('Evaluar algoritmos de compresión más eficientes')
    }

    if (recommendations.length === 0) {
      recommendations.push('Configuración óptima alcanzada, mantener monitoreo continuo')
    }

    return recommendations
  }

  getMetrics(): ProtocolMetrics[] {
    return [...this.metrics]
  }

  getConnectionPoolStats(): Record<string, unknown> {
    return this.connectionPool.getStats()
  }

  getCacheStats(): Record<string, unknown> {
    return this.cache.getStats()
  }

  getCurrentConfiguration(): {
    connection: ConnectionConfig
    compression: CompressionConfig
    cache: CacheConfig
  } {
    return {
      connection: { ...this.config },
      compression: { ...this.compressionConfig },
      cache: { ...this.cacheConfig }
    }
  }

  async clearCache(): Promise<void> {
    this.cache.clear()
  }

  async resetMetrics(): Promise<void> {
    this.metrics = []
  }
}

// Default configurations
export const defaultConnectionConfig: ConnectionConfig = {
  maxConcurrentConnections: 10,
  connectionTimeout: 10000,
  keepAliveInterval: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  compressionEnabled: true,
  batchSize: 50,
  poolSize: 5,
  idleTimeout: 300000 // 5 minutes
}

export const defaultCompressionConfig: CompressionConfig = {
  enabled: true,
  algorithm: 'gzip',
  level: 6,
  threshold: 1024 // 1KB
}

export const defaultCacheConfig: CacheConfig = {
  enabled: true,
  ttl: 300000, // 5 minutes
  maxSize: 100, // 100 entries
  strategy: 'lru'
}

export const communicationOptimizer = new CommunicationOptimizer(
  defaultConnectionConfig,
  defaultCompressionConfig,
  defaultCacheConfig
)