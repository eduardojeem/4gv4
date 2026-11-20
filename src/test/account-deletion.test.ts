import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  updateUserById: vi.fn(),
  getUserById: vi.fn(),
  signIn: vi.fn(),
  sendEmail: vi.fn(),
  storageList: vi.fn(),
  storageRemove: vi.fn(),
  branding: vi.fn(),
}))

vi.mock('@/lib/platform/branding', () => ({ getPlatformBranding: mocks.branding }))
vi.mock('@/lib/auth/request-auth', () => ({ resolveRequestAuthUser: mocks.auth }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    rpc: mocks.rpc,
    from: mocks.from,
    auth: { admin: { updateUserById: mocks.updateUserById, getUserById: mocks.getUserById } },
    storage: { from: () => ({ list: mocks.storageList, remove: mocks.storageRemove }) },
  }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signInWithPassword: mocks.signIn, signOut: vi.fn(async () => ({})) } }),
}))
vi.mock('@/lib/email/resend', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/email/resend')>(), sendEmail: mocks.sendEmail }))

type Chain = Record<string, ReturnType<typeof vi.fn>> & { then: unknown }

function query(result: unknown) {
  const chain = {} as Chain
  for (const method of ['select', 'eq', 'neq', 'in', 'lte', 'order', 'limit', 'upsert', 'update', 'delete']) chain[method] = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => result)
  chain.then = (resolveFn: (value: unknown) => unknown) => Promise.resolve(result).then(resolveFn)
  return chain
}

const USER = { id: 'user-1', email: 'dueno@tienda.test', role: 'admin' }
const REQUEST_ROW = { id: 'req-1', user_id: USER.id, scheduled_for: '2026-12-01T00:00:00Z', closed_organization_ids: ['org-1'] }
const hash = (code: string) => createHash('sha256').update(`${USER.id}:${code}`).digest('hex')

