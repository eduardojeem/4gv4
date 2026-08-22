import { describe, expect, it } from 'vitest'

import { getRepairBalanceDue } from '../repair-charge'

describe('getRepairBalanceDue', () => {
  it('charges the full cost when nothing was paid yet', () => {
    expect(getRepairBalanceDue({ final_cost: 500, paid_amount: 0 })).toBe(500)
    expect(getRepairBalanceDue({ final_cost: null, estimated_cost: 300, paid_amount: null })).toBe(300)
  })

  it('charges only the remaining balance after a partial payment', () => {
    expect(getRepairBalanceDue({ final_cost: 500, paid_amount: 200 })).toBe(300)
    expect(getRepairBalanceDue({ estimated_cost: 300, paid_amount: 100 })).toBe(200)
  })

  it('charges nothing for a repair that is already fully paid', () => {
    expect(getRepairBalanceDue({ final_cost: 500, paid_amount: 500 })).toBe(0)
  })

  it('never goes negative even if paid_amount overshoots the cost', () => {
    expect(getRepairBalanceDue({ final_cost: 500, paid_amount: 600 })).toBe(0)
  })

  it('prefers final_cost over estimated_cost when both are set', () => {
    expect(getRepairBalanceDue({ final_cost: 450, estimated_cost: 500, paid_amount: 50 })).toBe(400)
  })

  it('rounds to cents', () => {
    expect(getRepairBalanceDue({ final_cost: 100.005, paid_amount: 0.001 })).toBeCloseTo(100, 2)
  })
})
