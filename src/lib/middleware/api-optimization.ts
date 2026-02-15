import { NextRequest, NextResponse } from 'next/server'
import { 
  cacheManager, 
  rateLimiter, 
  metricsCollector, 
  withOptimization,
  CacheConfig,
  RateLimitConfig
} from '@/lib/api/optimization'

// Configuraciones específicas por ruta
const routeConfigs: Record<string, {
  cache?: Partial<CacheConfig>
  rateLimit?: Partial<RateLimitConfig>
  enableOptimization?: boolean
}> = {
  '/api/products': {
    cache: { ttl: 600, tags: ['products'] }, // 10 minutos
    rateLimit: { maxRequests: 200, windowMs: 15 * 60 * 1000 },
    enableOptimization: true
  },
  '/api/sales': {
    cache: { ttl: 300, tags: ['sales'] }, // 5 minutos
    rateLimit: { maxRequests: 150, windowMs: 15 * 60 * 1000 },
    enableOptimization: true
  },
  '/api/inventory': {
    cache: { ttl: 180, tags: ['inventory'] }, // 3 minutos
    rateLimit: { maxRequests: 100, windowMs: 15 * 60 * 1000 },
    enableOptimization: true
  },
  '/api/customers': {
    cache: { ttl: 900, tags: ['customers'] }, // 15 minutos
    rateLimit: { maxRequests: 80, windowMs: 15 * 60 * 1000 },
    enableOptimization: true
  },
  '/api/reports': {
    cache: { ttl: 1800, tags: ['reports'] }, // 30 minutos
    rateLimit: { maxRequests: 20, windowMs: 15 * 60 * 1000 },
    enableOptimization: true
  },
  '/api/auth': {
    rateLimit: { maxRequests: 10, windowMs: 15 * 60 * 1000 },
    enableOptimization: false // No cache para auth
  }
}

// Middleware principal de optimización
export function apiOptimizationMiddleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Solo aplicar a rutas de API
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Obtener configuración para la ruta
  const config = getRouteConfig(pathname)
  
  if (!config.enableOptimization) {
    return NextResponse.next()
  }

  // Aplicar optimizaciones usando el wrapper
  return withOptimization(async (req: NextRequest) => {
    // El handler real se ejecutará en el endpoint específico
    return NextResponse.next()
  })(request)
}

// Función para obtener configuración de ruta
function getRouteConfig(pathname: string) {
  // Buscar configuración exacta
  if (routeConfigs[pathname]) {
    return routeConfigs[pathname]
  }

  // Buscar configuración por patrón
  for (const [pattern, config] of Object.entries(routeConfigs)) {
    if (pathname.startsWith(pattern)) {
      return config
    }
  }

  // Configuración por defecto
  return {
    cache: { ttl: 300, tags: [] },
    rateLimit: { maxRequests: 100, windowMs: 15 * 60 * 1000 },
    enableOptimization: true
  }
}

// Helper para cache en endpoints específicos
export function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    ttl?: number
    tags?: string[]
    skipCache?: boolean
  }
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      const { ttl = 300, tags = [], skipCache = false } = options || {}

      // Verificar cache si no se debe saltar
      if (!skipCache) {
        const cached = cacheManager.get<T>(key)
        if (cached) {
          resolve(cached)
          return
        }
      }

      // Ejecutar fetcher
      const result = await fetcher()
      
      // Guardar en cache
      cacheManager.set(key, result, ttl, tags)
      
      resolve(result)
    } catch (error) {
      reject(error)
    }
  })
}

// Helper para rate limiting en endpoints específicos
export async function checkRateLimit(
  request: NextRequest,
  options?: {
    maxRequests?: number
    windowMs?: number
    keyGenerator?: (req: NextRequest) => string
  }
): Promise<{
  allowed: boolean
  remaining: number
  resetTime: Date
  headers: Record<string, string>
}> {
  const result = await rateLimiter.checkLimit(request)
  
  const headers = {
    'X-RateLimit-Limit': (options?.maxRequests || 100).toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetTime.toISOString()
  }

  return {
    ...result,
    headers
  }
}

