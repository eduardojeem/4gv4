import type { NotificationType } from './types'

export interface NotificationIdempotencyParams {
  type: NotificationType
  resourceId?: string | number | null
  qualifier?: string | null
  targetUserId?: string | null
  date?: string | null
}

/**
 * Genera una clave de idempotencia determinista para evitar notificaciones
 * duplicadas ante reintentos de la API, fallos de red o ejecuciones repetidas de cron.
 *
 * Ejemplos:
 *   sale:123:created
 *   repair:456:assigned:usr-789
 *   booking:789:reminder:24h
 *   credit:101:due:2026-10-28
 *   cash:reg-1:difference
 */
export function buildNotificationIdempotencyKey(params: NotificationIdempotencyParams): string {
  const parts: string[] = []

  // Prefijo por dominio derivado del tipo
  const typeLower = params.type.toLowerCase()
  const domainPrefix = typeLower.split('_')[0] ?? 'event'
  parts.push(domainPrefix)

  if (params.resourceId !== undefined && params.resourceId !== null && String(params.resourceId).trim()) {
    parts.push(String(params.resourceId).trim())
  }

  // Nombre de la acción o calificador
  if (params.qualifier) {
    parts.push(params.qualifier.trim().toLowerCase())
  } else {
    // Si no se proveyó qualifier específico, usar la acción del tipo
    const action = typeLower.replace(`${domainPrefix}_`, '')
    if (action && action !== domainPrefix) {
      parts.push(action)
    }
  }

  if (params.targetUserId) {
    parts.push(`usr-${params.targetUserId.trim()}`)
  }

  if (params.date) {
    parts.push(params.date.trim())
  }

  return parts.join(':')
}
