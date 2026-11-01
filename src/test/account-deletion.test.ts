import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  updateUserById: vi.fn(),
  signIn: vi.fn(),
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/auth/request-auth', () => ({ resolveRequestAuthUser: mocks.auth }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({ rpc: mocks.rpc, from: mocks.from, auth: { admin: { updateUserById: mocks.updateUserById } } }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signInWithPassword: mocks.signIn, signOut: vi.fn(async () => ({})) } }),
}))
vi.mock('@/lib/email/resend', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/email/resend')>(), sendEmail: mocks.sendEmail }))

function query(result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'neq', 'in', 'lte', 'order', 'limit']) chain[method] = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => result)
  chain.then = (resolveFn: (value: unknown) => unknown) => Promise.resolve(result).then(resolveFn)
  return chain
}

const USER = { id: 'user-1', email: 'dueno@tienda.test', role: 'admin' }

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

async function post(body: unknown) {
  const { POST } = await import('@/app/api/account/delete/route')
  return POST(new Request('http://localhost/api/account/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }) as never)
}

describe('POST /api/account/delete', () => {
  it('pide sesión y no deja eliminar una cuenta de superadmin', async () => {
    mocks.auth.mockResolvedValueOnce({ authenticated: false, reason: 'unauthenticated' })
    expect((await post({ password: 'x', confirm: 'ELIMINAR' })).status).toBe(401)

    mocks.auth.mockResolvedValueOnce({ authenticated: true, user: { ...USER, role: 'super_admin' } })
    expect((await post({ password: 'x', confirm: 'ELIMINAR' })).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('exige escribir ELIMINAR y la contraseña correcta', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://supabase.test')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
    mocks.auth.mockResolvedValue({ authenticated: true, user: USER })

    expect((await post({ password: 'clave', confirm: 'borrar' })).status).toBe(400)

    mocks.signIn.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Invalid login credentials' } })
    const wrong = await post({ password: 'mala', confirm: 'eliminar' })
    expect(wrong.status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('registra el pedido, bloquea el usuario y manda la confirmación', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://supabase.test')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
    mocks.auth.mockResolvedValue({ authenticated: true, user: USER })
    mocks.signIn.mockResolvedValueOnce({ data: { session: { access_token: 't' } }, error: null })
    mocks.rpc.mockResolvedValueOnce({
      data: { id: 'req-1', user_id: USER.id, scheduled_for: '2026-12-01T00:00:00Z', closed_organization_ids: ['org-1'] },
      error: null,
    })
    mocks.updateUserById.mockResolvedValueOnce({ error: null })
    mocks.from.mockReturnValueOnce(query({ data: [{ name: 'Mi Tienda' }], error: null }))
    mocks.sendEmail.mockResolvedValueOnce({ ok: true })

    const response = await post({ password: 'buena', confirm: 'ELIMINAR', source: 'app' })

    const body = await response.json()
    expect(body).toEqual({ success: true, scheduledFor: '2026-12-01T00:00:00Z', closedOrganizations: 1 })
    expect(mocks.rpc).toHaveBeenCalledWith('request_account_deletion', { p_user_id: USER.id, p_source: 'app', p_reason: null })
    expect(mocks.updateUserById).toHaveBeenCalledWith(USER.id, { ban_duration: '876000h' })
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: USER.email }))
  })
})

describe('completeDueAccountDeletions', () => {
  it('anonimiza Auth antes que la base y deja pendiente lo que falla', async () => {
    const { completeDueAccountDeletions } = await import('@/lib/account/account-deletion')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.from.mockReturnValueOnce(query({ data: [{ id: 'req-1', user_id: 'u1' }, { id: 'req-2', user_id: 'u2' }], error: null }))
    mocks.updateUserById
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'auth caído' } })
    mocks.rpc.mockResolvedValue({ data: {}, error: null })

    await expect(completeDueAccountDeletions(new Date('2026-12-02T00:00:00Z'))).resolves.toEqual({ completed: 1, failed: 1 })
    expect(mocks.updateUserById).toHaveBeenCalledWith('u1', expect.objectContaining({ email: 'eliminada-req-1@cuentas-eliminadas.invalid', user_metadata: {} }))
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('complete_account_deletion', { p_request_id: 'req-1' })
  })
})

describe('migración de eliminación de cuenta', () => {
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261101060000_account_deletion_requests.sql'), 'utf8')

  it('solo el servidor la usa y conserva el usuario de Auth', () => {
    expect(migration).toContain('alter table public.account_deletion_requests enable row level security')
    expect(migration).toContain('revoke all on function public.request_account_deletion(uuid, text, text) from public, anon, authenticated')
    expect(migration).toContain('revoke all on function public.complete_account_deletion(uuid) from public, anon, authenticated')
    expect(migration).not.toMatch(/delete from auth\.users/)
  })
})