// Helper para métricas en endpoints específicos
export function recordAPIMetric(
  request: NextRequest,
  response: NextResponse,
  startTime: number,
  options?: {
    cacheHit?: boolean
    queryTime?: number
  }
) {
  const responseTime = Date.now() - startTime
  
  metricsCollector.recordMetric({
    endpoint: request.nextUrl.pathname,
    method: request.method,
    responseTime,
    statusCode: response.status,
    cacheHit: options?.cacheHit || false,
    queryTime: options?.queryTime,
    timestamp: new Date(),
    userId: request.headers.get('x-user-id') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
  })
}

// Decorator para endpoints optimizados
export function optimizedEndpoint(
  options?: {
    cache?: {
      enabled?: boolean
      ttl?: number
      tags?: string[]
      keyGenerator?: (req: NextRequest) => string
    }
    rateLimit?: {
      enabled?: boolean
      maxRequests?: number
      windowMs?: number
    }
    metrics?: {
      enabled?: boolean
    }
  }
) {
  return function (
    target: unknown,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value

    descriptor.value = async function (request: NextRequest, ...args: unknown[]) {
      const startTime = Date.now()
      let cacheHit = false
      let queryTime: number | undefined

      try {
        // Rate limiting
        if (options?.rateLimit?.enabled !== false) {
          const rateLimitResult = await checkRateLimit(request, options?.rateLimit)
          if (!rateLimitResult.allowed) {
            const response = NextResponse.json(
              { error: 'Rate limit exceeded' },
              { status: 429 }
            )
            
            // Agregar headers de rate limit
            Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
              response.headers.set(key, value)
            })

            return response
          }
        }

        // Cache
        if (options?.cache?.enabled !== false && request.method === 'GET') {
          const cacheKey = options?.cache?.keyGenerator 
            ? options.cache.keyGenerator(request)
            : `${request.method}:${request.nextUrl.pathname}:${request.nextUrl.search}`

          const cached = cacheManager.get(cacheKey)
          if (cached) {
            cacheHit = true
            const response = NextResponse.json(cached)
            response.headers.set('X-Cache-Hit', 'true')
            
            // Registrar métricas
            if (options?.metrics?.enabled !== false) {
              recordAPIMetric(request, response, startTime, { cacheHit, queryTime })
            }
            
            return response
          }
        }

        // Ejecutar método original
        const queryStartTime = Date.now()
        const result = await method.call(this, request, ...args)
        queryTime = Date.now() - queryStartTime

        // Guardar en cache si es exitoso
        if (options?.cache?.enabled !== false && 
            request.method === 'GET' && 
            result.status === 200) {
          const cacheKey = options?.cache?.keyGenerator 
            ? options.cache.keyGenerator(request)
            : `${request.method}:${request.nextUrl.pathname}:${request.nextUrl.search}`

          try {
            const data = await result.clone().json()
            cacheManager.set(
              cacheKey, 
              data, 
              options?.cache?.ttl, 
              options?.cache?.tags
            )
          } catch (error) {
            // Ignorar errores de cache
          }
        }

        // Registrar métricas
        if (options?.metrics?.enabled !== false) {
          recordAPIMetric(request, result, startTime, { cacheHit, queryTime })
        }

        return result

      } catch (error) {
        // Registrar métricas de error
        if (options?.metrics?.enabled !== false) {
          const errorResponse = NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
          )
          recordAPIMetric(request, errorResponse, startTime, { cacheHit, queryTime })
        }
        
        throw error
      }
    }

    return descriptor
  }
}

// Función para invalidar cache por tags
export function invalidateCacheByTags(tags: string[]) {
  tags.forEach(tag => {
    cacheManager.invalidateByTag(tag)
  })
}

// Función para obtener estadísticas de optimización
export function getOptimizationStats() {
  return {
    cache: cacheManager.getStats(),
    rateLimit: rateLimiter.getStats(),
    metrics: metricsCollector.getMetrics()
  }
}

// Configuración de middleware para Next.js
export const config = {
  matcher: [
    '/api/:path*'
  ]
}

// Exportar middleware por defecto
export default apiOptimizationMiddleware