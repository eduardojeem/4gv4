type SalesDay = { date: string; sales: number }

function localDateOrdinal(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
}

export function createCalendarPeriodRange(now: Date, days: number) {
  const safeDays = Math.max(1, Math.floor(days))
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - (safeDays - 1))
  return { from, to: new Date(now) }
}

export function buildSalesActivitySummary(
  salesData: SalesDay[],
  range: { from: Date; to: Date },
) {
  const periodDays = Math.max(1, localDateOrdinal(range.to) - localDateOrdinal(range.from) + 1)
  let peakDay: SalesDay | null = null
  let total = 0
  let activeDays = 0

  for (const item of salesData) {
    total += item.sales
    if (item.sales > 0) activeDays += 1
    if (!peakDay || item.sales > peakDay.sales) peakDay = item
  }

  return {
    peakDay,
    peakAmount: peakDay?.sales || 0,
    dailyAverage: total / periodDays,
    activeDays,
    periodDays,
  }
}

export function calculateAveragePurchasesPerIdentifiedCustomer(
  ordersByCustomer: Record<string, number>,
): number {
  const counts = Object.values(ordersByCustomer).filter((count) => count > 0)
  if (counts.length === 0) return 0
  return counts.reduce((sum, count) => sum + count, 0) / counts.length
}

export function calculateHistoricalProfit(
  items: Array<{ subtotal: number; historicalTotalCost: number | null }>,
) {
  let profit = 0
  let coveredRevenue = 0
  let coveredItems = 0

  for (const item of items) {
    if (item.historicalTotalCost === null || !Number.isFinite(item.historicalTotalCost)) continue
    const subtotal = Number.isFinite(item.subtotal) ? item.subtotal : 0
    coveredRevenue += subtotal
    profit += subtotal - Math.max(0, item.historicalTotalCost)
    coveredItems += 1
  }

  return { profit, coveredRevenue, coveredItems, totalItems: items.length }
}
