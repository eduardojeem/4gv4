import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifyTurnstileToken } from './turnstile'

describe('verifyTurnstileToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('fails closed in production when the secret is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')

    await expect(verifyTurnstileToken('token', '127.0.0.1')).resolves.toEqual({
      success: false,
      reason: 'not_configured',
    })
  })

  it('allows local development when the secret is missing', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')

    await expect(verifyTurnstileToken(null, '127.0.0.1')).resolves.toEqual({
      success: true,
      bypassed: true,
    })
  })

  it('validates the token with Cloudflare when configured', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }))

    await expect(verifyTurnstileToken('valid-token', '203.0.113.4')).resolves.toEqual({ success: true })
    expect(fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
