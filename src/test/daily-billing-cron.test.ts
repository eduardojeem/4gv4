import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const tasks = vi.hoisted(() => ({ reconcile: vi.fn(), autopay: vi.fn(), grace: vi.fn() }))
vi.mock('@/lib/saas/pagopar-reconciliation', () => ({ reconcilePendingPagoparPayments: tasks.reconcile }))
vi.mock('@/lib/saas/subscription-autopay', () => ({ runSubscriptionAutopay: tasks.autopay }))
vi.mock('@/lib/saas/plan-grace-notifications', () => ({ sendPlanGraceNotifications: tasks.grace }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))

const { GET } = await import('@/app/api/cron/daily/route')

function call(authorization?: string) {
  return GET(new Request('https://www.mitiendapy.com/api/cron/daily', {
    headers: authorization ? { authorization } : {},
  }) as never)
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

describe('/api/cron/daily', () => {
  it('sin CRON_SECRET no corre nada', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await call('Bearer x')).status).toBe(503)
    expect(tasks.autopay).not.toHaveBeenCalled()
  })

  it('rechaza un secreto incorrecto', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto')
    expect((await call('Bearer otro')).status).toBe(401)
    expect(tasks.reconcile).not.toHaveBeenCalled()
  })

  it('corre las tres tareas y una que falla no frena a las demás', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto')
    tasks.reconcile.mockRejectedValue(new Error('Pagopar caído'))
    tasks.autopay.mockResolvedValue({ charged: 1 })
    tasks.grace.mockResolvedValue({ sent: 2 })

    const response = await call('Bearer secreto')
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.results.pagoparReconcile).toEqual({ ok: false, error: 'Pagopar caído' })
    expect(body.results.subscriptionAutopay).toEqual({ ok: true, data: { charged: 1 } })
    expect(body.results.planGraceNotifications).toEqual({ ok: true, data: { sent: 2 } })
  })

  it('está programada en el cron de Vercel', () => {
    const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'))
    expect(vercel.crons).toContainEqual(expect.objectContaining({ path: '/api/cron/daily' }))
  })
})

describe('pruebas de módulos', () => {
  it('solo las crea el servidor y con un plazo acotado', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261101030000_module_trials_server_only.sql'), 'utf8')
    expect(migration).toContain('drop policy if exists "owners admins create module trials"')
    expect(migration).toContain('revoke insert, update, delete on public.organization_module_trials from anon, authenticated')
    expect(migration).toContain("check (expires_at <= started_at + interval '8 days')")
  })
})
