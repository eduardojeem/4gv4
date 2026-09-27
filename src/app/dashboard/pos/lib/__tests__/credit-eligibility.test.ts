import { describe, expect, it } from 'vitest'

import { buildCreditEligibility } from '../credit-eligibility'

describe('credit eligibility requirements', () => {
  it('marks every requirement as met when the sale is eligible', () => {
    expect(buildCreditEligibility({
      hasCustomer: true,
      hasCreditLine: true,
      availableCredit: 2_000_000,
      financedTotal: 1_500_000,
      stock: 2,
      quantity: 1,
      isRegisterOpen: true,
    }).every(item => item.met)).toBe(true)
  })

  it('explains missing customer, credit line and capacity separately', () => {
    const requirements = buildCreditEligibility({
      hasCustomer: false,
      hasCreditLine: false,
      availableCredit: 0,
      financedTotal: 1_500_000,
      stock: 2,
      quantity: 1,
      isRegisterOpen: true,
    })

    expect(requirements.find(item => item.id === 'customer')?.met).toBe(false)
    expect(requirements.find(item => item.id === 'credit_line')?.met).toBe(false)
    expect(requirements.find(item => item.id === 'credit_capacity')?.met).toBe(false)
  })

  it('detects insufficient stock and a closed register', () => {
    const requirements = buildCreditEligibility({
      hasCustomer: true,
      hasCreditLine: true,
      availableCredit: 2_000_000,
      financedTotal: 1_500_000,
      stock: 1,
      quantity: 2,
      isRegisterOpen: false,
    })

    expect(requirements.find(item => item.id === 'stock')?.met).toBe(false)
    expect(requirements.find(item => item.id === 'register')?.met).toBe(false)
  })
})
