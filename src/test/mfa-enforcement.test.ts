import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Con 2FA activa, una sesión que sólo pasó la contraseña (`aal1`) no sirve para
 * el panel ni para las APIs privadas. Se prueba en los tres lugares que lo
 * deciden: el cliente de Supabase del servidor (todas las APIs), `withTenantAuth`
 * (APIs de la organización) y el proxy (páginas).
 */

const mocks = vi.hoisted(() => ({
  headers: new Map<string, string>(),
  cookies: [] as { name: string; value: string }[],
  getUser: vi.fn(),
  getSession: vi.fn(),
  rpc: vi.fn(),
  settings: vi.fn(),
  memberships: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (name: string) => mocks.headers.get(name.toLowerCase()) ?? null }),
  cookies: async () => ({ getAll: () => mocks.cookies, set: vi.fn() }),
}))

/** Arma un cliente de Supabase falso: `organization_settings` responde `mocks.settings`. */
function fakeSupabase() {
  return {
    auth: { getUser: mocks.getUser, getSession: mocks.getSession },
    rpc: mocks.rpc,
    from: (table: string) => {
      if (table === 'organization_settings') {
        return { select: () => ({ eq: () => ({ maybeSingle: mocks.settings }) }) }
      }
      if (table === 'organization_members') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          neq: () => mocks.memberships(),
          in: () => chain,
          order: () => chain,
          limit: () => mocks.memberships(),
        }
        return chain
      }
      // user_roles / profiles: activo, sin rol de plataforma.
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
    },
  }
}

vi.mock('@supabase/ssr', () => ({ createServerClient: () => fakeSupabase() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => fakeSupabase() }))
vi.mock('@/lib/saas/subscription-service', () => ({ getOrganizationPlanInfo: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { resetAdminMfaPolicyCache } from '@/lib/auth/admin-mfa-policy'
import { proxy } from '@/proxy'

function token(aal: 'aal1' | 'aal2') {
  return ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ aal, sub: 'user-1' })).toString('base64url'), 'firma'].join('.')
}

const withTotp = { id: 'user-1', email: 'duenio@tienda.test', factors: [{ id: 'f1', status: 'verified', factor_type: 'totp' }] }
const withoutTotp = { id: 'user-1', email: 'duenio@tienda.test', factors: [] }

function session(aal: 'aal1' | 'aal2', user: object) {
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: token(aal) } }, error: null })
  mocks.getUser.mockResolvedValue({ data: { user }, error: null })
}

const ownerMembership = {
  data: [{ role: 'owner', organizations: { id: 'org-1', name: 'Tienda', slug: 'tienda', plan: 'pro', logo_url: null } }],
  error: null,
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  mocks.headers.clear()
  mocks.cookies = []
  mocks.getUser.mockReset()
  mocks.getSession.mockReset()
  mocks.rpc.mockReset().mockResolvedValue({ data: { organizationRole: 'owner', profileStatus: 'active' }, error: null })
  mocks.settings.mockReset().mockResolvedValue({ data: { require_admin_mfa: false }, error: null })
  mocks.memberships.mockReset().mockResolvedValue(ownerMembership)
  resetAdminMfaPolicyCache()
})

describe('cliente de Supabase del servidor', () => {
  it('con 2FA activa y sesión aal1 responde «sin usuario» con un código propio', async () => {
    session('aal1', withTotp)
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()
    expect(data.user).toBeNull()
    expect(error?.code).toBe('mfa_required')
  })

  it('con 2FA activa y sesión aal2 devuelve el usuario', async () => {
    session('aal2', withTotp)
    const { data } = await (await createClient()).auth.getUser()
    expect(data.user?.id).toBe('user-1')
  })

  it('sin 2FA la sesión aal1 sigue sirviendo', async () => {
    session('aal1', withoutTotp)
    const { data } = await (await createClient()).auth.getUser()
    expect(data.user?.id).toBe('user-1')
  })

  it('con el token de la app (Bearer) mira el nivel de ese token', async () => {
    mocks.headers.set('authorization', `Bearer ${token('aal1')}`)
    mocks.getUser.mockResolvedValue({ data: { user: withTotp }, error: null })
    const { data } = await (await createClient()).auth.getUser()
    expect(data.user).toBeNull()
    expect(mocks.getUser).toHaveBeenCalledWith(token('aal1'))
    expect(mocks.getSession).not.toHaveBeenCalled()
  })
})

