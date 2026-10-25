import { expect, it } from 'vitest'
import { getVariantPurchaseCost, getVariantCostValue } from './variant-cost'

it.each([null, undefined, ''])('keeps unknown cost %s as NULL', value => {
  expect(getVariantPurchaseCost(value)).toBeNull()
})
it.each([0, 15])('preserves known cost %s', value => {
  expect(getVariantPurchaseCost(value)).toBe(value)
})
it('does not replace an explicit null with an alias or treat omitted cost as a requested update', () => {
  expect(getVariantCostValue({ purchase_price: null, cost_price: 25 })).toBeNull()
  expect(getVariantCostValue({ cost_price: 0 })).toBe(0)
  expect(getVariantCostValue({})).toBeUndefined()
})
