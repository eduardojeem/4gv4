/**
 * API Cache Middleware
 * 
 * Proporciona cache inteligente para APIs con:
 * - TTL configurable por endpoint
 * - Invalidación selectiva
 * - Compresión de datos
 * - Métricas de hit ratio
 */

import { NextRequest, NextResponse } from 'next/server'

interface CacheOptions {
  ttl?: number                    // Time to live en segundos
  key?: string                   // Clave personalizada de cache
  condition?: (req: NextRequest) => boolean  // Condición para cachear
  compress?: boolean             // Comprimir datos en cache
  tags?: string[]               // Tags para invalidación selectiva
}

interface CacheEntry {
  data: any
  timestamp: number
  ttl: number
  tags: string[]
  compressed: boolean
}

class APICache {
  private cache = new Map<string, CacheEntry>()
  private readonly MAX_SIZE = 1000
  private readonly DEFAULT_TTL = 300 // 5 minutos
  
  // Métricas
  private hits = 0
  private misses = 0
  private totalRequests = 0

  constructor() {
    // Limpiar cache expirado cada 5 minutos
    setInterval(() => {
      this.cleanExpired()
    }, 5 * 60 * 1000)
  }

  async get(key: string): Promise<any | null> {
    this.totalRequests++
    
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.misses++
      return null
    }

    // Verificar si expiró
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key)
      this.misses++
      return null
    }

    this.hits++
    
    // Descomprimir si es necesario
    if (entry.compressed) {
      return this.decompress(entry.data)
    }
    
    return entry.data
  }

  async set(key: string, data: any, options: CacheOptions = {}): Promise<void> {
    const {
      ttl = this.DEFAULT_TTL,
      compress = false,
      tags = []
    } = options

    // Implementar LRU: eliminar el más antiguo si excede el tamaño
    if (this.cache.size >= this.MAX_SIZE) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    let processedData = data
    
    // Comprimir si es necesario
    if (compress) {
      processedData = await this.compress(data)
    }

    const entry: CacheEntry = {
      data: processedData,
      timestamp: Date.now(),
      ttl,
      tags,
      compressed: compress
    }

    this.cache.set(key, entry)
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  invalidateByTag(tag: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
    this.totalRequests = 0
  }

  getStats() {
    const hitRatio = this.totalRequests > 0 ? (this.hits / this.totalRequests) * 100 : 0
    
    return {
      size: this.cache.size,
      maxSize: this.MAX_SIZE,
      hits: this.hits,
      misses: this.misses,
      totalRequests: this.totalRequests,
      hitRatio: Math.round(hitRatio * 100) / 100,
      memoryUsage: this.getMemoryUsage()
    }
  }

  private cleanExpired(): void {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.cache.delete(key)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      console.debug(`[API Cache] Cleaned ${cleaned} expired entries`)
    }
  }

  private async compress(data: any): Promise<string> {
    try {
      // Comprimir usando gzip si está disponible
      if (typeof CompressionStream !== 'undefined') {
        const stream = new CompressionStream('gzip')
        const writer = stream.writable.getWriter()
        const reader = stream.readable.getReader()
        
        writer.write(new TextEncoder().encode(JSON.stringify(data)))
        writer.close()
        
        const chunks: Uint8Array[] = []
        let done = false
        
        while (!done) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone
          if (value) chunks.push(value)
        }
        
        const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
        let offset = 0
        for (const chunk of chunks) {
          compressed.set(chunk, offset)
          offset += chunk.length
        }
        
        return btoa(String.fromCharCode(...compressed))
      }
    } catch (error) {
      console.warn('Compression failed, storing uncompressed:', error)
    }
    
    // Fallback: almacenar sin comprimir
    return JSON.stringify(data)
  }

  private async decompress(compressedData: string): Promise<any> {
    try {
      // Intentar descomprimir
      if (typeof DecompressionStream !== 'undefined') {
        const compressed = Uint8Array.from(atob(compressedData), c => c.charCodeAt(0))
        const stream = new DecompressionStream('gzip')
        const writer = stream.writable.getWriter()
        const reader = stream.readable.getReader()
        
        writer.write(compressed)
        writer.close()
        
        const chunks: Uint8Array[] = []
        let done = false
        
        while (!done) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone
          if (value) chunks.push(value)
        }
        
        const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
        let offset = 0
        for (const chunk of chunks) {
          decompressed.set(chunk, offset)
          offset += chunk.length
        }
        
        const text = new TextDecoder().decode(decompressed)
        return JSON.parse(text)
      }
    } catch (error) {
      console.warn('Decompression failed, trying as JSON:', error)
    }
    
    // Fallback: parsear como JSON normal
    return JSON.parse(compressedData)
  }

  private getMemoryUsage(): number {
    let totalSize = 0
    
    for (const [key, entry] of this.cache.entries()) {
      // Estimar tamaño en bytes
      totalSize += key.length * 2 // UTF-16
      totalSize += JSON.stringify(entry).length * 2
    }
    
    return Math.round(totalSize / 1024) // KB
  }
}

