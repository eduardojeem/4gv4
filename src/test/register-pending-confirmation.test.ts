import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Quien se registró y todavía no confirmó su email podía volver a registrarse:
 * - con el mismo nombre de comercio le decía «Esa dirección ya está en uso»,
 *   aunque el comercio era suyo, y nunca le volvía a llegar la confirmación;
 * - con otro nombre se creaba un SEGUNDO comercio para la misma persona.
 * Ahora en los dos casos le avisa que ya empezó el registro y le reenvía el
 * correo de confirmación, sin crear nada nuevo.
 */
const state = vi.hoisted(() => ({
  existingOrganization: null as { id: string; owner_id: string | null } | null,
  ownedOrganization: null as { id: string } | null,
  owner: null as { id: string; email: string; email_confirmed_at: string | null } | null,
  signUpUser: { id: 'user-1', identities: [{ id: 'identity' }], email_confirmed_at: null as string | null },
  inserts: [] as Array<{ table: string; row: unknown }>,
  resend: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signUp: state.signUp, resend: state.resend } }),
}))
vi.mock('@/lib/rate-limiter', () => ({ rateLimiter: { check: async () => true, getResetTime: () => 0 }, getClientIp: () => '1.1.1.1' }))
vi.mock('@/lib/email/resend', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/email/resend')>(), sendEmail: vi.fn(async () => undefined) }))
vi.mock('@/lib/organization/starter-kit', () => ({ provisionStarterKit: vi.fn(async () => ({})) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: state.owner && state.owner.id === id ? state.owner : null }, error: null }), deleteUser: vi.fn() } },
    from: (table: string) => {
      const filters: Record<string, unknown> = {}
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.eq = (column: string, value: unknown) => { filters[column] = value; return q }
      q.limit = () => q
      q.maybeSingle = async () => {
        if (table === 'subscription_plans') return { data: { tier: 'pro', name: 'Pro', is_active: true, trial_days: 20 }, error: null }
        if (table === 'organizations' && 'slug' in filters) return { data: state.existingOrganization, error: null }
        if (table === 'organizations' && 'owner_id' in filters) return { data: state.ownedOrganization, error: null }
        return { data: null, error: null }
      }
      q.insert = (row: unknown) => {
        state.inserts.push({ table, row })
        return { select: () => ({ single: async () => ({ data: { id: 'org-new', name: 'X', slug: 'x', plan: 'PRO' }, error: null }) }) }
      }
      q.upsert = async (row: unknown) => { state.inserts.push({ table, row }); return { error: null } }
      return q
    },
  }),
}))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'

import { POST } from '@/app/api/auth/register-company/route'

const body = {
  fullName: 'Maria Gonzalez', email: 'Maria@Ejemplo.com', password: 'Una-Clave-Larga-2026',
  companyName: 'Comercial San Miguel', companySlug: 'comercial-san-miguel', plan: 'pro', captchaToken: 'x'.repeat(24),
}
const register = (overrides: Record<string, unknown> = {}) =>
  POST(new Request('http://x/api/auth/register-company', { method: 'POST', body: JSON.stringify({ ...body, ...overrides }) }) as never)

beforeEach(() => {
  state.existingOrganization = null
  state.ownedOrganization = null
  state.owner = null
  state.signUpUser = { id: 'user-1', identities: [{ id: 'identity' }], email_confirmed_at: null }
  state.inserts = []
  state.resend.mockReset().mockResolvedValue({ error: null })
  state.signUp.mockReset().mockImplementation(async () => ({ data: { user: state.signUpUser, session: null }, error: null }))
})

describe('registro repetido antes de confirmar el email', () => {
  it('con la misma dirección: avisa que ya empezó y reenvía la confirmación, sin crear nada', async () => {
    state.existingOrganization = { id: 'org-1', owner_id: 'user-1' }
    state.owner = { id: 'user-1', email: 'maria@ejemplo.com', email_confirmed_at: null }
    const response = await register()
    const json = await response.json()
    expect(response.status).toBe(409)
    expect(json.code).toBe('REGISTRATION_PENDING_CONFIRMATION')
    expect(json.error).toMatch(/Ya empezaste el registro/)
    expect(json.fieldErrors).toBeUndefined()
    expect(state.resend).toHaveBeenCalledWith(expect.objectContaining({ type: 'signup', email: 'Maria@Ejemplo.com' }))
    expect(state.signUp).not.toHaveBeenCalled()
    expect(state.inserts).toHaveLength(0)
  })

  it('con otra dirección: no crea un segundo comercio para la misma persona', async () => {
    state.ownedOrganization = { id: 'org-1' }
    const response = await register({ companyName: 'Otro Nombre', companySlug: 'otro-nombre' })
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('REGISTRATION_PENDING_CONFIRMATION')
    expect(state.inserts.filter((item) => item.table === 'organizations')).toHaveLength(0)
  })

  it('la dirección de OTRA persona sigue diciendo que está en uso, sin reenviar nada', async () => {
    state.existingOrganization = { id: 'org-2', owner_id: 'user-2' }
    state.owner = { id: 'user-2', email: 'otra@ejemplo.com', email_confirmed_at: null }
    const response = await register()
    const json = await response.json()
    expect(response.status).toBe(409)
    expect(json.fieldErrors?.[0]?.field).toBe('companySlug')
    expect(json.code).toBeUndefined()
    expect(state.resend).not.toHaveBeenCalled()
  })

  it('si la dueña ya confirmó, la dirección está en uso (no es un registro pendiente)', async () => {
    state.existingOrganization = { id: 'org-1', owner_id: 'user-1' }
    state.owner = { id: 'user-1', email: 'maria@ejemplo.com', email_confirmed_at: '2026-10-01T00:00:00Z' }
    const json = await (await register()).json()
    expect(json.fieldErrors?.[0]?.field).toBe('companySlug')
    expect(state.resend).not.toHaveBeenCalled()
  })

  it('un registro nuevo sigue creando el comercio como siempre', async () => {
    const response = await register()
    expect(response.status).toBe(201)
    expect(state.inserts.filter((item) => item.table === 'organizations')).toHaveLength(1)
  })
})
