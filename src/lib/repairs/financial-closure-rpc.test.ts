import { describe, expect, it, vi } from 'vitest'
import {
  closeRepairAndRegisterPayment,
  FinancialClosureRpcError,
} from './financial-closure-rpc'

describe('repair financial closure RPC adapter', () => {
  it('passes server-resolved scope and the canonical closure contract', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { repair_id: 'repair-1', payment_id: 'payment-1', idempotent: false },
      error: null,
    })

    const result = await closeRepairAndRegisterPayment({ rpc }, {
      repairId: 'repair-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      actorId: 'user-1',
      deliver: true,
      outcome: 'repaired',
      note: 'Entregado al titular',
      allowOutstandingBalance: false,
      payment: {
        method: 'cash',
        amount: 100_000,
        idempotencyKey: 'delivery-payment-123',
      },
    })

    expect(rpc).toHaveBeenCalledWith('close_repair_and_register_payment', {
      p_repair_id: 'repair-1',
      p_organization_id: 'org-1',
      p_branch_id: 'branch-1',
      p_actor_id: 'user-1',
      p_deliver: true,
      p_delivery_outcome: 'repaired',
      p_delivery_note: 'Entregado al titular',
      p_allow_outstanding_balance: false,
      p_payment_method: 'cash',
      p_payment_amount: 100_000,
      p_payment_reference: null,
      p_payment_note: null,
      p_idempotency_key: 'delivery-payment-123',
      p_cash_session_id: null,
      p_credit_id: null,
      p_credit_interest_rate: null,
      p_credit_installment_count: null,
      p_credit_frequency: null,
      p_sale_id: null,
      p_source: 'delivery',
    })
    expect(result.payment_id).toBe('payment-1')
  })

  it('passes credit terms and returns the credit created by the atomic operation', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        repair_id: 'repair-1', payment_id: 'payment-1', credit_id: 'credit-1', credit_total: 112_000,
        idempotent: false,
      },
      error: null,
    })

    const result = await closeRepairAndRegisterPayment({ rpc }, {
      repairId: 'repair-1', organizationId: 'org-1', branchId: 'branch-1',
      actorId: 'user-1', deliver: false, allowOutstandingBalance: false,
      payment: {
        method: 'credit', amount: 100_000, interestRate: 12,
        installments: { count: 6, frequency: 'monthly' },
        idempotencyKey: 'credit-payment-123',
      },
    })

    expect(rpc).toHaveBeenCalledWith('close_repair_and_register_payment', expect.objectContaining({
      p_credit_id: null,
      p_credit_interest_rate: 12,
      p_credit_installment_count: 6,
      p_credit_frequency: 'monthly',
    }))
    expect(result.credit_id).toBe('credit-1')
    expect(result.credit_total).toBe(112_000)
  })

  it('maps stable database codes to a typed domain error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'REPAIR_PAYMENT_EXCEEDS_BALANCE' },
    })

    await expect(closeRepairAndRegisterPayment({ rpc }, {
      repairId: 'repair-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      actorId: 'user-1',
      deliver: false,
      allowOutstandingBalance: false,
      payment: {
        method: 'cash',
        amount: 150_000,
        idempotencyKey: 'payment-over-123',
      },
    })).rejects.toMatchObject<Partial<FinancialClosureRpcError>>({
      code: 'REPAIR_PAYMENT_EXCEEDS_BALANCE',
      status: 422,
    })
  })

  it('turns a credit-limit database code into an actionable user message', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'REPAIR_CREDIT_LIMIT_EXCEEDED|25000.00' },
    })

    await expect(closeRepairAndRegisterPayment({ rpc }, {
      repairId: 'repair-1', organizationId: 'org-1', branchId: 'branch-1',
      actorId: 'user-1', deliver: false, allowOutstandingBalance: false,
      payment: {
        method: 'credit', amount: 100_000, idempotencyKey: 'payment-credit-limit',
      },
    })).rejects.toMatchObject<Partial<FinancialClosureRpcError>>({
      code: 'REPAIR_CREDIT_LIMIT_EXCEEDED',
      status: 422,
      message: 'El cliente no tiene crédito disponible suficiente. Disponible: 25000.00.',
    })
  })
})
