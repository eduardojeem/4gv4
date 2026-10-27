import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ signOut: vi.fn(), getSession: vi.fn() }))
vi.mock('../../mobile/src/lib/supabase', () => ({ supabase: { auth: { getSession: auth.getSession, signOut: auth.signOut } } }))

import { apiFetch } from '../../mobile/src/lib/api'
import {
  describeMfaError,
  isSessionMfaPending,
  normalizeTotpCode,
  readTokenAal,
} from '../../mobile/src/lib/mfa-model'

function token(aal: string) {
  return ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ aal })).toString('base64url'), 'firma'].join('.')
}

const verified = { factors: [{ status: 'verified' }] }

describe('2FA en la app', () => {
  it('con 2FA activa la sesión aal1 no llega al panel', () => {
    expect(isSessionMfaPending({ access_token: token('aal1'), user: verified })).toBe(true)
    expect(isSessionMfaPending({ access_token: token('aal2'), user: verified })).toBe(false)
    expect(isSessionMfaPending({ access_token: token('aal1'), user: { factors: [{ status: 'unverified' }] } })).toBe(false)
    expect(isSessionMfaPending({ access_token: token('aal1'), user: { factors: [] } })).toBe(false)
    expect(isSessionMfaPending(null)).toBe(false)
  })

  it('lee el nivel del token y normaliza el código', () => {
    expect(readTokenAal(token('aal2'))).toBe('aal2')
    expect(readTokenAal('roto')).toBeNull()
    expect(normalizeTotpCode(' 123 456 ')).toBe('123456')
    expect(describeMfaError({ code: 'mfa_verification_failed' })).toMatch(/no es correcto/)
  })

  describe('respuestas del servidor', () => {
    beforeEach(() => {
      auth.signOut.mockReset()
      auth.getSession.mockResolvedValue({ data: { session: { access_token: 'A' } } })
    })

    it('un 401 por falta del código no cierra la sesión', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized', code: 'MFA_REQUIRED' }), { status: 401 })))
      await expect(apiFetch('/api/algo')).rejects.toThrow('Unauthorized')
      expect(auth.signOut).not.toHaveBeenCalled()
    })

    it('un 401 común la sigue cerrando', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })))
      await expect(apiFetch('/api/algo')).rejects.toThrow()
      expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    })
  })
})
