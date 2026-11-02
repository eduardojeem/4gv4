import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  organization: vi.fn(),
  from: vi.fn(),
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/auth/request-auth', () => ({ resolveRequestAuthUser: mocks.auth }))
vi.mock('@/lib/saas/context', () => ({ getCurrentOrganizationContext: mocks.organization }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ from: mocks.from }) }))
vi.mock('@/lib/email/resend', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/email/resend')>(), sendEmail: mocks.sendEmail }))

const USER = { id: 'user-1', email: 'dueno@tienda.test', role: 'admin' }

/** Dos llamadas a `from`: primero el conteo de la última hora, después el insert. */
function tables(count: number, insert = vi.fn()) {
  const countChain: Record<string, unknown> = {}
  for (const method of ['select', 'eq']) countChain[method] = vi.fn(() => countChain)
  countChain.gte = vi.fn(async () => ({ count, error: null }))
  const insertChain = { insert: insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: 'fb-1' }, error: null }) }) }) }
  mocks.from.mockReturnValueOnce(countChain).mockReturnValueOnce(insertChain)
  return insert
}

async function post(body: unknown) {
  const { POST } = await import('@/app/api/feedback/route')
  return POST(new Request('http://localhost/api/feedback', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'vitest' }, body: JSON.stringify(body),
  }) as never)
}

afterEach(() => vi.clearAllMocks())

describe('POST /api/feedback', () => {
  it('pide sesión y valida el tipo y el mensaje', async () => {
    mocks.auth.mockResolvedValueOnce({ authenticated: false, reason: 'unauthenticated' })
    expect((await post({ kind: 'bug', message: 'Se cuelga' })).status).toBe(401)

    mocks.auth.mockResolvedValue({ authenticated: true, user: USER })
    expect((await post({ kind: 'queja', message: 'Se cuelga' })).status).toBe(400)
    expect((await post({ kind: 'bug', message: ' a ' })).status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('guarda el comentario con el comercio y avisa a soporte', async () => {
    mocks.auth.mockResolvedValue({ authenticated: true, user: USER })
    mocks.organization.mockResolvedValue({ id: 'org-1', name: 'Mi Tienda' })
    mocks.sendEmail.mockResolvedValueOnce({ ok: true })
    const insert = tables(0)

    const response = await post({ kind: 'idea', message: 'Que el POS <b>imprima</b> el logo', pagePath: '/dashboard/pos', source: 'web' })

    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: USER.id, organization_id: 'org-1', kind: 'idea', page_path: '/dashboard/pos', source: 'web', user_agent: 'vitest',
    }))
    const email = mocks.sendEmail.mock.calls[0][0]
    expect(email).toMatchObject({ replyTo: USER.email, subject: '[Comentario · Idea] Mi Tienda' })
    expect(email.html).toContain('&lt;b&gt;imprima&lt;/b&gt;')
  })

  it('corta después de 10 comentarios en una hora', async () => {
    mocks.auth.mockResolvedValue({ authenticated: true, user: USER })
    mocks.organization.mockResolvedValue(null)
    const insert = tables(10)

    expect((await post({ kind: 'bug', message: 'Otra vez' })).status).toBe(429)
    expect(insert).not.toHaveBeenCalled()
  })
})

describe('migración de comentarios', () => {
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261101070000_user_feedback.sql'), 'utf8')

  it('solo el servidor lee y escribe', () => {
    expect(migration).toContain('alter table public.user_feedback enable row level security')
    expect(migration).toContain('revoke all on table public.user_feedback from anon, authenticated')
    expect(migration).not.toMatch(/create policy/i)
  })
})
