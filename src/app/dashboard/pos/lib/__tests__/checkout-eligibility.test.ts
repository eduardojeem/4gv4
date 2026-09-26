import { describe, expect, it } from 'vitest'
import { getCheckoutEligibility } from '../checkout-eligibility'

describe('getCheckoutEligibility', () => {
  it.each([
    [{ itemCount: 1, hasOpenCashSession: true, isProcessing: true }, false, 'Esperá a que termine el cobro actual'],
    [{ itemCount: 0, hasOpenCashSession: true }, false, 'Agregá productos o una reparación'],
    [{ itemCount: 1, hasOpenCashSession: false }, false, 'Abrí la caja para continuar'],
    [{ itemCount: 1, hasOpenCashSession: true, customerRequired: true, customerSelected: false }, false, 'Seleccioná el cliente'],
    [{ itemCount: 1, hasOpenCashSession: true }, true, undefined],
  ])('returns one actionable reason', (input, canConfirm, reason) => {
    const eligibility = getCheckoutEligibility(input)
    expect(eligibility.canConfirm).toBe(canConfirm)
    expect(eligibility.reason).toBe(reason)
  })

  it('allows preparing checkout with items while the cash register is closed', () => {
    expect(getCheckoutEligibility({ itemCount: 1, hasOpenCashSession: false })).toMatchObject({
      canOpen: true,
      canConfirm: false,
    })
  })
})
