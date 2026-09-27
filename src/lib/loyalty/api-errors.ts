/**
 * Traducción de los errores de Postgres a respuestas HTTP con sentido.
 *
 * Las tablas de puntos no aceptan escritura directa y las políticas exigen
 * permiso de gestión. Cuando eso rechaza, PostgREST devuelve 42501 — que es
 * "no tenés permiso", no "se rompió el servidor". Devolverlo como 500 hacía
 * que el usuario viera "Error interno" cuando el problema era su rol, y que el
 * log se llenara de errores que no lo son.
 */

import { NextResponse } from 'next/server'
import { isLoyaltyModuleMissing, LOYALTY_MIGRATION_HINT } from './module-status'
import { logger } from '@/lib/logger'

export interface PostgresLikeError {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}

/** Códigos con los que Postgres avisa que faltó permiso, no que algo falló. */
const PERMISSION_CODES = new Set([
  '42501', // insufficient_privilege — incluye el rechazo de una política RLS
  'PGRST301', // JWT inválido o ausente
])

function isPermissionDenied(error: PostgresLikeError): boolean {
  if (error.code && PERMISSION_CODES.has(error.code)) return true

  const text = `${error.message ?? ''}`.toLowerCase()
  return text.includes('row-level security') || text.includes('permission denied')
}

/**
 * Respuesta para un error de escritura sobre puntos o sorteos.
 *
 * `action` completa la frase "No se pudo …", por ejemplo "guardar la
 * configuración de puntos".
 */
export function loyaltyErrorResponse(
  error: PostgresLikeError,
  action: string,
  context: Record<string, unknown> = {},
): NextResponse {
  if (isLoyaltyModuleMissing(error)) {
    return NextResponse.json(
      { error: LOYALTY_MIGRATION_HINT, code: 'MODULE_NOT_INSTALLED' },
      { status: 503 },
    )
  }

  if (isPermissionDenied(error)) {
    // No es un fallo: es el sistema funcionando. Se registra como aviso.
    logger.warn('loyalty permission denied', { action, ...context })
    return NextResponse.json(
      {
        error:
          'Tu rol en esta organización no permite esta acción. ' +
          'Configurar puntos y sorteos requiere ser dueño o administrador.',
        code: 'FORBIDDEN',
      },
      { status: 403 },
    )
  }

  logger.error(`loyalty: no se pudo ${action}`, { error, ...context })
  return NextResponse.json({ error: `No se pudo ${action}` }, { status: 500 })
}
