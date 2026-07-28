import { describe, expect, it } from 'vitest'
import { isSupportedPlanCode, planRequiresPayment } from '@/lib/saas/subscription-service'

describe('subscription plan changes', () => {
  it('requires confirmed payment for paid plans', () => {
    expect(planRequiresPayment({ price_monthly: 99000 })).toBe(true)
  })

  it('allows a free plan to be applied without checkout', () => {
    expect(planRequiresPayment({ price_monthly: 0 })).toBe(false)
  })

  it('rejects unknown plan codes instead of converting them to free', () => {
    expect(isSupportedPlanCode('PRO')).toBe(true)
    expect(isSupportedPlanCode('unknown-plan')).toBe(false)
  })
})
