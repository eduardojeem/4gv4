export type QuickStockAdjustment = {
  quantityChange: number
  expectedPreviousStock: number
}

export function buildQuickStockAdjustment(
  currentStock: number,
  requestedDelta: number,
): QuickStockAdjustment | null {
  const normalizedStock = Math.max(0, Math.trunc(Number(currentStock) || 0))
  const normalizedDelta = Math.trunc(Number(requestedDelta) || 0)
  const nextStock = normalizedStock + normalizedDelta

  if (normalizedDelta === 0 || nextStock < 0) return null

  return {
    quantityChange: normalizedDelta,
    expectedPreviousStock: normalizedStock,
  }
}
