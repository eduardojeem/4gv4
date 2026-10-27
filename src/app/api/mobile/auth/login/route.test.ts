import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const check = vi.fn()
vi.mock('@/lib/rate-limiter', () => ({
  rateLimiter: { check: (...args: unknown[]) => check(...args) },
  getClientIp: () => '1.2.3.4',
}))

const db = { status: 'active' as string | null, roleActive: true as boolean | null, members: 1, profileError: null as unknown, roleError: null as unknown, adminOrgs: [] as string[], requireAdminMfa: false }
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        neq: () => Promise.resolve({ count: db.members, error: null }),
        // organization_members de dueño/admin termina en `.in()`; organization_settings sigue con `.eq().limit()`.
        in: () =>
          table === 'organization_members'
            ? Promise.resolve({ data: db.adminOrgs.map((organization_id) => ({ organization_id })), error: null })
            : builder,
        limit: () => Promise.resolve({ data: db.requireAdminMfa ? [{ organization_id: db.adminOrgs[0] }] : [], error: null }),
        maybeSingle: () =>
          Promise.resolve({ data: table === 'profiles' ? { status: db.status } : { is_active: db.roleActive }, error: table === 'profiles' ? db.profileError : db.roleError }),
      }
      return builder
    },
  }),
}))

import { POST } from './route'

const request = (body: unknown) =>
  new NextRequest('http://localhost/api/mobile/auth/login', { method: 'POST', body: JSON.stringify(body) })

describe('POST /api/mobile/auth/login', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
    vi.stubGlobal('fetch', fetchMock)
    check.mockResolvedValue(true)
    Object.assign(db, { status: 'active', roleActive: true, members: 1, profileError: null as unknown, roleError: null as unknown, adminOrgs: [], requireAdminMfa: false })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    check.mockReset()
  })

  it('inicia sesión con la clave de servicio y devuelve solo los tokens', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u' } })))
    const res = await POST(request({ email: ' Juan@Mail.com ', password: 'x' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ access_token: 'a', refresh_token: 'r', expires_in: 3600 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://proj.supabase.co/auth/v1/token?grant_type=password')
    expect(init.headers.Authorization).toBe('Bearer service-key')
    expect(JSON.parse(init.body)).toEqual({ email: 'juan@mail.com', password: 'x' })
  })

  it('no da sesión a quien no es personal del comercio y cierra la que abrió', async () => {
    db.members = 0
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: 'u' } })))
    const res = await POST(request({ email: 'cliente@b.com', password: 'x' }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe('not_staff')
    expect(json.access_token).toBeUndefined()
    expect(String(fetchMock.mock.calls[1][0])).toContain('/auth/v1/logout')
  })

  it('si su comercio exige 2FA a los administradores y no la activó, no da sesión', async () => {
    Object.assign(db, { adminOrgs: ['org-1'], requireAdminMfa: true })
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: 'u', factors: [] } })))
    const res = await POST(request({ email: 'duenio@b.com', password: 'x' }))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.code).toBe('MFA_ENROLLMENT_REQUIRED')
    expect(json.access_token).toBeUndefined()
    expect(String(fetchMock.mock.calls[1][0])).toContain('/auth/v1/logout')
  })

  it('con 2FA activa devuelve la sesión aal1 para que la app pida el código', async () => {
    Object.assign(db, { adminOrgs: ['org-1'], requireAdminMfa: true })
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u', factors: [{ status: 'verified' }] },
    })))
    const res = await POST(request({ email: 'duenio@b.com', password: 'x' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ access_token: 'a', refresh_token: 'r', expires_in: 3600 })
  })

  it('rechaza un usuario desactivado', async () => {
    db.status = 'suspended'
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: 'u' } })))
    const res = await POST(request({ email: 'a@b.com', password: 'x' }))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('inactive')
  })

  it('no revela si el email existe', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error_code: 'invalid_credentials' }), { status: 400 }))
    const res = await POST(request({ email: 'a@b.com', password: 'mal' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Email o contraseña incorrectos.')
  })

  it('corta con 429 cuando se pasa el límite de intentos', async () => {
    check.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const res = await POST(request({ email: 'a@b.com', password: 'x' }))
    expect(res.status).toBe(429)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza datos inválidos sin llamar a Supabase', async () => {
    const res = await POST(request({ email: 'no-es-email', password: '' }))
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each(['profileError', 'roleError'] as const)('fails closed when %s prevents staff status verification', async (key) => {
    db[key] = {message:'database unavailable'}
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ access_token:'a', refresh_token:'r', user:{id:'u'} })))
    const response = await POST(request({email:'a@b.com',password:'x'}))
    expect(response.status).toBe(503)
    expect(await response.json()).not.toHaveProperty('access_token')
    expect(String(fetchMock.mock.calls[1][0])).toContain('/auth/v1/logout')
  })
  it('refuses password login when the shared production limiter is unavailable', async () => {
    check.mockRejectedValueOnce(new Error('limiter unavailable'))
    const response = await POST(request({email:'a@b.com',password:'x'}))
    expect(response.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

})
