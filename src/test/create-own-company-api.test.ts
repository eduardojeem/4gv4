import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Row = Record<string, unknown> | null
const state = vi.hoisted(() => ({
  auth: null as unknown,
  membership: null as Row,
  ownedBy: null as Row,
  slugTaken: null as Row,
  profile: { full_name: 'Ana Pérez', email: 'ana@example.test', role: 'cliente' } as Row,
  inserted: [] as { table: string; row: unknown }[],
  upserted: [] as { table: string; row: unknown }[],
  failUpsert: null as string | null,
}))

function builder(table: string) {
  const filters: Record<string, unknown> = {}
  const excluded: Record<string, unknown> = {}
  const api: Record<string, unknown> = {}
  const chain = () => api
  Object.assign(api, {
    select: chain, order: chain, limit: chain,
    eq: (column: string, value: unknown) => { filters[column] = value; return api },
    neq: (column: string, value: unknown) => { excluded[column] = value; return api },
    insert: (row: unknown) => { state.inserted.push({ table, row }); return api },
    upsert: (row: unknown) => {
      state.upserted.push({ table, row })
      return Promise.resolve({ error: state.failUpsert === table ? { message: 'boom' } : null })
    },
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    single: async () => ({ data: { id: 'org-1', name: 'Barbería Ana', slug: 'barberia-ana', plan: 'BASIC' }, error: null }),
    maybeSingle: async () => {
      if (table === 'subscription_plans') return { data: filters.public_slug === 'basic' ? { tier: 'basic', name: 'BASIC', is_active: true, trial_days: 7 } : null, error: null }
      if (table === 'organization_members') return { data: state.membership && excluded.role !== undefined && state.membership.role === excluded.role ? null : state.membership, error: null }
      if (table === 'organizations') return { data: 'slug' in filters ? state.slugTaken : state.ownedBy, error: null }
      if (table === 'profiles') return { data: state.profile, error: null }
      return { data: null, error: null }
    },
  })
  return api
}

vi.mock('@/lib/auth/request-auth', () => ({ resolveRequestAuthUser: async () => state.auth }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({ from: (table: string) => builder(table), auth: { admin: { deleteUser: vi.fn(async () => ({ error: null })) } } }),
}))
vi.mock('@/lib/platform/policies', () => ({ loadPlatformPolicies: async () => ({ allowRegistration: true, passwordMinLength: 8 }) }))
vi.mock('@/lib/organization/starter-kit', () => ({ provisionStarterKit: async () => ({ ok: true }) }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: vi.fn(async () => undefined) }))
vi.mock('@/lib/email/templates', () => ({ renderWelcomeEmail: () => '<p>Hola</p>' }))
vi.mock('@/lib/rate-limiter', () => ({ rateLimiter: { check: async () => true, getResetTime: () => 60 }, getClientIp: () => '1.1.1.1' }))

const user = (role = 'cliente') => ({ authenticated: true, user: { id: 'user-google', email: 'ana@example.test', role, roleIsActive: true, profileStatus: 'active', aal: 'aal1' } })
const post = async (body: Record<string, unknown>) => {
  const { POST } = await import('@/app/api/auth/create-company/route')
  return POST(new Request('https://www.mitiendapy.com/api/auth/create-company', { method: 'POST', body: JSON.stringify(body) }))
}
const valid = { companyName: 'Barbería Ana', companySlug: 'barberia-ana', plan: 'basic' }

