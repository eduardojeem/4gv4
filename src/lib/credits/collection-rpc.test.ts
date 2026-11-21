vi.mock('@/lib/payments/control-store', () => ({ assertCommercePayments: vi.fn().mockResolvedValue(undefined) }))
const replay = vi.hoisted(() => ({ recover: vi.fn() }))
vi.mock('@/lib/payments/collection-replay', () => ({ recoverCollectionReplay: replay.recover }))
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { collectionRequestSchema } from './collection-contract'
import { collectCustomerPayment, collectionAmountsMatchCurrency, readCollectionCurrency } from './collection-rpc'

const org = 'ca110000-0000-4000-8000-000000000001'
const customer = 'ca210000-0000-4000-8000-000000000001'
const actor = 'ca010000-0000-4000-8000-000000000001'
const branch = 'ca310000-0000-4000-8000-000000000001'
const request = { amount: 100, paymentMethod: 'cash', mode: 'auto', idempotencyKey: 'fixture-request-001' }
const result = {
  receiptId: 'ca910000-0000-4000-8000-000000000001', receiptNumber: 'COL-001',
  appliedAmount: 100, excessToStoreCredit: 0, recordedAt: '2026-10-11T12:00:00Z',
  allocations: [{ debtId: 'ca610000-0000-4000-8000-000000000001', type: 'installment',
    paymentId: 'ca810000-0000-4000-8000-000000000001', appliedAmount: 100, remainingBalance: 50 }],
}
const input = { organizationId: org, customerId: customer, actorId: actor, branchId: branch, request }

describe('customer collection transaction boundary', () => {
  it('accepts existing fractional installment balances without rounding debt', () => {
    expect(collectionRequestSchema.safeParse({ ...request, amount: 33333.33 }).success).toBe(true)
  })
  it('rejects invalid money and an actor supplied by the browser', () => {
    expect(collectionRequestSchema.safeParse({ ...request, amount: -1 }).success).toBe(false)
    expect(collectionRequestSchema.safeParse({ ...request, actorId: actor }).success).toBe(false)
  })
  it('returns a validated persisted receipt from one actor-scoped RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result, error: null })
    expect(await collectCustomerPayment({ rpc }, input)).toEqual(result)
    expect(rpc).toHaveBeenCalledOnce()
    expect(rpc).toHaveBeenCalledWith('collect_customer_payment_atomic', expect.objectContaining({
      p_organization_id: org, p_customer_id: customer, p_actor_id: actor, p_branch_id: branch,
      p_request: expect.objectContaining({ amount: 100, idempotencyKey: 'fixture-request-001' }),
    }))
  })
  it('fails closed if the migration is missing', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } })
    await expect(collectCustomerPayment({ rpc }, input)).rejects.toMatchObject({ status: 503 })
  })
  it('rejects an incomplete receipt instead of inventing a successful payment', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { appliedAmount: 100 }, error: null })
    await expect(collectCustomerPayment({ rpc }, input)).rejects.toMatchObject({ status: 502 })
  })
  it('maps changed balances to conflict without leaking database details', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'COLLECTION_BALANCE_CHANGED private details' } })
    await expect(collectCustomerPayment({ rpc }, input)).rejects.toMatchObject({ status: 409, code: 'COLLECTION_BALANCE_CHANGED' })
  })

  it('rejects guaraní cents before reaching the database', async () => {
    replay.recover.mockResolvedValue(null)
    const rpc = vi.fn()
    await expect(collectCustomerPayment({ rpc }, { ...input, currency: 'PYG', request: { ...request, amount: 99999.5 } }))
      .rejects.toMatchObject({ status: 400, code: 'COLLECTION_INVALID_REQUEST' })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('returns the stored receipt of an older cents attempt instead of rejecting it', async () => {
    replay.recover.mockResolvedValue(result)
    const rpc = vi.fn()
    expect(await collectCustomerPayment({ rpc }, { ...input, currency: 'PYG', request: { ...request, amount: 100.5 } })).toEqual(result)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('lets an old debt with cents be settled only for its exact balance', () => {
    const id = 'ca610000-0000-4000-8000-000000000001'
    const manual = (amount: number) => ({ ...request, mode: 'manual' as const, amount, allocations: [{ id, type: 'installment' as const, amount }] })
    expect(collectionAmountsMatchCurrency(collectionRequestSchema.parse(manual(33333.33)), 'PYG', { [id]: 33333.33 })).toBe(true)
    expect(collectionAmountsMatchCurrency(collectionRequestSchema.parse(manual(33333.3)), 'PYG', { [id]: 33333.33 })).toBe(false)
    expect(collectionAmountsMatchCurrency(collectionRequestSchema.parse({ ...request, amount: 33333.33 }), 'PYG', { [id]: 33333.33 })).toBe(false)
    expect(collectionAmountsMatchCurrency(collectionRequestSchema.parse({ ...request, amount: 100.5 }), 'USD')).toBe(true)
  })
  it('reads the organization currency and fails closed when it cannot', async () => {
    const client = (result: { data: unknown; error: unknown }) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) }) })
    expect(await readCollectionCurrency(client({ data: { currency: 'usd' }, error: null }) as never, org)).toBe('USD')
    expect(await readCollectionCurrency(client({ data: null, error: null }) as never, org)).toBe('PYG')
    await expect(readCollectionCurrency(client({ data: null, error: new Error('down') }) as never, org)).rejects.toMatchObject({ status: 503 })
  })
})
