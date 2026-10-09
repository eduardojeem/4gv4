import { describe, expect, it } from 'vitest'

import { resolveServiceTerms, type ServiceTermsOverride } from '@/lib/agenda/service-terms'

describe('service terms', () => {
  const base = { price: 30000, durationMinutes: 30, bufferMinutes: 0 }
  it.each<[ServiceTermsOverride | null, typeof base]>([
    [null, base],
    [{ price: 40000, durationMinutes: 45 }, { price: 40000, durationMinutes: 45, bufferMinutes: 0 }],
    [{ price: 0, durationMinutes: null, bufferMinutes: 5 }, { price: 0, durationMinutes: 30, bufferMinutes: 5 }],
  ])('inherits only null values (%j)', (override, expected) => {
    expect(resolveServiceTerms(base, override)).toEqual(expected)
  })
  it('rejects negative prices rather than emitting an invalid quote', () => {
    expect(() => resolveServiceTerms(base, { price: -1 })).toThrow('INVALID_SERVICE_TERMS')
  })
})
