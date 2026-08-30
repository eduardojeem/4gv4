import { normalizeCashMovementType } from '../types'

export type CashBalanceMovement = {
  type: string
  amount: number
  payment_method?: string | null
}

export function isPhysicalCashSale(movement: CashBalanceMovement) {
  return normalizeCashMovementType(movement.type) === 'sale'
    && (!movement.payment_method || movement.payment_method === 'cash' || movement.payment_method === 'efectivo')
}

export function isPhysicalManualMovement(movement: CashBalanceMovement) {
  const canonical = normalizeCashMovementType(movement.type)
  return (canonical === 'cash_in' || canonical === 'cash_out')
    && (!movement.payment_method || movement.payment_method === 'cash' || movement.payment_method === 'efectivo')
}

export function calculateExpectedCashBalance(movements: CashBalanceMovement[]) {
  return movements.reduce((total, movement) => {
    const canonical = normalizeCashMovementType(movement.type)
    if (canonical === 'opening') {
      return total + Number(movement.amount || 0)
    }
    if (canonical === 'cash_in' && isPhysicalManualMovement(movement)) {
      return total + Number(movement.amount || 0)
    }
    if (isPhysicalCashSale(movement)) {
      return total + Number(movement.amount || 0)
    }
    if (canonical === 'cash_out' && isPhysicalManualMovement(movement)) {
      return total - Number(movement.amount || 0)
    }
    return total
  }, 0)
}
