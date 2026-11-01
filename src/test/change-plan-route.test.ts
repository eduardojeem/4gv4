import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveRequestAuthUser: vi.fn(),
  getCurrentOrganizationContext: vi.fn(),
  assessPlanChange: vi.fn(),
  cancelSubscriptionAtPeriodEnd: vi.fn(),
  changePlan: vi.fn(),
  getCurrentOrganizationSubscription: vi.fn(),
  createSubscriptionPagoparCheckout: vi.fn(),
  createBankTransferRequest: vi.fn(),
}))

vi.mock('@/lib/auth/request-auth', () => ({ resolveRequestAuthUser: mocks.resolveRequestAuthUser }))
vi.mock('@/lib/saas/context', () => ({ getCurrentOrganizationContext: mocks.getCurrentOrganizationContext }))
vi.mock('@/lib/saas/subscription-service', () => ({
  assessPlanChange: mocks.assessPlanChange,
  cancelSubscriptionAtPeriodEnd: mocks.cancelSubscriptionAtPeriodEnd,
  changePlan: mocks.changePlan,
  getChangePlanData: vi.fn(),
  getCurrentOrganizationSubscription: mocks.getCurrentOrganizationSubscription,
  planRequiresPayment: (plan: { price_monthly: number }) => plan.price_monthly > 0,
}))
vi.mock('@/lib/saas/pagopar-subscription-checkout', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/saas/pagopar-subscription-checkout')>(),
  createSubscriptionPagoparCheckout: mocks.createSubscriptionPagoparCheckout,
}))
vi.mock('@/lib/saas/stripe-subscription-checkout', () => ({ createSubscriptionStripeCheckout: vi.fn() }))
vi.mock('@/lib/saas/bank-transfers', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/saas/bank-transfers')>(),
  createBankTransferRequest: mocks.createBankTransferRequest,
}))

const CORRELATION_ID = '11111111-1111-4111-8111-111111111111'

function post(body: Record<string, unknown>) {
  return import('@/app/api/admin/subscriptions/change-plan/route').then(({ POST }) => POST(
    new Request('http://localhost/api/admin/subscriptions/change-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': CORRELATION_ID },
      body: JSON.stringify(body),
    }) as never,
  ))
}

function subscriptionState(periodEndsAt: string | null, price = 200000) {
  return {
    currentPlan: { code: 'PRO_MAX', price_monthly: price },
    subscription: { current_period_ends_at: periodEndsAt, cancel_at_period_end: false },
    billingProfile: null,
  }
}

beforeEach(() => {
  mocks.resolveRequestAuthUser.mockResolvedValue({ authenticated: true, user: { id: 'user-1', email: 'a@b.test', role: 'user' } })
  mocks.getCurrentOrganizationContext.mockResolvedValue({ id: 'org-1', name: 'Org', role: 'owner' })
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/admin/subscriptions/change-plan', () => {
  it('con un mes pago vigente, pasar a Gratuito programa la baja en vez de cortar el período', async () => {
    const periodEnd = new Date(Date.now() + 10 * 86_400_000).toISOString()
    mocks.assessPlanChange.mockResolvedValue({ success: true, targetPlan: { code: 'FREE', price_monthly: 0 } })
    mocks.getCurrentOrganizationSubscription.mockResolvedValue(subscriptionState(periodEnd))
    mocks.cancelSubscriptionAtPeriodEnd.mockResolvedValue({ success: true, effectiveUntil: periodEnd })

    const response = await post({ plan: 'FREE' })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, scheduled: true, effectiveUntil: periodEnd })
    expect(mocks.cancelSubscriptionAtPeriodEnd).toHaveBeenCalledWith('org-1')
    expect(mocks.changePlan).not.toHaveBeenCalled()
  })

  it('sin período pago vigente, pasar a Gratuito es inmediato', async () => {
    mocks.assessPlanChange.mockResolvedValue({ success: true, targetPlan: { code: 'FREE', price_monthly: 0 } })
    mocks.getCurrentOrganizationSubscription.mockResolvedValue(subscriptionState(new Date(Date.now() - 86_400_000).toISOString()))
    mocks.changePlan.mockResolvedValue({ success: true })

    const response = await post({ plan: 'FREE' })

    expect(await response.json()).toMatchObject({ success: true, pendingPayment: false })
    expect(mocks.changePlan).toHaveBeenCalledWith('org-1', 'FREE')
    expect(mocks.cancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled()
  })

  it('por transferencia crea la solicitud y vuelve al bloque de pago', async () => {
    mocks.assessPlanChange.mockResolvedValue({ success: true, targetPlan: { code: 'PRO', price_monthly: 100000 } })
    mocks.createBankTransferRequest.mockResolvedValue({ id: 'transfer-1' })

    const response = await post({ plan: 'PRO', paymentMethod: 'transfer' })

    expect(await response.json()).toMatchObject({
      pendingPayment: true,
      transferRequestId: 'transfer-1',
      redirectTo: '/admin/subscriptions#pay-transfer',
    })
    expect(mocks.createBankTransferRequest).toHaveBeenCalledWith('org-1', 'user-1', 'PRO')
    expect(mocks.createSubscriptionPagoparCheckout).not.toHaveBeenCalled()
  })

  it('pasa el código de correlación a Pagopar', async () => {
    mocks.assessPlanChange.mockResolvedValue({ success: true, targetPlan: { code: 'PRO', price_monthly: 100000 } })
    mocks.createSubscriptionPagoparCheckout.mockResolvedValue({ checkoutUrl: 'https://www.pagopar.com/pagos/x' })

    await post({ plan: 'PRO', paymentMethod: 'qr' })

    expect(mocks.createSubscriptionPagoparCheckout).toHaveBeenCalledWith(expect.objectContaining({
      paymentMethod: 'qr',
      correlationId: CORRELATION_ID,
    }))
  })

  it('solo el propietario puede cambiar el plan', async () => {
    mocks.getCurrentOrganizationContext.mockResolvedValue({ id: 'org-1', name: 'Org', role: 'admin' })

    const response = await post({ plan: 'PRO' })

    expect(response.status).toBe(403)
    expect(mocks.assessPlanChange).not.toHaveBeenCalled()
  })
})
