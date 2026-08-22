import { describe, expect, it } from 'vitest'

import { buildProductCreditPayments, getCartProductCreditPlans, getProductCreditAllocation } from '../cart-credit-plans'

describe('cart product credit plans', () => {
  it('returns the configured plans with their product source', () => {
    const plans = getCartProductCreditPlans([
      {
        id: 'phone',
        name: 'Teléfono',
        price: 1_200_000,
        quantity: 1,
        installmentsEnabled: true,
        installmentsPlans: [{ count: 6, rate: 0 }, { count: 12, rate: 12 }],
      },
      {
        id: 'case',
        name: 'Funda',
        price: 100_000,
        quantity: 1,
        installmentsEnabled: false,
        installmentsPlans: [{ count: 3, rate: 0 }],
      },
    ])

    expect(plans).toMatchObject([
      { productId: 'phone', productName: 'Teléfono', count: 6, interestRate: 0 },
      { productId: 'phone', productName: 'Teléfono', count: 12, interestRate: 12 },
    ])
  })

  it('deduplicates identical terms from the same product', () => {
    const plans = getCartProductCreditPlans([{
      id: 'phone',
      name: 'Teléfono',
      price: 1_200_000,
      quantity: 1,
      installmentsEnabled: true,
      installmentsPlans: [{ count: 6, rate: 0 }, { count: 6, rate: 0 }],
    }])

    expect(plans).toHaveLength(1)
  })

  it('uses the current catalog configuration for legacy cart items', () => {
    const plans = getCartProductCreditPlans(
      [{ id: 'phone', name: 'Teléfono', price: 1_200_000, quantity: 1 }],
      [{
        id: 'phone',
        name: 'Teléfono actualizado',
        price: 1_200_000,
        quantity: 1,
        installmentsEnabled: true,
        installmentsPlans: [{ count: 12, rate: 10 }],
      }],
    )

    expect(plans).toMatchObject([
      { productId: 'phone', productName: 'Teléfono', count: 12, interestRate: 10 },
    ])
  })

  it('finances only the selected product and leaves the rest due now', () => {
    const allocation = getProductCreditAllocation({
      productId: 'phone',
      productName: 'Teléfono',
      count: 12,
      interestRate: 10,
      frequency: 'monthly',
      productSubtotal: 1_200_000,
      cartSubtotal: 1_300_000,
    }, 1_300_000)

    expect(allocation).toEqual({ financedPrincipal: 1_200_000, dueNow: 100_000 })
  })

  it('allocates ticket discounts proportionally without losing cents', () => {
    const allocation = getProductCreditAllocation({
      productId: 'phone',
      productName: 'Teléfono',
      count: 6,
      interestRate: 0,
      frequency: 'monthly',
      productSubtotal: 600_000,
      cartSubtotal: 1_000_000,
    }, 900_000)

    expect(allocation).toEqual({ financedPrincipal: 540_000, dueNow: 360_000 })
    expect(allocation.financedPrincipal + allocation.dueNow).toBe(900_000)
  })

  it('builds an immediate cash payment plus credit for a mixed cart', () => {
    const payments = buildProductCreditPayments({
      productId: 'phone', productName: 'Teléfono', count: 12, interestRate: 10,
      frequency: 'monthly', productSubtotal: 1_200_000, cartSubtotal: 1_300_000,
    }, 1_300_000, (() => { let id = 0; return () => `payment-${++id}` })())

    expect(payments).toEqual([
      { id: 'payment-1', method: 'cash', amount: 100_000 },
      { id: 'payment-2', method: 'credit', amount: 1_200_000 },
    ])
  })
})
