/**
 * Rate Limiting para operaciones sensibles
 * Previene abuso y ataques de fuerza bruta
 */

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

// Almacenamiento en memoria (en producción usar Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

/**
 * Configuraciones predefinidas de rate limiting
 */
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  settings_update: {
    maxRequests: 10,
    windowMs: 60000 // 10 actualizaciones por minuto
  },
  system_action_backup: {
    maxRequests: 3,
    windowMs: 300000 // 3 backups cada 5 minutos
  },
  system_action_clearCache: {
    maxRequests: 5,
    windowMs: 60000 // 5 limpiezas por minuto
  },
  system_action_checkIntegrity: {
    maxRequests: 3,
    windowMs: 300000 // 3 verificaciones cada 5 minutos
  },
  system_action_testEmail: {
    maxRequests: 5,
    windowMs: 300000 // 5 emails de prueba cada 5 minutos
  },
  settings_import: {
    maxRequests: 3,
    windowMs: 300000 // 3 importaciones cada 5 minutos
  },
  settings_export: {
    maxRequests: 10,
    windowMs: 60000 // 10 exportaciones por minuto
  }
}

/**
 * Verifica si una operación está permitida según el rate limit
 */
export async function checkRateLimit(
  key: string,
  customConfig?: RateLimitConfig
): Promise<RateLimitResult> {
  const config = customConfig || RATE_LIMIT_CONFIGS[key]
  
  if (!config) {
    console.warn(`No rate limit config found for key: ${key}`)
    return {
      allowed: true,
      remaining: Infinity,
      resetAt: new Date(Date.now() + 60000)
    }
  }
  
  const now = Date.now()
  const userKey = `${key}:${getUserIdentifier()}`
  
  // Limpiar entradas expiradas
  cleanupExpiredEntries()
  
  const entry = rateLimitStore.get(userKey)
  
  if (!entry || now > entry.resetAt) {
    // Nueva ventana de tiempo
    rateLimitStore.set(userKey, {
      count: 1,
      resetAt: now + config.windowMs
    })
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(now + config.windowMs)
    }
  }
  
  if (entry.count >= config.maxRequests) {
    // Límite excedido
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.resetAt)
    }
  }
  
  // Incrementar contador
  entry.count++
  rateLimitStore.set(userKey, entry)
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: new Date(entry.resetAt)
  }
}

/**
 * Obtiene un identificador único del usuario
 */
function getUserIdentifier(): string {
  // En el cliente, usar una combinación de factores
  if (typeof window !== 'undefined') {
    // Intentar obtener del localStorage o generar uno
    let userId = localStorage.getItem('rate_limit_id')
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem('rate_limit_id', userId)
    }
    return userId
  }
  
  // En el servidor, usar IP o user ID
  return 'server'
}

/**
 * Limpia entradas expiradas del store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Resetea el rate limit para una clave específica
 */
export function resetRateLimit(key: string): void {
  const userKey = `${key}:${getUserIdentifier()}`
  rateLimitStore.delete(userKey)
}

/**
 * Obtiene el estado actual del rate limit
 */
export function getRateLimitStatus(key: string): RateLimitResult | null {
  const config = RATE_LIMIT_CONFIGS[key]
  if (!config) return null
  
  const userKey = `${key}:${getUserIdentifier()}`
  const entry = rateLimitStore.get(userKey)
  
  if (!entry) {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowMs)
    }
  }
  
  const now = Date.now()
  if (now > entry.resetAt) {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(now + config.windowMs)
    }
  }
  
  return {
    allowed: entry.count < config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: new Date(entry.resetAt)
  }
}

/**
 * Formatea el tiempo restante hasta el reset
 */
export function formatResetTime(resetAt: Date): string {
  const now = Date.now()
  const diff = resetAt.getTime() - now
  
  if (diff <= 0) return 'ahora'
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  
  if (minutes > 0) {
    return `${minutes} minuto${minutes !== 1 ? 's' : ''}`
  }
  
  return `${seconds} segundo${seconds !== 1 ? 's' : ''}`
}
