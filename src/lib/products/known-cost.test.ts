import { describe, expect, it } from 'vitest'
import { knownCost, costTotal, costProfit, costMargin } from './known-cost'
describe('hidden cost calculations', () => {
  it('keeps an authorized real zero', () => { expect(knownCost(0)).toBe(0); expect(costProfit(100, 0)).toBe(100) })
  it.each([null, undefined, '', '  ', 'invalid', false, Infinity])('never interprets unknown %s as zero', value => { expect(knownCost(value)).toBeNull(); expect(costProfit(100, knownCost(value))).toBeNull() })
  it('does not publish partial aggregate costs', () => { expect(costTotal([20, null, 30])).toBeNull(); expect(costTotal([0, 20])).toBe(20); expect(costTotal([])).toBe(0) })
  it('preserves positive cost and handles zero revenue', () => { expect(costProfit(100, 40)).toBe(60); expect(costMargin(100, 40)).toBe(60); expect(costMargin(0, 0)).toBe(0); expect(costMargin(100, null)).toBeNull() })
})
