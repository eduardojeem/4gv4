import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const estado = vi.hoisted(() => ({
  tablas: {} as Record<string, unknown>,
  rpc: null as unknown as ReturnType<typeof import('vitest').vi.fn>,
  invite: null as unknown as ReturnType<typeof import('vitest').vi.fn>,
  buscar: null as unknown as ReturnType<typeof import('vitest').vi.fn>,
}))

/** Un constructor de consultas que devuelve siempre el mismo resultado. */
function consulta(resultado: { data?: unknown; error?: unknown; count?: number | null }) {
  const q: Record<string, unknown> = {}
  for (const metodo of ['select', 'eq', 'in', 'neq', 'ilike', 'order', 'limit']) {
    q[metodo] = vi.fn(() => q)
  }
  q.maybeSingle = vi.fn(async () => resultado)
  q.then = (ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) => Promise.resolve(resultado).then(ok, mal)
  return q
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (tabla: string) => estado.tablas[tabla] ?? consulta({ data: null, error: null }),
    rpc: (...args: unknown[]) => estado.rpc(...args),
    auth: { admin: { inviteUserByEmail: (...args: unknown[]) => estado.invite(...args) } },
  }),
}))
vi.mock('@/lib/superadmin/auth', () => ({
  getSuperAdminUser: vi.fn(async () => ({ id: 'sa-1', email: 'sa@plataforma.com', role: 'super_admin' })),
}))
vi.mock('@/lib/superadmin/audit', () => ({ logSuperAdminAction: vi.fn(async () => {}) }))
vi.mock('@/lib/site-url', () => ({ siteUrl: (ruta: string) => `https://app.test${ruta}` }))
vi.mock('@/lib/superadmin/find-auth-user', () => ({
  findAuthUserByEmail: (...args: unknown[]) => estado.buscar(...args),
}))

import { GET, POST } from '@/app/api/superadmin/organizations/route'
import { POST as ASIGNAR } from '@/app/api/superadmin/organizations/[id]/owner/route'

const ORG_ID = '11111111-2222-4333-8444-555555555555'

const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/superadmin/organizations', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
  )

const get = (query: string) => GET(new NextRequest(`http://localhost/api/superadmin/organizations?${query}`))

const valido = { name: 'HCA Celular', slug: 'hca-celular', plan: 'PRO' }

beforeEach(() => {
  estado.tablas = {
    subscription_plans: consulta({ data: [{ tier: 'free', trial_days: 0 }, { tier: 'pro', trial_days: 30 }], error: null }),
  }
  estado.rpc = vi.fn(async (nombre: string, args: Record<string, unknown>) =>
    nombre === 'create_superadmin_organization'
      ? { data: [{ id: ORG_ID, name: args.p_name, slug: args.p_slug, plan: args.p_plan }], error: null }
      : { data: null, error: null }
  )
  estado.invite = vi.fn(async () => ({ data: { user: { id: 'nuevo-1' } }, error: null }))
  estado.buscar = vi.fn(async () => ({ user: null, scanTruncated: false }))
})

const llamadasA = (nombre: string) => estado.rpc.mock.calls.filter((c) => c[0] === nombre)

describe('POST crea solo lo que es válido', () => {
  it('un subdominio reservado no llega a la base', async () => {
    const res = await post({ ...valido, slug: 'marketplace' })
    expect(res.status).toBe(400)
    expect((await res.json()).field).toBe('slug')
    expect(llamadasA('create_superadmin_organization')).toHaveLength(0)
  })

  it('un plan desconocido se rechaza en vez de crear un FREE', async () => {
    const res = await post({ ...valido, plan: 'GOLD' })
    expect(res.status).toBe(400)
    expect((await res.json()).field).toBe('plan')
    expect(llamadasA('create_superadmin_organization')).toHaveLength(0)
  })

  it('usa los días de prueba del plan elegido', async () => {
    const antes = Date.now()
    const res = await post(valido)
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.subscription.trialDays).toBe(30)
    const fin = new Date(body.subscription.trialEndsAt).getTime()
    expect(fin - antes).toBeGreaterThanOrEqual(30 * 86_400_000 - 1000)
  })

  it('un error de la base no se le muestra crudo al usuario', async () => {
    estado.rpc = vi.fn(async () => ({ data: null, error: { code: 'XX000', message: 'relation "branches" violates check constraint' } }))
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await post(valido)
    const texto = JSON.stringify(await res.json())
    expect(res.status).toBe(500)
    expect(texto).not.toContain('constraint')
    errorLog.mockRestore()
  })

  it('un subdominio tomado entre la verificación y el envío devuelve 409 sobre el campo', async () => {
    estado.rpc = vi.fn(async () => ({ data: null, error: { code: '23505', message: 'duplicate key' } }))
    const res = await post(valido)
    expect(res.status).toBe(409)
    expect((await res.json()).field).toBe('slug')
  })
})

/**
 * Antes siempre se invitaba. Con una cuenta existente —un cliente que abre su
 * segunda empresa— Supabase responde «already registered», la organizacion
 * quedaba sin propietario y la pantalla mostraba ese texto en ingles.
 */
