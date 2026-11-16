import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { buildGoogleCallbackUrl, describeOAuthCallbackError } from '@/lib/auth/google-oauth'
import { parseOAuthReturnUrl } from '../../mobile/src/lib/google-sign-in-model'

const exchangeCodeForSession = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession, verifyOtp: vi.fn() } }),
}))

describe('Google en la web', () => {
  it('vuelve por /auth/callback con el destino codificado', () => {
    expect(buildGoogleCallbackUrl('https://www.mitiendapy.com', '/juanbarber/cliente/login?next=/juanbarber/turnos'))
      .toBe('https://www.mitiendapy.com/auth/callback?next=%2Fjuanbarber%2Fcliente%2Flogin%3Fnext%3D%2Fjuanbarber%2Fturnos')
  })

  it('no acepta destinos externos', () => {
    expect(buildGoogleCallbackUrl('https://x.test', '//evil.com')).toBe('https://x.test/auth/callback?next=%2Fdashboard')
    expect(buildGoogleCallbackUrl('https://x.test', 'https://evil.com')).toBe('https://x.test/auth/callback?next=%2Fdashboard')
  })

  it('explica la cancelación', () => {
    expect(describeOAuthCallbackError('access_denied', null)).toMatch(/Cancelaste/)
    expect(describeOAuthCallbackError('server_error', null)).toMatch(/No se pudo completar/)
  })

  it('el callback manda al login con el motivo cuando Google devuelve error', async () => {
    const { GET } = await import('@/app/auth/callback/route')
    const response = await GET(new NextRequest('https://www.mitiendapy.com/auth/callback?next=%2Fmarketplace&error=access_denied&error_description=denied'))
    const location = new URL(response.headers.get('location') ?? '')
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('oauth_cancelled')
    expect(location.searchParams.get('redirect')).toBe('/marketplace')
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('el callback canjea el código de Google y sigue al destino', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: null })
    const { GET } = await import('@/app/auth/callback/route')
    const response = await GET(new NextRequest('https://www.mitiendapy.com/auth/callback?next=%2Fmarketplace&code=abc'))
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc')
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/marketplace')
  })
})

describe('Google en la app', () => {
  it('lee el código de la vuelta', () => {
    expect(parseOAuthReturnUrl('mitiendapy://auth-callback?code=xyz-123')).toEqual({ kind: 'code', code: 'xyz-123' })
  })

  it('distingue cancelación de error, en la query o en el hash', () => {
    expect(parseOAuthReturnUrl('mitiendapy://auth-callback?error=access_denied')).toEqual({ kind: 'cancelled' })
    const hashError = parseOAuthReturnUrl('mitiendapy://auth-callback#error=server_error&error_description=Unsupported+provider%3A+provider+is+not+enabled')
    expect(hashError).toEqual({ kind: 'error', message: expect.stringMatching(/todavía no está habilitado/) })
  })

  it('sin código ni error es un error genérico', () => {
    expect(parseOAuthReturnUrl('mitiendapy://auth-callback')).toEqual({ kind: 'error', message: expect.stringMatching(/No se pudo completar/) })
  })
})