afterEach(() => {
  vi.resetAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

async function post(body: unknown) {
  const { POST } = await import('@/app/api/account/delete/route')
  return POST(new Request('http://localhost/api/account/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }) as never)
}

function stubSupabaseEnv() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://supabase.test')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
}

describe('POST /api/account/delete', () => {
  it('pide sesión y no deja eliminar una cuenta de superadmin', async () => {
    mocks.auth.mockResolvedValueOnce({ authenticated: false, reason: 'unauthenticated' })
    expect((await post({ password: 'x', confirm: 'ELIMINAR' })).status).toBe(401)

    mocks.auth.mockResolvedValueOnce({ authenticated: true, user: { ...USER, role: 'super_admin' } })
    expect((await post({ password: 'x', confirm: 'ELIMINAR' })).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('exige escribir ELIMINAR, una sola forma de confirmar y la contraseña correcta', async () => {
    stubSupabaseEnv()
    mocks.auth.mockResolvedValue({ authenticated: true, user: USER })

    expect((await post({ password: 'clave', confirm: 'borrar' })).status).toBe(400)
    expect((await post({ confirm: 'ELIMINAR' })).status).toBe(400)
    expect((await post({ password: 'clave', code: '123456', confirm: 'ELIMINAR' })).status).toBe(400)

    mocks.signIn.mockResolvedValueOnce({ data: { session: null }, error: { message: 'Invalid login credentials' } })
    const wrong = await post({ password: 'mala', confirm: 'eliminar' })
    expect(wrong.status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it('bloquea el usuario antes de registrar el pedido y manda la confirmación', async () => {
    stubSupabaseEnv()
    mocks.auth.mockResolvedValue({ authenticated: true, user: USER })
    mocks.signIn.mockResolvedValueOnce({ data: { session: { access_token: 't' } }, error: null })
    mocks.updateUserById.mockResolvedValueOnce({ error: null })
    mocks.rpc.mockResolvedValueOnce({ data: REQUEST_ROW, error: null })
    mocks.from.mockReturnValueOnce(query({ data: [{ name: 'Mi Tienda' }], error: null }))
    mocks.sendEmail.mockResolvedValueOnce({ ok: true })

    const response = await post({ password: 'buena', confirm: 'ELIMINAR', source: 'app' })

    expect(await response.json()).toEqual({ success: true, scheduledFor: REQUEST_ROW.scheduled_for, closedOrganizations: 1, emailSent: true })
    expect(mocks.updateUserById).toHaveBeenCalledWith(USER.id, { ban_duration: '876000h' })
    expect(mocks.updateUserById.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0])
    expect(mocks.rpc).toHaveBeenCalledWith('request_account_deletion', { p_user_id: USER.id, p_source: 'app', p_reason: null })
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: USER.email }))
  })

  it('si no se puede bloquear, no registra nada y no dice que la cuenta quedó bloqueada', async () => {
    stubSupabaseEnv()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.auth.mockResolvedValue({ authenticated: true, user: USER })
    mocks.signIn.mockResolvedValueOnce({ data: { session: { access_token: 't' } }, error: null })
    mocks.updateUserById.mockResolvedValueOnce({ error: { code: 'unexpected_failure' } })

    const response = await post({ password: 'buena', confirm: 'ELIMINAR' })
    expect(response.status).toBe(500)
    expect((await response.json()).error).toMatch(/No se hizo ningún cambio/)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('si falla el registro del pedido, desbloquea el usuario', async () => {
    stubSupabaseEnv()
    mocks.auth.mockResolvedValue({ authenticated: true, user: USER })
    mocks.signIn.mockResolvedValueOnce({ data: { session: { access_token: 't' } }, error: null })
    mocks.updateUserById.mockResolvedValue({ error: null })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'caído' } })

    expect((await post({ password: 'buena', confirm: 'ELIMINAR' })).status).toBe(500)
    expect(mocks.updateUserById).toHaveBeenLastCalledWith(USER.id, { ban_duration: 'none' })
  })

  it('informa si el correo de confirmación no salió', async () => {
    stubSupabaseEnv()
    mocks.auth.mockResolvedValue({ authenticated: true, user: USER })
    mocks.signIn.mockResolvedValueOnce({ data: { session: { access_token: 't' } }, error: null })
    mocks.updateUserById.mockResolvedValueOnce({ error: null })
    mocks.rpc.mockResolvedValueOnce({ data: { ...REQUEST_ROW, closed_organization_ids: [] }, error: null })
    mocks.sendEmail.mockResolvedValueOnce({ ok: true, skipped: true })

    const body = await (await post({ password: 'buena', confirm: 'ELIMINAR' })).json()
    expect(body.emailSent).toBe(false)
  })
})

describe('confirmación con código por correo (cuentas de Google)', () => {
  it('acepta el código correcto, sin pedir contraseña, y lo borra', async () => {
    mocks.auth.mockResolvedValue({ authenticated: true, user: USER })
    const codeRow = query({ data: { code_hash: hash('482913'), expires_at: '2999-01-01T00:00:00Z', attempts: 0 }, error: null })
    const deleteCode = query({ data: null, error: null })
    mocks.from.mockReturnValueOnce(codeRow).mockReturnValueOnce(deleteCode).mockReturnValueOnce(query({ data: [], error: null }))
    mocks.updateUserById.mockResolvedValueOnce({ error: null })
    mocks.rpc.mockResolvedValueOnce({ data: { ...REQUEST_ROW, closed_organization_ids: [] }, error: null })
    mocks.sendEmail.mockResolvedValueOnce({ ok: true })

    const response = await post({ code: '482913', confirm: 'ELIMINAR', source: 'app' })

    expect(response.status).toBe(200)
    expect(mocks.signIn).not.toHaveBeenCalled()
    expect(deleteCode.delete).toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledWith('request_account_deletion', expect.objectContaining({ p_user_id: USER.id }))
  })

  it('un código incorrecto suma un intento y no toca la cuenta', async () => {
    mocks.auth.mockResolvedValue({ authenticated: true, user: USER })
    const update = query({ data: null, error: null })
    mocks.from
      .mockReturnValueOnce(query({ data: { code_hash: hash('482913'), expires_at: '2999-01-01T00:00:00Z', attempts: 2 }, error: null }))
      .mockReturnValueOnce(update)

    const response = await post({ code: '000000', confirm: 'ELIMINAR' })

    expect(response.status).toBe(403)
    expect(update.update).toHaveBeenCalledWith({ attempts: 3 })
    expect(mocks.updateUserById).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('rechaza códigos vencidos o con demasiados intentos, aunque sean correctos', async () => {
    mocks.auth.mockResolvedValue({ authenticated: true, user: USER })
    mocks.from.mockReturnValueOnce(query({ data: { code_hash: hash('482913'), expires_at: '2000-01-01T00:00:00Z', attempts: 0 }, error: null }))
    expect((await post({ code: '482913', confirm: 'ELIMINAR' })).status).toBe(403)

    mocks.from.mockReturnValueOnce(query({ data: { code_hash: hash('482913'), expires_at: '2999-01-01T00:00:00Z', attempts: 5 }, error: null }))
    expect((await post({ code: '482913', confirm: 'ELIMINAR' })).status).toBe(429)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('manda el código por correo y no deja pedir otro antes de un minuto', async () => {
    const { sendAccountDeletionCode } = await import('@/lib/account/account-deletion')
    const now = new Date('2026-11-19T12:00:00Z')
    const upsert = query({ data: null, error: null })
    mocks.from.mockReturnValueOnce(query({ data: null, error: null })).mockReturnValueOnce(upsert)
    mocks.sendEmail.mockResolvedValueOnce({ ok: true })

    await expect(sendAccountDeletionCode({ userId: USER.id, email: USER.email }, now)).resolves.toEqual({ expiresInMinutes: 10 })
    const saved = upsert.upsert.mock.calls[0][0] as { code_hash: string; expires_at: string }
    expect(saved.expires_at).toBe('2026-11-19T12:10:00.000Z')
    const html = mocks.sendEmail.mock.calls[0][0].html as string
    const code = html.match(/>(\d{6})</)?.[1] as string
    expect(saved.code_hash).toBe(hash(code))

    mocks.from.mockReturnValueOnce(query({ data: { created_at: '2026-11-19T11:59:30Z' }, error: null }))
    await expect(sendAccountDeletionCode({ userId: USER.id, email: USER.email }, now)).rejects.toMatchObject({ status: 429 })
  })

  it('si el correo no sale, borra el código y avisa', async () => {
    const { sendAccountDeletionCode } = await import('@/lib/account/account-deletion')
    const remove = query({ data: null, error: null })
    mocks.from.mockReturnValueOnce(query({ data: null, error: null })).mockReturnValueOnce(query({ data: null, error: null })).mockReturnValueOnce(remove)
    mocks.sendEmail.mockResolvedValueOnce({ ok: false, error: 'resend caído' })

    await expect(sendAccountDeletionCode({ userId: USER.id, email: USER.email })).rejects.toMatchObject({ status: 502 })
    expect(remove.delete).toHaveBeenCalled()
  })
})

describe('getAccountDeletionImpact', () => {
  it('avisa que la cuenta entra sin contraseña y el plazo', async () => {
    const { getAccountDeletionImpact } = await import('@/lib/account/account-deletion')
    mocks.from.mockReturnValueOnce(query({ data: null, error: null })).mockReturnValueOnce(query({ data: [], error: null }))
    mocks.getUserById.mockResolvedValueOnce({ data: { user: { identities: [{ provider: 'google' }] } }, error: null })

    await expect(getAccountDeletionImpact(USER.id, USER.email)).resolves.toMatchObject({ hasPassword: false, graceDays: 30, pending: null })
  })
})

describe('accountSupportEmail', () => {
  it('usa el correo del superadmin, después las variables y por último el de la marca', async () => {
    const { accountSupportEmail } = await import('@/lib/account/account-deletion')
    vi.stubEnv('SUPPORT_EMAIL', 'env@mitiendapy.com')

    mocks.branding.mockResolvedValueOnce({ supportEmail: 'marca@mitiendapy.com' })
    await expect(accountSupportEmail()).resolves.toBe('marca@mitiendapy.com')

    mocks.branding.mockResolvedValueOnce({ supportEmail: '' })
    await expect(accountSupportEmail()).resolves.toBe('env@mitiendapy.com')

    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('SUPPORT_EMAIL', '')
    vi.stubEnv('EMAIL_REPLY_TO', '')
    mocks.branding.mockRejectedValueOnce(new Error('base caída'))
    await expect(accountSupportEmail()).resolves.toBe('soporte@mitiendapy.com')
  })

  it('el impacto que recibe la app trae el correo del superadmin', async () => {
    const { getAccountDeletionImpact } = await import('@/lib/account/account-deletion')
    mocks.branding.mockResolvedValueOnce({ supportEmail: 'marca@mitiendapy.com' })
    mocks.from.mockReturnValueOnce(query({ data: null, error: null })).mockReturnValueOnce(query({ data: [], error: null }))
    mocks.getUserById.mockResolvedValueOnce({ data: { user: { identities: [{ provider: 'email' }] } }, error: null })

    await expect(getAccountDeletionImpact(USER.id, USER.email)).resolves.toMatchObject({ supportEmail: 'marca@mitiendapy.com' })
  })
})

describe('cancelAccountDeletion', () => {
  it('desbloquea y restaura; si la base falla, vuelve a bloquear', async () => {
    const { cancelAccountDeletion } = await import('@/lib/account/account-deletion')
    mocks.updateUserById.mockResolvedValue({ error: null })

    mocks.from.mockReturnValueOnce(query({ data: { id: 'req-1', user_id: USER.id, status: 'pending' }, error: null }))
    mocks.rpc.mockResolvedValueOnce({ data: {}, error: null })
    await expect(cancelAccountDeletion('req-1', 'admin-1')).resolves.toEqual({ userId: USER.id })
    expect(mocks.updateUserById).toHaveBeenCalledWith(USER.id, { ban_duration: 'none' })
    expect(mocks.rpc).toHaveBeenCalledWith('cancel_account_deletion', { p_request_id: 'req-1', p_actor_id: 'admin-1' })

    mocks.from.mockReturnValueOnce(query({ data: { id: 'req-1', user_id: USER.id, status: 'pending' }, error: null }))
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'caído' } })
    await expect(cancelAccountDeletion('req-1', 'admin-1')).rejects.toMatchObject({ status: 500 })
    expect(mocks.updateUserById).toHaveBeenLastCalledWith(USER.id, { ban_duration: '876000h' })
  })

  it('no cancela un pedido que ya no está pendiente', async () => {
    const { cancelAccountDeletion } = await import('@/lib/account/account-deletion')
    mocks.from.mockReturnValueOnce(query({ data: { id: 'req-1', user_id: USER.id, status: 'completed' }, error: null }))
    await expect(cancelAccountDeletion('req-1', 'admin-1')).rejects.toMatchObject({ status: 409 })
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })
})

describe('completeDueAccountDeletions', () => {
  it('anonimiza Auth, borra la foto y después la base; deja pendiente lo que falla', async () => {
    const { completeDueAccountDeletions } = await import('@/lib/account/account-deletion')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.from.mockReturnValueOnce(query({ data: [{ id: 'req-1', user_id: 'u1' }, { id: 'req-2', user_id: 'u2' }], error: null }))
    mocks.updateUserById
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'auth caído' } })
    mocks.storageList.mockResolvedValueOnce({ data: [{ name: 'foto.jpg' }], error: null })
    mocks.storageRemove.mockResolvedValueOnce({ error: null })
    mocks.rpc.mockResolvedValue({ data: {}, error: null })

    await expect(completeDueAccountDeletions(new Date('2026-12-02T00:00:00Z'))).resolves.toEqual({ completed: 1, failed: 1 })
    expect(mocks.updateUserById).toHaveBeenCalledWith('u1', expect.objectContaining({ email: 'eliminada-req-1@cuentas-eliminadas.invalid', user_metadata: {} }))
    expect(mocks.storageList).toHaveBeenCalledWith('u1', { limit: 1000 })
    expect(mocks.storageRemove).toHaveBeenCalledWith(['u1/foto.jpg'])
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('complete_account_deletion', { p_request_id: 'req-1' })
  })
})

describe('migraciones de eliminación de cuenta', () => {
  const original = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261101060000_account_deletion_requests.sql'), 'utf8')
  const codes = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261119090000_account_deletion_codes_and_cancel.sql'), 'utf8')

  it('solo el servidor la usa y conserva el usuario de Auth', () => {
    expect(original).toContain('alter table public.account_deletion_requests enable row level security')
    expect(original).toContain('revoke all on function public.complete_account_deletion(uuid) from public, anon, authenticated')
    expect(original).not.toMatch(/delete from auth\.users/)
  })

  it('los códigos y la cancelación también son solo del servidor', () => {
    expect(codes).toContain('alter table public.account_deletion_codes enable row level security')
    expect(codes).toContain('revoke all on table public.account_deletion_codes from anon, authenticated')
    expect(codes).toContain('revoke all on function public.request_account_deletion(uuid, text, text) from public, anon, authenticated')
    expect(codes).toContain('revoke all on function public.cancel_account_deletion(uuid, uuid) from public, anon, authenticated')
    expect(codes).not.toMatch(/delete from auth\./)
  })

  it('guarda el estado anterior antes de bloquear para poder cancelar', () => {
    const previous = codes.indexOf('v_previous := jsonb_build_object(')
    const suspend = codes.indexOf("update public.organization_members set status = 'suspended'")
    expect(previous).toBeGreaterThan(0)
    expect(previous).toBeLessThan(suspend)
    expect(codes).toContain('previous_state')
  })
})
