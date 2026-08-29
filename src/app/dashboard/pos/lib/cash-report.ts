import type { CashMovement, CashPaymentMethod } from '../types'

export type CanonicalCashPaymentMethod = 'cash' | 'card' | 'transfer' | 'mixed'

export type CashPaymentMethodSummary = {
  method: CanonicalCashPaymentMethod
  amount: number
  count: number
  percentage: number
}

export function normalizeCashPaymentMethod(method: CashPaymentMethod | string | null | undefined): CanonicalCashPaymentMethod {
  const normalized = String(method || 'cash').trim().toLowerCase()
  if (normalized === 'card' || normalized === 'tarjeta') return 'card'
  if (['transfer', 'transferencia', 'qr', 'sipap'].includes(normalized)) return 'transfer'
  if (normalized === 'mixed' || normalized === 'mixto') return 'mixed'
  return 'cash'
}

export function summarizeCashMovements(movements: Array<Pick<CashMovement, 'type' | 'amount' | 'payment_method'>>) {
  const totals = {
    incomes: 0,
    expenses: 0,
    totalSales: 0,
    cashSales: 0,
    cardSales: 0,
    transferSales: 0,
    mixedSales: 0,
  }
  const methods = new Map<CanonicalCashPaymentMethod, { amount: number; count: number }>()

  for (const movement of movements) {
    const amount = Number(movement.amount) || 0
    const type = String(movement.type).toLowerCase()
    if (type === 'sale' || type === 'venta') {
      const method = normalizeCashPaymentMethod(movement.payment_method)
      totals.totalSales += amount
      totals.incomes += amount
      if (method === 'cash') totals.cashSales += amount
      if (method === 'card') totals.cardSales += amount
      if (method === 'transfer') totals.transferSales += amount
      if (method === 'mixed') totals.mixedSales += amount
      const current = methods.get(method) || { amount: 0, count: 0 }
      methods.set(method, { amount: current.amount + amount, count: current.count + 1 })
    } else if (type === 'cash_in' || type === 'in' || type === 'ingreso') {
      totals.incomes += amount
    } else if (type === 'cash_out' || type === 'out' || type === 'egreso') {
      totals.expenses += amount
    }
  }

  const paymentMethods: CashPaymentMethodSummary[] = Array.from(methods.entries()).map(([method, value]) => ({
    method,
    amount: value.amount,
    count: value.count,
    percentage: totals.totalSales > 0 ? (value.amount / totals.totalSales) * 100 : 0,
  }))

  return { ...totals, paymentMethods }
}
