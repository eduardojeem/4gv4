export type StockMovementType = 'entrada' | 'salida' | 'ajuste' | 'transferencia'

interface StockMovementInput {
  type: StockMovementType
  currentStock: number
  quantity: number
  reason: string
  sourceBranchId?: string | null
  destinationBranchId?: string | null
}

export function getStockMovementProjection(
  type: StockMovementType,
  currentStock: number,
  quantity: number
) {
  const finalStock = type === 'entrada'
    ? currentStock + quantity
    : type === 'ajuste'
      ? quantity
      : currentStock - quantity

  return {
    finalStock,
    delta: finalStock - currentStock,
  }
}

export function validateStockMovement(input: StockMovementInput) {
  const { type, currentStock, quantity, reason, sourceBranchId, destinationBranchId } = input

  if (!Number.isInteger(quantity) || quantity < 0 || (type !== 'ajuste' && quantity === 0)) {
    return type === 'ajuste'
      ? 'Ingresa un stock final válido.'
      : 'Ingresa una cantidad mayor a cero.'
  }

  if (!reason.trim()) return 'Indica el motivo del movimiento.'

  if ((type === 'salida' || type === 'transferencia') && quantity > currentStock) {
    return `La cantidad supera el stock disponible (${currentStock}).`
  }

  if (type === 'transferencia') {
    if (!sourceBranchId || !destinationBranchId || sourceBranchId === destinationBranchId) {
      return 'Selecciona una sucursal destino diferente del origen.'
    }
  }

  return null
}
