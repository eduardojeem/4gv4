// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { collectionRequestSchema } from './collection-contract'
import { collectCustomerPayment } from './collection-rpc'

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
})
