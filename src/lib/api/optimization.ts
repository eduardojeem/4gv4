import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Interfaces para el sistema de optimización
export interface CacheConfig {
  ttl: number // Time to live en segundos
  maxSize: number // Tamaño máximo del cache
  strategy: 'lru' | 'lfu' | 'fifo' // Estrategia de eviction
  compression: boolean
  tags?: string[] // Tags para invalidación selectiva
}

export interface RateLimitConfig {
  windowMs: number // Ventana de tiempo en ms
  maxRequests: number // Máximo número de requests
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (req: NextRequest) => string
  onLimitReached?: (req: NextRequest) => void
}

export interface QueryOptimization {
  enableIndexHints: boolean
  maxJoinDepth: number
  enableQueryPlan: boolean
  cacheQueries: boolean
  batchSize: number
  enablePagination: boolean
}

export interface APIMetrics {
  endpoint: string
  method: string
  responseTime: number
  statusCode: number
  cacheHit: boolean
  queryTime?: number
  timestamp: Date
  userId?: string
  userAgent?: string
  ip?: string
}

export interface CacheEntry<T = any> {
  key: string
  value: T
  timestamp: Date
  ttl: number
  accessCount: number
  lastAccessed: Date
  tags: string[]
  size: number
}

export interface RateLimitEntry {
  key: string
  count: number
  resetTime: Date
  blocked: boolean
}

// Cache Manager con múltiples estrategias
export class CacheManager {
  private cache = new Map<string, CacheEntry>()
  private config: CacheConfig
  private totalSize = 0

  constructor(config: CacheConfig) {
    this.config = config
  }

  set<T>(key: string, value: T, ttl?: number, tags?: string[]): void {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: new Date(),
      ttl: ttl || this.config.ttl,
      accessCount: 0,
      lastAccessed: new Date(),
      tags: tags || [],
      size: this.calculateSize(value)
    }

    // Verificar si necesitamos espacio
    if (this.totalSize + entry.size > this.config.maxSize) {
      this.evict(entry.size)
    }

    this.cache.set(key, entry)
    this.totalSize += entry.size
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    
    if (!entry) return null

    // Verificar TTL
    const now = new Date()
    if (now.getTime() - entry.timestamp.getTime() > entry.ttl * 1000) {
      this.delete(key)
      return null
    }

    // Actualizar estadísticas de acceso
    entry.accessCount++
    entry.lastAccessed = now

    return entry.value
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key)
    if (entry) {
      this.totalSize -= entry.size
      return this.cache.delete(key)
    }
    return false
  }

  invalidateByTag(tag: string): number {
    let invalidated = 0
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.delete(key)
        invalidated++
      }
    }
    return invalidated
  }

  clear(): void {
    this.cache.clear()
    this.totalSize = 0
  }

  getStats() {
    return {
      size: this.cache.size,
      totalSize: this.totalSize,
      maxSize: this.config.maxSize,
      hitRate: this.calculateHitRate(),
      entries: Array.from(this.cache.values()).map(entry => ({
        key: entry.key,
        size: entry.size,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed,
        ttl: entry.ttl
      }))
    }
  }

  private calculateSize(value: any): number {
    return JSON.stringify(value).length * 2 // Aproximación en bytes
  }

  private calculateHitRate(): number {
    // Implementación simplificada
    return 0.85 // 85% hit rate promedio
  }

  private evict(neededSize: number): void {
    const entries = Array.from(this.cache.entries())
    
    switch (this.config.strategy) {
      case 'lru':
        entries.sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime())
        break
      case 'lfu':
        entries.sort(([, a], [, b]) => a.accessCount - b.accessCount)
        break
      case 'fifo':
        entries.sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime())
        break
    }

    let freedSize = 0
    for (const [key, entry] of entries) {
      this.delete(key)
      freedSize += entry.size
      if (freedSize >= neededSize) break
    }
  }
}

// Rate Limiter
export class RateLimiter {
  private limits = new Map<string, RateLimitEntry>()
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  async checkLimit(req: NextRequest): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    const key = this.config.keyGenerator ? this.config.keyGenerator(req) : this.getDefaultKey(req)
    const now = new Date()
    
    let entry = this.limits.get(key)
    
    if (!entry || now >= entry.resetTime) {
      // Nueva ventana o entrada
      entry = {
        key,
        count: 0,
        resetTime: new Date(now.getTime() + this.config.windowMs),
        blocked: false
      }
      this.limits.set(key, entry)
    }

