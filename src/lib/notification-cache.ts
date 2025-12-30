/**
 * Sistema de caché para optimizar notificaciones y reducir tiempos de respuesta
 */

interface CacheEntry<T = unknown> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

interface NotificationCache {
  [key: string]: CacheEntry
}

class NotificationCacheManager {
  private cache: NotificationCache = {}
  private readonly defaultTTL = 5 * 60 * 1000 // 5 minutos por defecto

  /**
   * Almacena datos en caché con TTL personalizable
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache[key] = {
      data,
      timestamp: Date.now(),
      ttl
    }
  }

  /**
   * Obtiene datos del caché si están válidos
   */
  get<T>(key: string): T | null {
    const entry = this.cache[key]
    
    if (!entry) {
      return null
    }

    const now = Date.now()
    const isExpired = (now - entry.timestamp) > entry.ttl

    if (isExpired) {
      delete this.cache[key]
      return null
    }

    return entry.data as T
  }

  /**
   * Verifica si una clave existe y es válida
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Elimina una entrada específica del caché
   */
  delete(key: string): void {
    delete this.cache[key]
  }

  /**
   * Limpia todo el caché
   */
  clear(): void {
    this.cache = {}
  }

  /**
   * Limpia entradas expiradas
   */
  cleanup(): void {
    const now = Date.now()
    Object.keys(this.cache).forEach(key => {
      const entry = this.cache[key]
      if ((now - entry.timestamp) > entry.ttl) {
        delete this.cache[key]
      }
    })
  }

  /**
   * Obtiene estadísticas del caché
   */
  getStats(): {
    totalEntries: number
    validEntries: number
    expiredEntries: number
    cacheHitRate: number
  } {
    const totalEntries = Object.keys(this.cache).length
    const now = Date.now()
    let validEntries = 0
    let expiredEntries = 0

    Object.values(this.cache).forEach(entry => {
      if ((now - entry.timestamp) <= entry.ttl) {
        validEntries++
      } else {
        expiredEntries++
      }
    })

    return {
      totalEntries,
      validEntries,
      expiredEntries,
      cacheHitRate: totalEntries > 0 ? (validEntries / totalEntries) * 100 : 0
    }
  }
}

// Instancia singleton del caché
export const notificationCache = new NotificationCacheManager()

/**
 * Hook para operaciones con caché optimizado
 */
export function useCachedOperation<T>(
  key: string,
  operation: () => Promise<T>,
  ttl?: number
): () => Promise<T> {
  return async (): Promise<T> => {
    // Intentar obtener del caché primero
    const cached = notificationCache.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Si no está en caché, ejecutar operación
    try {
      const result = await operation()
      notificationCache.set(key, result, ttl)
      return result
    } catch (error) {
      // No cachear errores
      throw error
    }
  }
}

/**
 * Utilidad para crear claves de caché consistentes
 */
export function createCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`
}

/**
 * Configuración de TTL por tipo de operación
 */
export const CACHE_TTL = {
  PRODUCT_LIST: 2 * 60 * 1000,      // 2 minutos
  PRODUCT_DETAILS: 5 * 60 * 1000,   // 5 minutos
  USER_ACTIONS: 30 * 1000,          // 30 segundos
  QUICK_STATS: 1 * 60 * 1000,       // 1 minuto
  EXPORT_DATA: 10 * 60 * 1000,      // 10 minutos
} as const

/**
 * Limpieza automática del caché cada 5 minutos
 */
if (typeof window !== 'undefined') {
  setInterval(() => {
    notificationCache.cleanup()
  }, 5 * 60 * 1000)
}