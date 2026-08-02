import { describe, expect, it } from 'vitest'
import { evaluateSubscriptionStatus } from '@/lib/saas/subscription-status'

describe('subscription status evaluation', () => {
  const now = new Date('2026-07-31T12:00:00.000Z')

  it('uses free plan limits when a paid subscription is past due', () => {
    const status = evaluateSubscriptionStatus({
      status: 'past_due',
      paymentStatus: 'unpaid',
      periodEndsAt: '2026-07-30T12:00:00.000Z',
    }, now)

    expect(status.isExpired).toBe(true)
    expect(status.isBlocked).toBe(false)
  })

  it('keeps access during an active paid period even when payment is marked unpaid', () => {
    const status = evaluateSubscriptionStatus({
      status: 'active',
      paymentStatus: 'unpaid',
      periodEndsAt: '2026-08-15T12:00:00.000Z',
    }, now)

    expect(status.isExpired).toBe(false)
  })

  it('blocks suspended and canceled subscriptions', () => {
    expect(evaluateSubscriptionStatus({ status: 'suspended' }, now).isBlocked).toBe(true)
    expect(evaluateSubscriptionStatus({ status: 'canceled' }, now).isBlocked).toBe(true)
    expect(evaluateSubscriptionStatus({ status: 'cancelled' }, now).isBlocked).toBe(true)
  })
})
