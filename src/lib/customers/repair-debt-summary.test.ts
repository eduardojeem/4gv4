import { describe, expect, it } from 'vitest'
import { summarizeRepairDebts } from './repair-debt-summary'

describe('summarizeRepairDebts', () => {
  it('adds open repair balances and marks delivered balances overdue', () => {
    const result = summarizeRepairDebts([
      {
        customer_id: 'customer-1',
        status: 'entregado',
        pricing_mode: 'total',
        final_cost: 100_000,
        paid_amount: 20_000,
        parts: [],
      },
      {
        customer_id: 'customer-1',
        status: 'en_reparacion',
        pricing_mode: 'total',
        estimated_cost: 50_000,
        paid_amount: 10_000,
        parts: [],
      },
    ])

    expect(result['customer-1']).toEqual({ totalPending: 120_000, overdue: 80_000 })
  })

  it('ignores cancelled and fully paid repairs', () => {
    const result = summarizeRepairDebts([
      { customer_id: 'customer-1', status: 'cancelado', final_cost: 90_000, paid_amount: 0, parts: [] },
      { customer_id: 'customer-2', status: 'listo', final_cost: 90_000, paid_amount: 90_000, parts: [] },
    ])

    expect(result).toEqual({})
  })
})
