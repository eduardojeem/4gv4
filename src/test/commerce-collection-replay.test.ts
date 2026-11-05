// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }))
import { matchingCollectionReplay } from '@/lib/payments/collection-replay'
const id = 'cf010000-0000-4000-8000-000000000001'
const input = { organizationId: id, customerId: id, actorId: id, branchId: id, request: { amount: 100, paymentMethod: 'cash' as const, mode: 'auto' as const, idempotencyKey: id } }
const result = { receiptId: id, receiptNumber: 'receipt', appliedAmount: 100, excessToStoreCredit: 0, recordedAt: '2026-11-03T20:00:00Z', allocations: [{ debtId: id, type: 'installment', paymentId: id, appliedAmount: 100, remainingBalance: 0 }] }
const stored = { request: { payload: input.request, actor: id, branch: id, customer: id }, result }
describe('committed collection replay proof', () => {
  it('accepts only the exact persisted request and validated receipt', () => {
    expect(matchingCollectionReplay(stored, input)).toEqual(result)
    expect(matchingCollectionReplay({ ...stored, result: null }, input)).toBeNull()
    expect(matchingCollectionReplay(null, input)).toBeNull()
  })
  it('rejects a changed actor, branch, customer, amount or method', () => {
    for (const key of ['actorId', 'branchId', 'customerId'] as const) expect(matchingCollectionReplay(stored, { ...input, [key]: 'other' })).toBeNull()
    expect(matchingCollectionReplay(stored, { ...input, request: { ...input.request, amount: 101 } })).toBeNull()
    expect(matchingCollectionReplay(stored, { ...input, request: { ...input.request, paymentMethod: 'transfer' } })).toBeNull()
  })
})
