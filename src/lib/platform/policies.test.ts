import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PLATFORM_POLICIES,
  invalidatePlatformPolicies,
  isMaintenanceExempt,
  loadPlatformPolicies,
  toPlatformPolicies,
  type PlatformPolicyClient,
} from './policies'

const clientReturning = (data: unknown, error: unknown = null) => {
  let calls = 0
  const client = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => { calls++; return { data, error } } }) }) }),
  } as unknown as PlatformPolicyClient
  return { client, calls: () => calls }
}

describe('políticas de la plataforma', () => {
  beforeEach(() => invalidatePlatformPolicies())

  it('lee la fila y respeta los valores por defecto', () => {
    expect(toPlatformPolicies(null)).toEqual(DEFAULT_PLATFORM_POLICIES)
    expect(toPlatformPolicies({ maintenance_mode: true, allow_registration: false, require_two_factor: true, password_min_length: 12 }))
      .toEqual({ maintenanceMode: true, allowRegistration: false, requireTwoFactor: true, passwordMinLength: 12 })
    // Un 6 viejo de la base no baja el mínimo de 8.
    expect(toPlatformPolicies({ password_min_length: 6 }).passwordMinLength).toBe(8)
  })

  it('guarda el valor 30 segundos y no guarda un error', async () => {
    const ok = clientReturning({ maintenance_mode: true })
    expect((await loadPlatformPolicies(ok.client, 1000)).maintenanceMode).toBe(true)
    await loadPlatformPolicies(ok.client, 2000)
    expect(ok.calls()).toBe(1)
    await loadPlatformPolicies(ok.client, 40_000)
    expect(ok.calls()).toBe(2)

    invalidatePlatformPolicies()
    const failing = clientReturning(null, { message: 'boom' })
    expect(await loadPlatformPolicies(failing.client, 1000)).toEqual(DEFAULT_PLATFORM_POLICIES)
    await loadPlatformPolicies(failing.client, 1001)
    expect(failing.calls()).toBe(2)
  })

  it('en mantenimiento siguen abiertos el superadmin, el login, la API y la propia página', () => {
    for (const path of ['/superadmin/settings', '/login', '/auth/mfa', '/api/cron/daily', '/mantenimiento']) {
      expect(isMaintenanceExempt(path)).toBe(true)
    }
    for (const path of ['/', '/marketplace', '/register', '/mi-tienda', '/dashboard']) {
      expect(isMaintenanceExempt(path)).toBe(false)
    }
  })
})
