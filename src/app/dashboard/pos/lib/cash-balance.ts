export type CashBalanceMovement = {
  type: string
  amount: number
  payment_method?: string | null
}

export function isPhysicalCashSale(movement: CashBalanceMovement) {
  return movement.type === 'sale'
    && (!movement.payment_method || movement.payment_method === 'cash' || movement.payment_method === 'efectivo')
}

export function isPhysicalManualMovement(movement: CashBalanceMovement) {
  return (movement.type === 'cash_in' || movement.type === 'cash_out')
    && (!movement.payment_method || movement.payment_method === 'cash' || movement.payment_method === 'efectivo')
}

export function calculateExpectedCashBalance(movements: CashBalanceMovement[]) {
  return movements.reduce((total, movement) => {
    if (movement.type === 'opening' || (movement.type === 'cash_in' && isPhysicalManualMovement(movement)) || isPhysicalCashSale(movement)) {
      return total + Number(movement.amount || 0)
    }
    if (movement.type === 'cash_out' && isPhysicalManualMovement(movement)) {
      return total - Number(movement.amount || 0)
    }
    return total
  }, 0)
}
