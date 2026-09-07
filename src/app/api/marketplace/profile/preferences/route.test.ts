import { describe, expect, it } from 'vitest'
import { preferenceDefaults, preferencePatchSchema } from './route'

describe('marketplace preference contract', () => {
  it('keeps optional exposure disabled by default', () => {
    expect(preferenceDefaults.promotions).toBe(false)
    expect(preferenceDefaults.marketingCommunications).toBe(false)
    expect(preferenceDefaults.publicProfile).toBe(false)
  })

  it('rejects unknown preference fields', () => {
    expect(preferencePatchSchema.safeParse({ promotions: true, role: 'admin' }).success).toBe(false)
  })
})
