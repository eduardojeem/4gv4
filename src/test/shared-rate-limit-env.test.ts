import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * El límite de pedidos compartido (Redis de Upstash) acepta los dos nombres de
 * variables: los de Upstash (UPSTASH_REDIS_REST_*) y los que crea la
 * integración de Vercel (KV_REST_API_*). En producción, si falta, lo avisa en
 * los logs una sola vez en lugar de fallar en silencio.
 */
const shared = vi.hoisted(() => ({ limit: vi.fn(), created: [] as Array<{ url: string; token: string }> }))
vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(options: { url: string; token: string }) {
      shared.created.push(options)
    }
  },
}))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() {
      return 'window'
    }
    limit(identifier: string) {
      return shared.limit(identifier)
    }
  },
}))

const ENV_NAMES = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']
const clearSharedEnv = () => ENV_NAMES.forEach((name) => vi.stubEnv(name, ''))
const freshLimiter = async () => {
  vi.resetModules()
  return (await import('@/lib/rate-limiter')).rateLimiter
}

beforeEach(() => {
  shared.limit.mockReset()
  shared.created.length = 0
  clearSharedEnv()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('credenciales del Redis compartido', () => {
  it('usa el par de Upstash', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://upstash.invalid')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token-upstash')
    const { sharedRateLimitCredentials, sharedRateLimitState } = await import('@/lib/rate-limit-config')
    expect(sharedRateLimitCredentials()).toMatchObject({ url: 'https://upstash.invalid', token: 'token-upstash', source: { url: 'UPSTASH_REDIS_REST_URL' } })
    expect(sharedRateLimitState()).toBe('configured')
  })

  it('usa el par que crea la integración de Vercel', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.invalid')
    vi.stubEnv('KV_REST_API_TOKEN', 'token-kv')
    const { sharedRateLimitCredentials, sharedRateLimitState } = await import('@/lib/rate-limit-config')
    expect(sharedRateLimitCredentials()).toMatchObject({ url: 'https://kv.invalid', token: 'token-kv', source: { url: 'KV_REST_API_URL' } })
    expect(sharedRateLimitState()).toBe('configured')
  })

  it('con los dos pares, prefiere el de Upstash', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://upstash.invalid')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token-upstash')
    vi.stubEnv('KV_REST_API_URL', 'https://kv.invalid')
    vi.stubEnv('KV_REST_API_TOKEN', 'token-kv')
    const { sharedRateLimitCredentials } = await import('@/lib/rate-limit-config')
    expect(sharedRateLimitCredentials()?.url).toBe('https://upstash.invalid')
  })

  it('nunca mezcla la dirección de un par con la clave del otro', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://upstash.invalid')
    vi.stubEnv('KV_REST_API_TOKEN', 'token-kv')
    const { sharedRateLimitCredentials, sharedRateLimitState } = await import('@/lib/rate-limit-config')
    expect(sharedRateLimitCredentials()).toBeNull()
    expect(sharedRateLimitState()).toBe('partial')
  })

  it('sin nada configurado', async () => {
    const { sharedRateLimitState } = await import('@/lib/rate-limit-config')
    expect(sharedRateLimitState()).toBe('missing')
  })
})

describe('límite de pedidos con los nombres de la integración de Vercel', () => {
  it('el login de la app usa el límite compartido en producción', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KV_REST_API_URL', 'https://kv.invalid')
    vi.stubEnv('KV_REST_API_TOKEN', 'token-kv')
    shared.limit.mockResolvedValue({ success: true })
    const rateLimiter = await freshLimiter()
    await expect(rateLimiter.check('login-kv', 8, 900000, { requireShared: true })).resolves.toBe(true)
    expect(shared.created).toEqual([{ url: 'https://kv.invalid', token: 'token-kv' }])
  })

  it('respeta el rechazo del límite compartido', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('KV_REST_API_URL', 'https://kv.invalid')
    vi.stubEnv('KV_REST_API_TOKEN', 'token-kv')
    shared.limit.mockResolvedValue({ success: false })
    const rateLimiter = await freshLimiter()
    await expect(rateLimiter.check('login-kv-denied', 8, 900000, { requireShared: true })).resolves.toBe(false)
  })
})

describe('aviso cuando falta el Redis compartido', () => {
  it('en producción avisa una sola vez, con los nombres a configurar', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rateLimiter = await freshLimiter()
    await rateLimiter.check('publico-1', 10, 60000)
    await rateLimiter.check('publico-2', 10, 60000)
    await expect(rateLimiter.check('login', 8, 900000, { requireShared: true })).rejects.toThrow('unavailable')
    expect(warn).toHaveBeenCalledTimes(1)
    const message = String(warn.mock.calls[0][0])
    expect(message).toContain('UPSTASH_REDIS_REST_URL')
    expect(message).toContain('KV_REST_API_URL')
    expect(message).toMatch(/503/)
  })

  it('en desarrollo no avisa: la memoria local alcanza', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rateLimiter = await freshLimiter()
    expect(await rateLimiter.check('local', 10, 60000)).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('chequeo de salud', () => {
  it('cuenta como configurado el par de la integración de Vercel', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.invalid')
    vi.stubEnv('KV_REST_API_TOKEN', 'token-kv')
    const { buildServiceHealthEntries } = await import('@/lib/health/checks/integrations')
    const upstash = buildServiceHealthEntries([]).find((entry) => entry.id === 'upstash')
    expect(upstash?.status).not.toBe('not_configured')
  })
})