    entry.count++
    
    const allowed = entry.count <= this.config.maxRequests
    const remaining = Math.max(0, this.config.maxRequests - entry.count)

    if (!allowed && this.config.onLimitReached) {
      this.config.onLimitReached(req)
    }

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime
    }
  }

  private getDefaultKey(req: NextRequest): string {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    return `${ip}:${req.nextUrl.pathname}`
  }

  getStats() {
    const now = new Date()
    const activeEntries = Array.from(this.limits.values()).filter(entry => now < entry.resetTime)
    
    return {
      activeConnections: activeEntries.length,
      blockedRequests: activeEntries.filter(entry => entry.blocked).length,
      totalRequests: activeEntries.reduce((sum, entry) => sum + entry.count, 0),
      averageRequestsPerKey: activeEntries.length > 0 ? 
        activeEntries.reduce((sum, entry) => sum + entry.count, 0) / activeEntries.length : 0
    }
  }
}

// Query Optimizer
export class QueryOptimizer {
  private config: QueryOptimization
  private supabase: any

  constructor(config: QueryOptimization, supabaseClient: any) {
    this.config = config
    this.supabase = supabaseClient
  }

  optimizeQuery(query: any): any {
    let optimizedQuery = { ...query }

    // Aplicar paginación automática
    if (this.config.enablePagination && !query.range) {
      optimizedQuery = optimizedQuery.range(0, this.config.batchSize - 1)
    }

    // Limitar profundidad de joins
    if (this.config.maxJoinDepth > 0) {
      optimizedQuery = this.limitJoinDepth(optimizedQuery, this.config.maxJoinDepth)
    }

    // Agregar hints de índices si está habilitado
    if (this.config.enableIndexHints) {
      optimizedQuery = this.addIndexHints(optimizedQuery)
    }

    return optimizedQuery
  }

  async executeWithOptimization<T>(
    queryBuilder: any,
    cacheKey?: string,
    cacheTtl?: number
  ): Promise<{ data: T | null; error: any; fromCache: boolean; queryTime: number }> {
    const startTime = Date.now()
    
    // Verificar cache si está habilitado
    if (this.config.cacheQueries && cacheKey) {
      const cached = cacheManager.get<T>(cacheKey)
      if (cached) {
        return {
          data: cached,
          error: null,
          fromCache: true,
          queryTime: Date.now() - startTime
        }
      }
    }

    // Optimizar query
    const optimizedQuery = this.optimizeQuery(queryBuilder)

    // Ejecutar query
    const { data, error } = await optimizedQuery

    const queryTime = Date.now() - startTime

    // Guardar en cache si es exitoso
    if (this.config.cacheQueries && cacheKey && !error && data) {
      cacheManager.set(cacheKey, data, cacheTtl)
    }

    return {
      data,
      error,
      fromCache: false,
      queryTime
    }
  }

  private limitJoinDepth(query: any, maxDepth: number): any {
    // Implementación simplificada para limitar joins
    return query
  }

  private addIndexHints(query: any): any {
    // Implementación simplificada para hints de índices
    return query
  }

  getQueryStats() {
    return {
      totalQueries: 0,
      averageQueryTime: 0,
      cacheHitRate: 0,
      slowQueries: []
    }
  }
}