// Instancia global del cache
const apiCache = new APICache()

/**
 * Middleware para cachear responses de API
 */
export function withApiCache(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: CacheOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const {
      ttl = 300,
      key = req.url,
      condition = (req) => req.method === 'GET',
      compress = false,
      tags = []
    } = options

    // Solo cachear si se cumple la condición
    if (!condition(req)) {
      return handler(req)
    }

    const cacheKey = `api:${key}`
    
    // Intentar obtener del cache
    const cached = await apiCache.get(cacheKey)
    
    if (cached) {
      // Cache hit
      const response = NextResponse.json(cached)
      response.headers.set('X-Cache', 'HIT')
      response.headers.set('X-Cache-Key', cacheKey)
      response.headers.set('Cache-Control', `public, max-age=${ttl}`)
      return response
    }

    // Cache miss - ejecutar handler
    const response = await handler(req)
    
    // Solo cachear responses exitosos
    if (response.ok) {
      try {
        const data = await response.clone().json()
        await apiCache.set(cacheKey, data, { ttl, compress, tags })
        
        // Añadir headers de cache
        response.headers.set('X-Cache', 'MISS')
        response.headers.set('X-Cache-Key', cacheKey)
        response.headers.set('Cache-Control', `public, max-age=${ttl}`)
      } catch (error) {
        console.warn('Failed to cache API response:', error)
      }
    }

    return response
  }
}

/**
 * Configuraciones predefinidas para diferentes tipos de datos
 */
export const cacheConfigs = {
  // Datos estáticos (productos, categorías)
  static: {
    ttl: 1800,        // 30 minutos
    compress: true,
    tags: ['static']
  },
  
  // Datos dinámicos (clientes, ventas)
  dynamic: {
    ttl: 300,         // 5 minutos
    compress: false,
    tags: ['dynamic']
  },
  
  // Reportes y analytics
  reports: {
    ttl: 900,         // 15 minutos
    compress: true,
    tags: ['reports']
  },
  
  // Búsquedas
  search: {
    ttl: 600,         // 10 minutos
    compress: false,
    tags: ['search']
  }
}

/**
 * Utilidades para manejo de cache
 */
export const cacheUtils = {
  // Obtener estadísticas
  getStats: () => apiCache.getStats(),
  
  // Invalidar por clave
  invalidate: (key: string) => apiCache.invalidate(`api:${key}`),
  
  // Invalidar por tag
  invalidateTag: (tag: string) => apiCache.invalidateByTag(tag),
  
  // Limpiar todo
  clear: () => apiCache.clear(),
  
  // Precalentar cache
  warmup: async (endpoints: Array<{ url: string, options?: CacheOptions }>) => {
    const results = await Promise.allSettled(
      endpoints.map(async ({ url, options = {} }) => {
        try {
          const response = await fetch(url)
          if (response.ok) {
            const data = await response.json()
            await apiCache.set(`api:${url}`, data, options)
            return { url, success: true }
          }
        } catch (error) {
          return { url, success: false, error }
        }
      })
    )
    
    const successful = results.filter(r => r.status === 'fulfilled').length
    console.log(`[API Cache] Warmed up ${successful}/${endpoints.length} endpoints`)
    
    return results
  }
}

export default apiCache