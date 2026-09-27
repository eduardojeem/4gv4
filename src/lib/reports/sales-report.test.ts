import { describe, expect, it } from 'vitest'

import {
  buildSalesActivitySummary,
  calculateHistoricalProfit,
  calculateAveragePurchasesPerIdentifiedCustomer,
  createCalendarPeriodRange,
} from './sales-report'

describe('sales report metrics', () => {
  it('uses every calendar day in the selected range for the daily average', () => {
    const summary = buildSalesActivitySummary(
      [{ date: '2026-08-01', sales: 300_000 }],
      { from: new Date(2026, 7, 1, 10), to: new Date(2026, 7, 3, 18) },
    )

    expect(summary.dailyAverage).toBe(100_000)
    expect(summary.activeDays).toBe(1)
    expect(summary.periodDays).toBe(3)
  })

  it('does not include anonymous orders in purchase frequency', () => {
    expect(calculateAveragePurchasesPerIdentifiedCustomer({ customerA: 2, customerB: 1 })).toBe(1.5)
    expect(calculateAveragePurchasesPerIdentifiedCustomer({})).toBe(0)
  })

  it('uses immutable cost snapshots and reports missing historical coverage', () => {
    expect(calculateHistoricalProfit([
      { subtotal: 100_000, historicalTotalCost: 60_000 },
      { subtotal: 80_000, historicalTotalCost: null },
    ])).toEqual({
      profit: 40_000,
      coveredRevenue: 100_000,
      coveredItems: 1,
      totalItems: 2,
    })
  })

  it('builds quick filters as an inclusive number of calendar days', () => {
    const range = createCalendarPeriodRange(new Date(2026, 8, 1, 19, 30), 30)
    expect(range.from).toEqual(new Date(2026, 7, 3, 0, 0, 0, 0))
    expect(range.to).toEqual(new Date(2026, 8, 1, 19, 30))
  })
})
