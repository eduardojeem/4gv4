import { describe, expect, it } from 'vitest'
import { getStockMovementProjection, validateStockMovement } from './stock-movement'

describe('getStockMovementProjection', () => {
  it.each([
    ['entrada', 8, 5, 13, 5],
    ['salida', 8, 5, 3, -5],
    ['transferencia', 8, 5, 3, -5],
    ['ajuste', 8, 5, 5, -3],
    ['ajuste', 8, 12, 12, 4],
  ] as const)('projects %s stock correctly', (type, currentStock, quantity, finalStock, delta) => {
    expect(getStockMovementProjection(type, currentStock, quantity)).toEqual({ finalStock, delta })
  })
})

describe('validateStockMovement', () => {
  it('allows an adjustment to zero', () => {
    expect(validateStockMovement({
      type: 'ajuste',
      currentStock: 8,
      quantity: 0,
      reason: 'Conteo físico',
    })).toBeNull()
  })

  it('rejects outgoing quantities above available stock', () => {
    expect(validateStockMovement({
      type: 'transferencia',
      currentStock: 4,
      quantity: 5,
      reason: 'Reposición',
      sourceBranchId: 'branch-a',
      destinationBranchId: 'branch-b',
    })).toBe('La cantidad supera el stock disponible (4).')
  })

  it('requires two different branches for transfers', () => {
    expect(validateStockMovement({
      type: 'transferencia',
      currentStock: 4,
      quantity: 2,
      reason: 'Reposición',
      sourceBranchId: 'branch-a',
      destinationBranchId: 'branch-a',
    })).toBe('Selecciona una sucursal destino diferente del origen.')
  })

  it('requires a reason with visible content', () => {
    expect(validateStockMovement({
      type: 'entrada',
      currentStock: 4,
      quantity: 2,
      reason: '   ',
    })).toBe('Indica el motivo del movimiento.')
  })
})
