import { describe, expect, it, vi } from 'vitest'
import { awardPaidRepairLoyaltyPoints } from './repair-points'

describe('awardPaidRepairLoyaltyPoints', () => {
  it('no acredita mientras la reparación tenga saldo pendiente', async () => {
    const rpc = vi.fn()

    const result = await awardPaidRepairLoyaltyPoints({ rpc }, {
      organizationId: 'org-1', repairId: 'repair-1', customerId: 'customer-1',
      total: 200_000, paymentStatus: 'parcial',
    })

    expect(result).toEqual({ awarded: false, reason: 'not-paid' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('acredita el total cobrado una sola vez por reparación', async () => {
    const rpc = vi.fn(async () => ({ data: { id: 'ledger-1' }, error: null }))

    const result = await awardPaidRepairLoyaltyPoints({ rpc }, {
      organizationId: 'org-1', repairId: 'repair-1', customerId: 'customer-1',
      total: 200_000, paymentStatus: 'pagado',
    })

    expect(rpc).toHaveBeenCalledWith('award_loyalty_points_for_sale', {
      p_organization_id: 'org-1',
      p_customer_id: 'customer-1',
      p_amount: 200_000,
      p_sale_id: null,
      p_idempotency_key: 'repair:repair-1',
    })
    expect(result).toEqual({ awarded: true, reason: 'awarded' })
  })

  it('no acredita reparaciones sin cliente o con total inválido', async () => {
    const rpc = vi.fn()

    expect(await awardPaidRepairLoyaltyPoints({ rpc }, {
      organizationId: 'org-1', repairId: 'repair-1', customerId: null,
      total: 200_000, paymentStatus: 'pagado',
    })).toEqual({ awarded: false, reason: 'missing-customer' })

    expect(await awardPaidRepairLoyaltyPoints({ rpc }, {
      organizationId: 'org-1', repairId: 'repair-1', customerId: 'customer-1',
      total: 0, paymentStatus: 'pagado',
    })).toEqual({ awarded: false, reason: 'invalid-total' })
    expect(rpc).not.toHaveBeenCalled()
  })
})
