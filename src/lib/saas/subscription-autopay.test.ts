import { describe, expect, it } from 'vitest'
import { AUTOPAY_MAX_ATTEMPTS, getAutopayRetryAt, isAutopayDue } from '@/lib/saas/subscription-autopay'

const DAY = 24 * 60 * 60 * 1000

describe('subscription autopay schedule', () => {
  const now = new Date('2026-11-25T12:00:00Z')

  it('retries 2 and then 3 days later, and stops after the third rejection', () => {
    expect(AUTOPAY_MAX_ATTEMPTS).toBe(3)
    expect(getAutopayRetryAt(1, now)?.getTime()).toBe(now.getTime() + 2 * DAY)
    expect(getAutopayRetryAt(2, now)?.getTime()).toBe(now.getTime() + 3 * DAY)
    expect(getAutopayRetryAt(3, now)).toBeNull()
  })

  it('charges only within the last day of the period', () => {
    const at = (ms: number) => new Date(now.getTime() + ms).toISOString()
    expect(isAutopayDue({ periodEndsAt: at(23 * 60 * 60 * 1000), cancelAtPeriodEnd: false, now })).toBe(true)
    expect(isAutopayDue({ periodEndsAt: at(-DAY), cancelAtPeriodEnd: false, now })).toBe(true)
    expect(isAutopayDue({ periodEndsAt: at(2 * DAY), cancelAtPeriodEnd: false, now })).toBe(false)
  })

  it('never charges a subscription set to cancel or without a period', () => {
    expect(isAutopayDue({ periodEndsAt: now.toISOString(), cancelAtPeriodEnd: true, now })).toBe(false)
    expect(isAutopayDue({ periodEndsAt: null, cancelAtPeriodEnd: false, now })).toBe(false)
    expect(isAutopayDue({ periodEndsAt: 'not-a-date', cancelAtPeriodEnd: false, now })).toBe(false)
  })
})