describe('alta de comercio con la sesión iniciada', () => {
  beforeEach(() => {
    state.auth = user()
    state.membership = null
    state.ownedBy = null
    state.slugTaken = null
    state.inserted = []
    state.upserted = []
    state.failUpsert = null
  })

  it('sin sesión pide iniciar sesión', async () => {
    state.auth = { authenticated: false, reason: 'unauthenticated' }
    expect((await post(valid)).status).toBe(401)
  })

  it('con 2FA pendiente no crea nada', async () => {
    state.auth = { authenticated: false, reason: 'mfa_required' }
    const response = await post(valid)
    expect(response.status).toBe(403)
    expect(state.inserted).toHaveLength(0)
  })

  it('crea el comercio a nombre de la sesión, no de lo que llegue en el pedido', async () => {
    const response = await post({ ...valid, userId: 'otra-persona', owner_id: 'otra-persona' })
    expect(response.status).toBe(201)
    const org = state.inserted.find((item) => item.table === 'organizations')?.row as Record<string, unknown>
    expect(org).toMatchObject({ owner_id: 'user-google', slug: 'barberia-ana', plan: 'BASIC' })
    const member = state.upserted.find((item) => item.table === 'organization_members')?.row as Record<string, unknown>
    expect(member).toMatchObject({ user_id: 'user-google', role: 'owner', status: 'active' })
    const subscription = state.upserted.find((item) => item.table === 'subscriptions')?.row as Record<string, unknown>
    expect(subscription).toMatchObject({ status: 'trialing', plan: 'BASIC' })
  })

  it('un comercio por persona', async () => {
    state.membership = { organization_id: 'org-existente', role: 'owner' }
    const response = await post(valid)
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('ALREADY_HAS_COMPANY')
    expect(state.inserted).toHaveLength(0)
  })

  it('ser cliente de una tienda no impide abrir el comercio propio', async () => {
    // Se registró como cliente, compró en una tienda y después quiso vender.
    state.membership = { organization_id: 'tienda-donde-compra', role: 'customer' }
    expect((await post(valid)).status).toBe(201)
  })

  it('una cuenta del equipo de otro comercio no se vuelve administradora', async () => {
    state.auth = user('vendedor')
    expect((await post(valid)).status).toBe(409)
    expect(state.upserted).toHaveLength(0)
  })

  it('la dirección ocupada vuelve como error del campo', async () => {
    state.slugTaken = { id: 'otro' }
    const response = await post(valid)
    expect(response.status).toBe(409)
    expect((await response.json()).fieldErrors[0].field).toBe('companySlug')
  })

  it('un plan que no existe no crea el comercio', async () => {
    const response = await post({ ...valid, plan: 'inexistente' })
    expect(response.status).toBe(400)
    expect(state.inserted).toHaveLength(0)
  })

  it('si falla el alta, deshace el comercio sin borrar la cuenta', async () => {
    state.failUpsert = 'subscriptions'
    const response = await post(valid)
    expect(response.status).toBe(500)
    const source = readFileSync(resolve(process.cwd(), 'src/app/api/auth/create-company/route.ts'), 'utf8')
    expect(source).toContain('{ id: user.id, identities: [] }')
  })
})

describe('alta con sesión en la app', () => {
  it('valida y arma el pedido sin datos de la cuenta', async () => {
    const { companyIssues, ownCompanyPayload, emptyCompanyForm } = await import('../../mobile/src/lib/registration-model')
    expect(Object.keys(companyIssues(emptyCompanyForm()))).toEqual(['companyName', 'companySlug', 'plan'])
    const payload = ownCompanyPayload({ companyName: ' Barbería Ana ', companySlug: '', businessVertical: 'barbershop', plan: 'basic' })
    expect(payload).toEqual({ companyName: 'Barbería Ana', companySlug: 'barberia-ana', businessVertical: 'barbershop', plan: 'basic' })
    expect(payload).not.toHaveProperty('email')
    expect(payload).not.toHaveProperty('password')
  })

  it('la pantalla nueva solo existe con sesión', () => {
    const layout = readFileSync(resolve(process.cwd(), 'mobile/src/app/_layout.tsx'), 'utf8')
    const guarded = layout.slice(layout.indexOf('<Stack.Protected guard={!!session}>'), layout.indexOf('<Stack.Protected guard={!session}>'))
    expect(guarded).toContain('name="create-company"')
  })
})

describe('cliente que después registra su comercio con el mismo correo', () => {
  it('el registro con contraseña responde ACCOUNT_EXISTS y la web y la app ofrecen ingresar y crear el comercio', () => {
    expect(readFileSync(resolve(process.cwd(), 'src/app/api/auth/register-company/route.ts'), 'utf8')).toContain("code: 'ACCOUNT_EXISTS'")
    const web = readFileSync(resolve(process.cwd(), 'src/app/register/page.tsx'), 'utf8')
    expect(web).toContain("result.code === 'ACCOUNT_EXISTS'")
    expect(web).toContain('/register/comercio')
    const app = readFileSync(resolve(process.cwd(), 'mobile/src/app/register.tsx'), 'utf8')
    expect(app).toContain("cause.body?.code === 'ACCOUNT_EXISTS'")
    expect(app).toContain("next: 'create-company'")
    const signIn = readFileSync(resolve(process.cwd(), 'mobile/src/app/sign-in.tsx'), 'utf8')
    expect(signIn).toContain('setPostAuthRoute(afterSignIn ?? null)')
  })
})
