export type MoneyValue = {
  amount: number
  currency: string | null | undefined
}

export type CurrencyTotal = {
  currency: string
  amount: number
}

export function sumMoneyByCurrency(values: MoneyValue[]): CurrencyTotal[] {
  const totals = new Map<string, number>()

  for (const value of values) {
    const currency = value.currency?.trim().toUpperCase() || 'PYG'
    totals.set(currency, (totals.get(currency) ?? 0) + (Number(value.amount) || 0))
  }

  return Array.from(totals, ([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => {
      if (a.currency === 'PYG') return -1
      if (b.currency === 'PYG') return 1
      return a.currency.localeCompare(b.currency)
    })
}
