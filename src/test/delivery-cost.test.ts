import { describe, expect, it } from 'vitest'
import { getDeliveryCost } from '@/lib/checkout/delivery-cost'

describe('getDeliveryCost', () => {
  it('uses the selected delivery zone cost', () => {
    expect(getDeliveryCost({
      fulfillmentType: 'DELIVERY',
      subtotal: 100000,
      defaultCost: 12000,
      selectedZoneCost: 5000,
      freeThreshold: 0,
    })).toBe(5000)
  })

  it('supports zones with free delivery', () => {
    expect(getDeliveryCost({
      fulfillmentType: 'DELIVERY',
      subtotal: 100000,
      defaultCost: 12000,
      selectedZoneCost: 0,
      freeThreshold: 0,
    })).toBe(0)
  })

  it('applies the global free shipping threshold before the zone cost', () => {
    expect(getDeliveryCost({
      fulfillmentType: 'DELIVERY',
      subtotal: 250000,
      defaultCost: 12000,
      selectedZoneCost: 5000,
      freeThreshold: 250000,
    })).toBe(0)
  })

  it('does not charge shipping for pickup', () => {
    expect(getDeliveryCost({
      fulfillmentType: 'PICKUP',
      subtotal: 100000,
      defaultCost: 12000,
      selectedZoneCost: 5000,
      freeThreshold: 0,
    })).toBe(0)
  })
})
