import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentControlError } from '@/lib/payments/control-contract'
const denied = vi.hoisted(() => ({ call: vi.fn() }))
vi.mock('@/lib/payments/subscription-controls', () => ({ assertSubscriptionPaymentEnabled: denied.call }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => { throw new Error('Unexpected financial DB access') } }))
import { createSubscriptionBancardCheckout } from '@/lib/saas/subscription-checkout'
import { createSubscriptionStripeCheckout } from '@/lib/saas/stripe-subscription-checkout'
import { redeemSubscriptionPromo } from '@/lib/saas/redeem-subscription-promo'
beforeEach(() => { denied.call.mockReset().mockRejectedValue(new PaymentControlError('Medio deshabilitado', 409)) })
describe('subscription creation policy boundaries', () => {
  it('blocks Bancard card payments before creating or reusing a provider order', async () => {
    const organization = { id: 'org', name: 'Test' }
    await expect(createSubscriptionBancardCheckout({ organization, canChangePlan: false })).rejects.toMatchObject({ status: 409 })
    expect(denied.call).toHaveBeenLastCalledWith('bancard_card')
  })
  it('blocks Stripe before touching provider or billing records', async () => {
    await expect(createSubscriptionStripeCheckout({ organization: { id: 'org', name: 'Test' }, canChangePlan: false })).rejects.toMatchObject({ status: 409 })
    expect(denied.call).toHaveBeenCalledWith('stripe')
  })
  it('rejects only the new promo redemption and returns a safe error', async () => {
    expect(await redeemSubscriptionPromo({ organizationId: 'org', actorId: 'user', code: 'TEST' })).toMatchObject({ success: false, status: 409 })
    expect(denied.call).toHaveBeenCalledWith('promo')
  })
})