describe('APIs privadas', () => {
  it('requireAuth responde 401 MFA_REQUIRED', async () => {
    session('aal1', withTotp)
    const auth = await requireAuth()
    expect(auth.authenticated).toBe(false)
    if (auth.authenticated) return
    expect(auth.response.status).toBe(401)
    await expect(auth.response.json()).resolves.toMatchObject({ code: 'MFA_REQUIRED' })
  })

  const handler = vi.fn(async () => NextResponse.json({ ok: true }))
  const route = withTenantAuth({}, handler)
  const call = () => route(new NextRequest('https://app.test/api/algo'))

  it('withTenantAuth responde 401 MFA_REQUIRED sin llegar al handler', async () => {
    handler.mockClear()
    session('aal1', withTotp)
    const response = await call()
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ code: 'MFA_REQUIRED' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('si la organización exige 2FA, un dueño sin 2FA recibe 403 MFA_ENROLLMENT_REQUIRED', async () => {
    handler.mockClear()
    session('aal1', withoutTotp)
    mocks.settings.mockResolvedValue({ data: { require_admin_mfa: true }, error: null })
    const response = await call()
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'MFA_ENROLLMENT_REQUIRED' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('con la exigencia apagada o sesión aal2 el handler recibe el nivel de la sesión', async () => {
    handler.mockClear()
    session('aal1', withoutTotp)
    expect((await call()).status).toBe(200)

    resetAdminMfaPolicyCache()
    session('aal2', withTotp)
    mocks.settings.mockResolvedValue({ data: { require_admin_mfa: true }, error: null })
    expect((await call()).status).toBe(200)
    expect(handler).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ user: expect.objectContaining({ aal: 'aal2' }) }),
      undefined
    )
  })

  it('la exigencia no alcanza a quien no es administrador', async () => {
    handler.mockClear()
    session('aal1', withoutTotp)
    mocks.memberships.mockResolvedValue({
      data: [{ role: 'cashier', organizations: ownerMembership.data[0].organizations }],
      error: null,
    })
    mocks.settings.mockResolvedValue({ data: { require_admin_mfa: true }, error: null })
    expect((await call()).status).toBe(200)
  })
})

describe('proxy de páginas', () => {
  const visit = (path: string) => proxy(new NextRequest(`https://app.test${path}`, { headers: { cookie: mocks.cookies.map((c) => `${c.name}=${c.value}`).join('; ') } }))

  it('manda al segundo paso desde el panel conservando a dónde iba', async () => {
    session('aal1', withTotp)
    const response = await visit('/dashboard/pos?tab=caja')
    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location')!).pathname + new URL(response.headers.get('location')!).search)
      .toBe('/auth/mfa?redirect=%2Fdashboard%2Fpos%3Ftab%3Dcaja')
  })

  it('desde /login con la contraseña ya puesta también pide el código', async () => {
    session('aal1', withTotp)
    const response = await visit('/login?redirect=/admin')
    expect(response.headers.get('location')).toBe('https://app.test/auth/mfa?redirect=%2Fadmin')
  })

  it('con aal2 deja pasar', async () => {
    session('aal2', withTotp)
    const response = await visit('/dashboard')
    expect(response.headers.get('location')).toBeNull()
  })

  it('si la organización activa lo exige, un dueño sin 2FA va a activarla', async () => {
    session('aal1', withoutTotp)
    mocks.cookies = [{ name: 'active_organization_id', value: 'org-1' }]
    mocks.settings.mockResolvedValue({ data: { require_admin_mfa: true }, error: null })
    const response = await visit('/admin/users')
    expect(response.headers.get('location')).toBe('https://app.test/auth/mfa?setup=1&redirect=%2Fadmin%2Fusers')
  })

  it('las páginas públicas no se tocan', async () => {
    session('aal1', withTotp)
    const response = await visit('/marketplace')
    expect(response.headers.get('location')).toBeNull()
    expect(mocks.getUser).not.toHaveBeenCalled()
  })
})
