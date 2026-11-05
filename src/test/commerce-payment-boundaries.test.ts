vi.mock('@/lib/payments/collection-replay', () => ({ recoverCollectionReplay: vi.fn().mockResolvedValue(null) }))
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentControlError } from '@/lib/payments/control-contract'
const assertPayments = vi.hoisted(() => vi.fn())
vi.mock('@/lib/payments/control-store', () => ({ assertCommercePayments: assertPayments }))
import { recoverCollectionReplay } from '@/lib/payments/collection-replay'
import { collectCustomerPayment } from '@/lib/credits/collection-rpc'
import { createCreditAccount, type CreateCreditAccountInput } from '@/lib/credits/create-credit-account'
import { registerUnpricedRepairDeposit } from '@/lib/repairs/unpriced-deposit-rpc'
import { closeRepairAndRegisterPayment } from '@/lib/repairs/financial-closure-rpc'
const id = 'cf010000-0000-4000-8000-000000000001'
beforeEach(() => { vi.mocked(recoverCollectionReplay).mockReset().mockResolvedValue(null); assertPayments.mockReset().mockRejectedValue(new PaymentControlError('Deshabilitado', 409, 'PAYMENT_METHOD_DISABLED')) })
describe('new commerce payments enforce policy before financial writes', () => {
  it('rejects customer and existing-credit collection without writing', async () => {
    assertPayments.mockRejectedValue(new PaymentControlError('Deshabilitado', 409, 'PAYMENT_METHOD_DISABLED'))
    const rpc = vi.fn()
    await expect(collectCustomerPayment({ rpc }, { organizationId: id, customerId: id, actorId: id, branchId: id, request: { amount: 100, paymentMethod: 'cash', mode: 'auto', idempotencyKey: id } })).rejects.toMatchObject({ status: 409 })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('returns a proven committed collection receipt while controls are disabled', async () => {
    const receipt = { receiptId: id, receiptNumber: 'existing', appliedAmount: 0, excessToStoreCredit: 100, recordedAt: '2026-11-03T20:00:00Z', allocations: [] }
    vi.mocked(recoverCollectionReplay).mockResolvedValue(receipt)
    const rpc = vi.fn()
    const request = { amount: 100, paymentMethod: 'cash', mode: 'auto', idempotencyKey: id }
    expect(await collectCustomerPayment({ rpc }, { organizationId: id, customerId: id, actorId: id, branchId: id, request })).toEqual(receipt)
    expect(recoverCollectionReplay).toHaveBeenCalledWith({ organizationId: id, customerId: id, actorId: id, branchId: id, request: { ...request, creditExcessToStoreCredit: false } })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects standalone financing without writing', async () => {
    const rpc = vi.fn()
    await expect(createCreditAccount({ supabase: { rpc }, actorId: id, organizationId: id } as unknown as CreateCreditAccountInput)).rejects.toMatchObject({ status: 409 })
    expect(assertPayments).toHaveBeenLastCalledWith(id, [{ method: 'credit' }])
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects unpriced deposits and delivery payments without writing', async () => {
    const rpc = vi.fn()
    await expect(registerUnpricedRepairDeposit({ rpc }, { organizationId: id, repairId: id, branchId: id, actorId: id, method: 'transfer', amount: 100, idempotencyKey: id, cashSessionId: id })).rejects.toMatchObject({ status: 409 })
    await expect(closeRepairAndRegisterPayment({ rpc }, { organizationId: id, repairId: id, branchId: id, actorId: id, deliver: true, allowOutstandingBalance: false, payment: { method: 'cash', amount: 100, idempotencyKey: id } })).rejects.toMatchObject({ status: 409 })
    expect(rpc).not.toHaveBeenCalled()
  })
})
