import { describe, expect, it, vi } from 'vitest'
import { loyaltyErrorResponse } from './api-errors'

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}))

async function body(response: Response) {
  return response.json() as Promise<{ error: string; code?: string }>
}

describe('loyaltyErrorResponse', () => {
  it('un rechazo de RLS es 403, no 500', async () => {
    // Este era el bug: el usuario veía "Error interno del servidor" cuando el
    // problema era que su rol no puede configurar puntos.
    const response = loyaltyErrorResponse(
      { code: '42501', message: 'new row violates row-level security policy for table "loyalty_settings"' },
      'guardar la configuración de puntos',
    )

    expect(response.status).toBe(403)
    const payload = await body(response)
    expect(payload.code).toBe('FORBIDDEN')
    expect(payload.error).toContain('dueño o administrador')
  })

  it('reconoce el rechazo por el mensaje, aunque no venga el código', async () => {
    const response = loyaltyErrorResponse(
      { message: 'permission denied for table loyalty_ledger' },
      'canjear',
    )

    expect(response.status).toBe(403)
  })

  it('la migración faltante sigue siendo 503 con la pista', async () => {
    const response = loyaltyErrorResponse(
      { code: '42P01', message: 'relation "public.raffles" does not exist' },
      'crear el sorteo',
    )

    expect(response.status).toBe(503)
    const payload = await body(response)
    expect(payload.code).toBe('MODULE_NOT_INSTALLED')
    expect(payload.error).toContain('migraciones')
  })

  it('un error de verdad sigue siendo 500', async () => {
    const response = loyaltyErrorResponse(
      { code: '08006', message: 'connection failure' },
      'guardar la configuración de puntos',
    )

    expect(response.status).toBe(500)
    const payload = await body(response)
    expect(payload.error).toBe('No se pudo guardar la configuración de puntos')
  })

  it('arma el mensaje con la acción que se le pasa', async () => {
    const response = loyaltyErrorResponse({ code: 'XX000' }, 'eliminar la promoción')

    expect((await body(response)).error).toBe('No se pudo eliminar la promoción')
  })

  it('un rechazo de permisos no se registra como error del sistema', async () => {
    const { logger } = await import('@/lib/logger')

    loyaltyErrorResponse({ code: '42501' }, 'guardar')

    // Si se logueara como error, el monitoreo se llenaria de falsos positivos
    // cada vez que alguien sin permiso abre la pantalla.
    expect(logger.warn).toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })
})
