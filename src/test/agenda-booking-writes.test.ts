import { describe, expect, it } from 'vitest'
import * as writes from '@/lib/agenda/booking-writes'

describe('public quote summary', () => {
  it('never leaks a hidden price or private revision/retry metadata', () => {
    const fn = (writes as Record<string, unknown>).publicQuoteSummary
    expect(fn).toBeTypeOf('function')
    const summary = (fn as (value: unknown, name: string) => Record<string, unknown>)({ id: 'q1', expires_at: '2027-01-01', starts_at: 'start', ends_at: 'end', professional_id: 'ana', duration_minutes: 45, price: 40000, hide_price: true, revision: 42, request_hash: 'private' }, 'Ana')
    expect(summary).toEqual({ quoteId: 'q1', expiresAt: '2027-01-01', startsAt: 'start', endsAt: 'end', professionalId: 'ana', professionalName: 'Ana', duration: 45, price: null })
  })
})
