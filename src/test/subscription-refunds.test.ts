import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  superAdmin: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  chargeback: vi.fn(),
  receipt: vi.fn(),
  audit: vi.fn(),
  after: vi.fn((callback: () => unknown) => callback()),
}))

vi.mock('next/server', async (importOriginal) => ({ ...await importOriginal<typeof import('next/server')>(), after: mocks.after }))
vi.mock('@/lib/superadmin/auth', () => ({ getSuperAdminUser: mocks.superAdmin }))
vi.mock('@/lib/superadmin/audit', () => ({ logSuperAdminAction: mocks.audit }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ rpc: mocks.rpc, from: mocks.from }) }))
vi.mock('@/lib/health/webhook-log', () => ({ recordWebhookEvent: vi.fn() }))
vi.mock('@/lib/saas/subscription-notifications', () => ({
  notifySubscriptionChargeback: mocks.chargeback,
  sendSubscriptionPaymentReceipt: mocks.receipt,
}))

const PAYMENT_ID = '11111111-1111-4111-8111-111111111111'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('reembolso desde el superadmin', () => {
  async function refund(body: unknown) {
    const { POST } = await import('@/app/api/superadmin/payments/[id]/refund/route')
    return POST(new Request(`http://localhost/api/superadmin/payments/${PAYMENT_ID}/refund`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }) as never, { params: Promise.resolve({ id: PAYMENT_ID }) })
  }

  it('solo el superadmin puede reembolsar', async () => {
    mocks.superAdmin.mockResolvedValue(null)
    expect((await refund({ reason: 'Pidió la baja', revokeAccess: true })).status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('exige motivo y registra el reembolso con la quita de acceso', async () => {
    mocks.superAdmin.mockResolvedValue({ id: 'admin', email: 'a@b.test' })
    expect((await refund({ reason: '', revokeAccess: true })).status).toBe(400)

    mocks.rpc.mockResolvedValue({ data: { organization_id: 'org', amount: 100000, access_revoked: true }, error: null })
    const response = await refund({ reason: 'Pidió la baja', revokeAccess: true })

    expect(await response.json()).toEqual({ success: true, accessRevoked: true })
    expect(mocks.rpc).toHaveBeenCalledWith('refund_subscription_payment', {
      p_actor_id: 'admin', p_payment_id: PAYMENT_ID, p_reason: 'Pidió la baja', p_revoke_access: true, p_chargeback: false,
    })
  })

  it('traduce los errores de la base', async () => {
    mocks.superAdmin.mockResolvedValue({ id: 'admin', email: 'a@b.test' })
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'REFUND_INVALID_STATE' } })
    const response = await refund({ reason: 'Duplicado', revokeAccess: false })
    expect(response.status).toBe(409)
  })
})

describe('migración de reembolsos y prorrateo', () => {
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261101040000_subscription_refunds_proration_reminders.sql'), 'utf8')

  it('el prorrateo suma días al período y el reembolso queda protegido', () => {
    expect(migration).toContain("make_interval(days => coalesce(v_payment.proration_extra_days, 0))")
    expect(migration).toContain("if p_actor_id is null and not p_chargeback then")
    expect(migration).toContain('revoke all on function public.refund_subscription_payment(uuid, uuid, text, boolean, boolean) from public, anon, authenticated')
    expect(migration).toContain('alter table public.subscription_reminders_sent enable row level security')
  })
})

describe('migración de cupo y pagos reembolsados', () => {
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261101050000_plan_quota_and_refunded_payments.sql'), 'utf8')

  it('no reaplica un pago reembolsado y controla el cupo solo para el cliente', () => {
    expect(migration).toContain("if v_payment.status in ('paid', 'refunded') then")
    expect(migration).toContain("returns trigger language plpgsql security invoker")
    expect(migration).toContain("if current_user not in ('authenticated', 'anon') then")
    expect(migration).toContain('before insert or update of is_active, archived_by_plan_at, unit_measure, organization_id on public.products')
  })
})
