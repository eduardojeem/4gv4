/**
 * Cálculo de costo y ganancia del dashboard del POS.
 *
 * Vive aparte del hook para poder probarlo: el bug que motivó este archivo
 * (la consulta pedía `cost_price`, una columna que no existe, y el costo
 * quedaba en cero) sobrevivió porque no habia nada que ejercitara la formula.
 */

/** Fila de sale_items con su producto embebido, tal como llega de Supabase. */
export type SaleItemRow = {
  quantity?: number | string | null
  subtotal?: number | string | null
  product?: {
    name?: string | null
    /** Costo del producto. La columna real es purchase_price, no cost_price. */
    purchase_price?: number | string | null
  } | null
}

export type ProductAggregate = {
  name: string
  sales: number
  revenue: number
}

export type SalesCostBreakdown = {
  totalCost: number
  products: ProductAggregate[]
  /** Ítems cuyo producto no tiene costo cargado: el costo real es mayor. */
  itemsWithoutCost: number
}

function toNumber(value: unknown): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

/** Suma el costo de mercadería y agrega las ventas por producto. */
export function calculateSalesCost(items: SaleItemRow[] | null | undefined): SalesCostBreakdown {
  const productMap = new Map<string, ProductAggregate>()
  let totalCost = 0
  let itemsWithoutCost = 0

  for (const item of items ?? []) {
    const name = item?.product?.name || 'Producto eliminado'
    const quantity = toNumber(item?.quantity)
    const subtotal = toNumber(item?.subtotal)
    const rawCost = item?.product?.purchase_price

    // Un producto sin costo cargado no es costo cero: se cuenta aparte para
    // poder avisar que el margen mostrado es optimista.
    if (rawCost === null || rawCost === undefined || toNumber(rawCost) <= 0) {
      itemsWithoutCost += 1
    }

    totalCost += toNumber(rawCost) * quantity

    const current = productMap.get(name) ?? { name, sales: 0, revenue: 0 }
    productMap.set(name, {
      name,
      sales: current.sales + quantity,
      revenue: current.revenue + subtotal,
    })
  }

  return {
    totalCost,
    products: [...productMap.values()].sort((a, b) => b.sales - a.sales),
    itemsWithoutCost,
  }
}

export type ProfitInput = {
  totalSales: number
  totalCost: number
  repairDeliveredAmount: number
  /** true cuando no se pudo traer el costo: no se puede afirmar ganancia. */
  costUnavailable?: boolean
}

export type ProfitResult = {
  totalCost: number
  salesProfit: number
  repairProfit: number
  totalProfit: number
  profitMargin: number
  costUnavailable: boolean
}

/**
 * Margen bruto del período.
 *
 * Dos decisiones explicitas:
 *
 * - Si el costo no se pudo obtener, no se devuelve una ganancia igual a la
 *   facturacion: se marca como no disponible para que la UI lo diga en vez de
 *   mostrar un numero inventado.
 * - Una perdida se devuelve negativa. Recortarla a cero hacia que un periodo
 *   con perdida se viera igual que uno sin actividad.
 *
 * Sigue siendo margen BRUTO: no resta gastos operativos ni separa el IVA.
 */
export function calculateProfit(input: ProfitInput): ProfitResult {
  const totalSales = toNumber(input.totalSales)
  const repairProfit = toNumber(input.repairDeliveredAmount)
  const costUnavailable = Boolean(input.costUnavailable)
  const totalCost = costUnavailable ? 0 : toNumber(input.totalCost)

  if (costUnavailable) {
    return {
      totalCost: 0,
      salesProfit: 0,
      repairProfit,
      totalProfit: 0,
      profitMargin: 0,
      costUnavailable: true,
    }
  }

  const salesProfit = totalSales - totalCost

  return {
    totalCost,
    salesProfit,
    repairProfit,
    totalProfit: salesProfit + repairProfit,
    profitMargin: totalSales > 0 ? (salesProfit / totalSales) * 100 : 0,
    costUnavailable: false,
  }
}