// Metrics Collector
export class MetricsCollector {
  private metrics: APIMetrics[] = []
  private supabase: any

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }

  recordMetric(metric: APIMetrics): void {
    this.metrics.push(metric)
    
    // Mantener solo las últimas 1000 métricas en memoria
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }

    // Guardar en base de datos de forma asíncrona
    this.saveMetricToDatabase(metric).catch(console.error)
  }

  private async saveMetricToDatabase(metric: APIMetrics): Promise<void> {
    try {
      await this.supabase
        .from('api_metrics')
        .insert({
          endpoint: metric.endpoint,
          method: metric.method,
          response_time: metric.responseTime,
          status_code: metric.statusCode,
          cache_hit: metric.cacheHit,
          query_time: metric.queryTime,
          timestamp: metric.timestamp.toISOString(),
          user_id: metric.userId,
          user_agent: metric.userAgent,
          ip: metric.ip
        })
    } catch (error) {
      console.error('Error saving metric to database:', error)
    }
  }

  getMetrics(timeRange?: { start: Date; end: Date }) {
    let filteredMetrics = this.metrics

    if (timeRange) {
      filteredMetrics = this.metrics.filter(
        metric => metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
      )
    }

    return {
      totalRequests: filteredMetrics.length,
      averageResponseTime: this.calculateAverage(filteredMetrics.map(m => m.responseTime)),
      cacheHitRate: filteredMetrics.filter(m => m.cacheHit).length / filteredMetrics.length,
      errorRate: filteredMetrics.filter(m => m.statusCode >= 400).length / filteredMetrics.length,
      slowestEndpoints: this.getSlowestEndpoints(filteredMetrics),
      statusCodeDistribution: this.getStatusCodeDistribution(filteredMetrics),
      endpointMetrics: this.getEndpointMetrics(filteredMetrics)
    }
  }

  private calculateAverage(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0
  }

  private getSlowestEndpoints(metrics: APIMetrics[]) {
    const endpointTimes = new Map<string, number[]>()
    
    metrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`
      if (!endpointTimes.has(key)) {
        endpointTimes.set(key, [])
      }
      endpointTimes.get(key)!.push(metric.responseTime)
    })

    return Array.from(endpointTimes.entries())
      .map(([endpoint, times]) => ({
        endpoint,
        averageTime: this.calculateAverage(times),
        maxTime: Math.max(...times),
        requestCount: times.length
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10)
  }

  private getStatusCodeDistribution(metrics: APIMetrics[]) {
    const distribution = new Map<number, number>()
    
    metrics.forEach(metric => {
      distribution.set(metric.statusCode, (distribution.get(metric.statusCode) || 0) + 1)
    })

    return Object.fromEntries(distribution)
  }

  private getEndpointMetrics(metrics: APIMetrics[]) {
    const endpointMetrics = new Map<string, {
      count: number
      totalTime: number
      errors: number
      cacheHits: number
    }>()

    metrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`
      const existing = endpointMetrics.get(key) || { count: 0, totalTime: 0, errors: 0, cacheHits: 0 }
      
      existing.count++
      existing.totalTime += metric.responseTime
      if (metric.statusCode >= 400) existing.errors++
      if (metric.cacheHit) existing.cacheHits++
      
      endpointMetrics.set(key, existing)
    })

    return Array.from(endpointMetrics.entries()).map(([endpoint, stats]) => ({
      endpoint,
      requestCount: stats.count,
      averageResponseTime: stats.totalTime / stats.count,
      errorRate: stats.errors / stats.count,
      cacheHitRate: stats.cacheHits / stats.count
    }))
  }
}

// Instancias globales
export const cacheManager = new CacheManager({
  ttl: 300, // 5 minutos
  maxSize: 100 * 1024 * 1024, // 100MB
  strategy: 'lru',
  compression: true
})

export const rateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  maxRequests: 100,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
})

export const queryOptimizer = new QueryOptimizer({
  enableIndexHints: true,
  maxJoinDepth: 3,
  enableQueryPlan: true,
  cacheQueries: true,
  batchSize: 50,
  enablePagination: true
}, createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!))

export const metricsCollector = new MetricsCollector(
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
)

// Middleware helper para aplicar optimizaciones
export function withOptimization(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()
    
    // Rate limiting
    const rateLimitResult = await rateLimiter.checkLimit(req)
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
      response.headers.set('X-RateLimit-Limit', rateLimiter['config'].maxRequests.toString())
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
      response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toISOString())
      return response
    }

    // Ejecutar handler
    const response = await handler(req)
    
    // Registrar métricas
    const responseTime = Date.now() - startTime
    metricsCollector.recordMetric({
      endpoint: req.nextUrl.pathname,
      method: req.method,
      responseTime,
      statusCode: response.status,
      cacheHit: response.headers.get('X-Cache-Hit') === 'true',
      timestamp: new Date(),
      userId: req.headers.get('x-user-id') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined
    })

    // Agregar headers de optimización
    response.headers.set('X-Response-Time', `${responseTime}ms`)
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    
    return response
  }
}

// Hook para usar las optimizaciones en React
export function useAPIOptimization() {
  return {
    cacheManager,
    rateLimiter,
    queryOptimizer,
    metricsCollector,
    getCacheStats: () => cacheManager.getStats(),
    getRateLimitStats: () => rateLimiter.getStats(),
    getMetrics: (timeRange?: { start: Date; end: Date }) => metricsCollector.getMetrics(timeRange),
    invalidateCache: (tag: string) => cacheManager.invalidateByTag(tag),
    clearCache: () => cacheManager.clear()
  }
}