describe('el propietario', () => {
  it('con cuenta existente se asigna sin invitar', async () => {
    estado.buscar = vi.fn(async () => ({ user: { id: 'existe-1', email: 'dueno@hca.com.py' }, scanTruncated: false }))
    const body = await (await post({ ...valido, owner_email: 'dueno@hca.com.py' })).json()

    expect(estado.invite).not.toHaveBeenCalled()
    expect(llamadasA('assign_superadmin_organization_owner')[0][1]).toMatchObject({ p_user_id: 'existe-1' })
    expect(body.owner).toEqual({ status: 'assigned_existing', email: 'dueno@hca.com.py' })
  })

  it('sin cuenta se invita y después se asigna', async () => {
    const body = await (await post({ ...valido, owner_email: 'nuevo@hca.com.py' })).json()

    expect(estado.invite).toHaveBeenCalledTimes(1)
    expect(estado.invite.mock.calls[0][1]).toMatchObject({
      redirectTo: 'https://app.test/auth/confirm?next=/dashboard/onboarding',
    })
    expect(llamadasA('assign_superadmin_organization_owner')[0][1]).toMatchObject({ p_user_id: 'nuevo-1' })
    expect(body.owner).toEqual({ status: 'invited', email: 'nuevo@hca.com.py' })
  })

  it('«already registered» se traduce, no se muestra en inglés', async () => {
    estado.invite = vi.fn(async () => ({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    }))
    const body = await (await post({ ...valido, owner_email: 'x@hca.com.py' })).json()
    expect(body.owner.status).toBe('failed')
    expect(body.owner.reason).toBe('already_registered')
    expect(JSON.stringify(body)).not.toContain('already been registered')
  })

  it('una cuenta suspendida se informa como tal', async () => {
    estado.buscar = vi.fn(async () => ({ user: { id: 'susp-1', email: 's@hca.com.py' }, scanTruncated: false }))
    estado.rpc = vi.fn(async (nombre: string, args: Record<string, unknown>) =>
      nombre === 'create_superadmin_organization'
        ? { data: [{ id: ORG_ID, name: args.p_name, slug: args.p_slug, plan: args.p_plan }], error: null }
        : { data: null, error: { message: 'OWNER_SUSPENDED' } }
    )
    const body = await (await post({ ...valido, owner_email: 's@hca.com.py' })).json()
    expect(body.owner).toMatchObject({ status: 'failed', reason: 'suspended' })
  })

  it('si no se pudo confirmar que la cuenta no existe, no se invita a ciegas', async () => {
    estado.buscar = vi.fn(async () => ({ user: null, scanTruncated: true }))
    const body = await (await post({ ...valido, owner_email: 'quiza@hca.com.py' })).json()
    expect(estado.invite).not.toHaveBeenCalled()
    expect(body.owner).toMatchObject({ status: 'failed', reason: 'lookup_incomplete' })
  })

  it('sin correo, queda sin propietario y lo dice', async () => {
    const body = await (await post(valido)).json()
    expect(body.owner).toEqual({ status: 'none' })
    expect(estado.buscar).not.toHaveBeenCalled()
  })
})

describe('GET verifica la dirección', () => {
  it('una reservada no está disponible y no consulta la base', async () => {
    // Antes solo se preguntaba si estaba tomada: `marketplace` figuraba libre.
    const organizaciones = consulta({ data: [], error: null })
    estado.tablas.organizations = organizaciones
    const body = await (await get('slug=marketplace')).json()
    expect(body).toMatchObject({ available: false, reason: 'reserved', suggestion: 'marketplace-tienda' })
    expect(organizaciones.select).not.toHaveBeenCalled()
  })

  it('una consulta caída no afirma que está libre', async () => {
    // Antes el error se ignoraba y `!data` daba «disponible».
    estado.tablas.organizations = consulta({ data: null, error: { message: 'timeout' } })
    const res = await get('slug=hca-celular')
    expect(res.status).toBe(503)
    expect((await res.json()).available).toBeUndefined()
  })

  it('una tomada propone la siguiente libre', async () => {
    estado.tablas.organizations = consulta({ data: [{ slug: 'hca-celular' }, { slug: 'hca-celular-2' }], error: null })
    const body = await (await get('slug=hca-celular')).json()
    expect(body).toMatchObject({ available: false, reason: 'taken', suggestion: 'hca-celular-3' })
  })

  it('el correo de un superadmin se identifica como tal', async () => {
    estado.buscar = vi.fn(async () => ({ user: { id: 'sa-2', email: 'otro@plataforma.com' }, scanTruncated: false }))
    estado.tablas.profiles = consulta({ data: { status: 'active' }, error: null })
    estado.tablas.user_roles = consulta({ data: { role: 'super_admin', is_active: true }, error: null })
    estado.tablas.organization_members = consulta({ data: null, error: null, count: 2 })
    const body = await (await get('owner_email=otro@plataforma.com')).json()
    expect(body).toEqual({
      email: 'otro@plataforma.com',
      exists: true,
      suspended: false,
      superAdmin: true,
      organizations: 2,
      lookupIncomplete: false,
    })
  })
})

describe('asignar el propietario después', () => {
  const asignar = (body: unknown) =>
    ASIGNAR(
      new NextRequest(`http://localhost/api/superadmin/organizations/${ORG_ID}/owner`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: ORG_ID }) }
    )

  it('una organización que ya tiene dueño no cambia de manos por esta ruta', async () => {
    estado.tablas.organizations = consulta({
      data: { id: ORG_ID, name: 'HCA', slug: 'hca', plan: 'PRO', owner_id: 'ya-tiene' },
      error: null,
    })
    const res = await asignar({ owner_email: 'nuevo@hca.com.py' })
    expect(res.status).toBe(409)
    expect(estado.buscar).not.toHaveBeenCalled()
  })

  it('una sin dueño lo recibe', async () => {
    estado.tablas.organizations = consulta({
      data: { id: ORG_ID, name: 'HCA', slug: 'hca', plan: 'PRO', owner_id: null },
      error: null,
    })
    const body = await (await asignar({ owner_email: 'nuevo@hca.com.py' })).json()
    expect(body.owner).toEqual({ status: 'invited', email: 'nuevo@hca.com.py' })
  })

  it('sin correo no hace nada', async () => {
    const res = await asignar({})
    expect(res.status).toBe(400)
  })
})
