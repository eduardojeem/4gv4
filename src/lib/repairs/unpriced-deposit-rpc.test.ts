import { describe, expect, it, vi } from 'vitest'
import { FinancialClosureRpcError } from './financial-closure-rpc'
import { registerUnpricedRepairDeposit } from './unpriced-deposit-rpc'

const input = {
  repairId: 'repair-1',
  organizationId: 'org-1',
  branchId: 'branch-1',
  actorId: 'user-1',
  method: 'cash' as const,
  amount: 50_000,
  reference: null,
  note: 'Seña inicial',
  idempotencyKey: 'deposit-123',
  cashSessionId: 'cash-1',
}

describe('registerUnpricedRepairDeposit', () => {
  it('sends only server-scoped deposit data to the atomic RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { repair_id: 'repair-1', payment_id: 'payment-1', paid_amount: 50_000, idempotent: false },
      error: null,
    })

    const result = await registerUnpricedRepairDeposit({ rpc }, input)

    expect(result.payment_id).toBe('payment-1')
    expect(rpc).toHaveBeenCalledWith('register_unpriced_repair_deposit', {
      p_repair_id: 'repair-1',
      p_organization_id: 'org-1',
      p_branch_id: 'branch-1',
      p_actor_id: 'user-1',
      p_payment_method: 'cash',
      p_payment_amount: 50_000,
      p_payment_reference: null,
      p_payment_note: 'Seña inicial',
      p_idempotency_key: 'deposit-123',
      p_cash_session_id: 'cash-1',
    })
  })

  it('returns a stable conflict when an idempotency key is reused with other data', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'REPAIR_IDEMPOTENCY_CONFLICT' } })

    await expect(registerUnpricedRepairDeposit({ rpc }, input)).rejects.toMatchObject<Partial<FinancialClosureRpcError>>({
      code: 'REPAIR_IDEMPOTENCY_CONFLICT',
      status: 409,
    })
  })
})
