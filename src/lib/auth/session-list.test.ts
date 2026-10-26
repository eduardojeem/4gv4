import { describe, expect, it } from 'vitest'
import { parseUserAgent, readTokenSessionId, toSessionRecords, type AuthSessionRow } from './session-list'

function token(claims: Record<string, unknown>) {
  return ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'firma'].join('.')
}

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

const row = (overrides: Partial<AuthSessionRow>): AuthSessionRow => ({
  id: 's-1',
  created_at: '2026-10-20T10:00:00Z',
  last_active_at: '2026-10-25T10:00:00Z',
  user_agent: CHROME_WINDOWS,
  ip: '190.104.1.2',
  aal: 'aal1',
  ...overrides,
})

describe('sesiones reales del perfil', () => {
  it('identifica esta sesión con el claim session_id, que no cambia al renovar el token', () => {
    expect(readTokenSessionId(token({ session_id: 'abc', sub: 'u' }))).toBe('abc')
    expect(readTokenSessionId(token({ sub: 'u' }))).toBeNull()
    expect(readTokenSessionId('roto')).toBeNull()
    expect(readTokenSessionId(null)).toBeNull()
  })

  it('reconoce navegadores, sistemas y la app', () => {
    expect(parseUserAgent(CHROME_WINDOWS)).toEqual({ browser: 'Chrome', os: 'Windows 10/11', deviceType: 'desktop' })
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({ browser: 'Safari', os: 'iOS', deviceType: 'mobile' })
    expect(parseUserAgent('okhttp/4.12.0')).toEqual({ browser: 'App MiTiendaPy', os: 'Android', deviceType: 'mobile' })
    expect(parseUserAgent('MiTiendaPy/1 CFNetwork/1568 Darwin/24.0.0')).toEqual({ browser: 'App MiTiendaPy', os: 'iOS', deviceType: 'mobile' })
    // Antes un user agent desconocido se mostraba como «Chrome · Windows».
    expect(parseUserAgent('')).toEqual({ browser: 'Navegador desconocido', os: 'Sistema desconocido', deviceType: 'desktop' })
  })

  it('arma la lista marcando sólo la sesión actual', () => {
    const records = toSessionRecords(
      [row({ id: 'actual' }), row({ id: 'otra', user_agent: SAFARI_IPHONE, ip: null, last_active_at: null })],
      'actual'
    )
    expect(records.map((r) => [r.session_id, r.is_current])).toEqual([['actual', true], ['otra', false]])
    expect(records[1]).toMatchObject({ ip_address: 'IP no disponible', last_activity: '2026-10-20T10:00:00Z', device_type: 'mobile' })
  })

  it('sin session_id en el token no marca ninguna como actual', () => {
    expect(toSessionRecords([row({})], null).some((r) => r.is_current)).toBe(false)
  })
})
