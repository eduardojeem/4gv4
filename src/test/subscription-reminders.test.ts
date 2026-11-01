import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }))
vi.mock('@/lib/notifications/server/dispatcher', () => ({ dispatchNotificationEvent: vi.fn() }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: vi.fn() }))

const { reminderFor } = await import('@/lib/saas/subscription-notifications')

const NOW = new Date('2026-11-01T12:00:00Z').getTime()
const inDays = (days: number) => new Date(NOW + days * 86_400_000).toISOString()

function row(overrides: Record<string, unknown>) {
  return {
    organization_id: 'org',
    plan: 'PRO',
    status: 'active',
    payment_status: 'paid',
    trial_ends_at: null,
    current_period_ends_at: null,
    cancel_at_period_end: false,
    updated_at: inDays(-20),
    ...overrides,
  } as Parameters<typeof reminderFor>[0]
}

describe('reminderFor', () => {
  it('avisa una semana y un día antes de que venza el plan', () => {
    expect(reminderFor(row({ current_period_ends_at: inDays(6.5) }), NOW)?.kind).toBe('renewal_7')
    expect(reminderFor(row({ current_period_ends_at: inDays(0.5) }), NOW)?.kind).toBe('renewal_1')
    expect(reminderFor(row({ current_period_ends_at: inDays(12) }), NOW)).toBeNull()
  })

  it('no recuerda pagar a quien ya programó la baja ni a una cuenta Gratuita', () => {
    expect(reminderFor(row({ current_period_ends_at: inDays(3), cancel_at_period_end: true }), NOW)).toBeNull()
    expect(reminderFor(row({ plan: 'FREE', current_period_ends_at: inDays(3) }), NOW)).toBeNull()
  })

  it('avisa que termina la prueba gratis', () => {
    expect(reminderFor(row({ status: 'trialing', trial_ends_at: inDays(2.5) }), NOW)?.kind).toBe('trial_3')
    expect(reminderFor(row({ status: 'trialing', trial_ends_at: inDays(0.5) }), NOW)?.kind).toBe('trial_1')
  })

  it('avisa el pago pendiente y la baja reciente a Gratuito, una vez por período', () => {
    const pending = reminderFor(row({ status: 'past_due', current_period_ends_at: inDays(-1) }), NOW)
    expect(pending).toMatchObject({ kind: 'past_due', periodKey: inDays(-1) })

    expect(reminderFor(row({ plan: 'FREE', payment_status: 'unpaid', updated_at: inDays(-1) }), NOW)?.kind).toBe('downgraded')
    expect(reminderFor(row({ plan: 'FREE', payment_status: 'unpaid', updated_at: inDays(-10) }), NOW)).toBeNull()
  })
})
