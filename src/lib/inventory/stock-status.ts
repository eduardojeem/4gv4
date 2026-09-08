export type StockLevel = 'out' | 'low' | 'normal' | 'high'

export interface StockLevelInput {
  stock_quantity?: number | null
  min_stock?: number | null
  max_stock?: number | null
}

/**
 * `max_stock` sin configurar significa «sin techo definido», no «techo cero».
 *
 * El modal de producto crea con `max_stock: 0` y el campo es opcional, asi que
 * la mayoria del catalogo lo tiene en 0. La regla anterior era
 * `stock >= max_stock`, que con maximo 0 es verdadera en cuanto hay una unidad:
 * casi todo el catalogo decia «Stock alto» y la columna se volvia decorativa.
 */
export function resolveStockLevel(product: StockLevelInput): StockLevel {
  const stock = Number(product.stock_quantity ?? 0)
  const min = Number(product.min_stock ?? 0)
  const rawMax = Number(product.max_stock ?? 0)
  const max = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : null

  if (stock <= 0) return 'out'
  if (stock <= min) return 'low'
  if (max !== null && stock >= max) return 'high'
  return 'normal'
}

export function matchesStockLevel(product: StockLevelInput, wanted: StockLevel | 'all'): boolean {
  if (wanted === 'all') return true
  return resolveStockLevel(product) === wanted
}

export interface InventoryStatsInput extends StockLevelInput {
  purchase_price?: number | null
  sale_price?: number | null
}

export interface InventoryStats {
  totalProducts: number
  outOfStock: number
  lowStock: number
  /** Valor del inventario a precio de costo. */
  stockCostValue: number
  /**
   * Margen ponderado por el valor de venta del stock, no promedio simple: un
   * accesorio de 15.000 Gs no pesa lo mismo que un celular de 4.000.000.
   * `null` cuando no hay stock valorizado del cual sacar un margen.
   */
  weightedMargin: number | null
  /** Unidades totales en existencia. */
  totalUnits: number
}

export function calculateInventoryStats(products: InventoryStatsInput[]): InventoryStats {
  let outOfStock = 0
  let lowStock = 0
  let stockCostValue = 0
  let stockSaleValue = 0
  let totalUnits = 0

  for (const product of products) {
    const level = resolveStockLevel(product)
    if (level === 'out') outOfStock += 1
    if (level === 'low') lowStock += 1

    const stock = Math.max(0, Number(product.stock_quantity ?? 0))
    const cost = Math.max(0, Number(product.purchase_price ?? 0))
    const sale = Math.max(0, Number(product.sale_price ?? 0))

    totalUnits += stock
    stockCostValue += stock * cost
    stockSaleValue += stock * sale
  }

  return {
    totalProducts: products.length,
    outOfStock,
    lowStock,
    stockCostValue,
    weightedMargin: stockSaleValue > 0
      ? ((stockSaleValue - stockCostValue) / stockSaleValue) * 100
      : null,
    totalUnits,
  }
}
