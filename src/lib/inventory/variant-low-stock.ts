export type StockStatus = 'out_of_stock' | 'low_stock' | 'in_stock'

export type VariantStockInput = {
  id: string
  organization_id?: string | null
  stock_quantity?: number | null
  min_stock?: number | null
  is_active?: boolean | null
}

export type VariantBranchInventoryInput = {
  organization_id: string
  branch_id: string
  variant_id: string
  stock_quantity?: number | null
  min_stock?: number | null
}

export type VariantStockDetail = {
  status: StockStatus
  currentStock: number
  minimumStock: number
  branchStatuses: Array<{ branchId: string; status: StockStatus; currentStock: number; minimumStock: number }>
}

export type VariantStockSummary = {
  variantCount: number
  outOfStockVariantCount: number
  lowStockVariantCount: number
  affectedVariantCount: number
  totalStock: number
}

export type ProductStockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'

export function matchesProductStockFilter(input: {
  filter: ProductStockFilter
  stock: number
  minimumStock: number
  variantSummary?: VariantStockSummary | null
}) {
  if (input.filter === 'all') return true
  const summary = input.variantSummary
  if (summary) {
    if (summary.variantCount === 0) return false
    if (input.filter === 'in_stock') return summary.totalStock > 0
    if (input.filter === 'out_of_stock') return summary.totalStock <= 0
    return summary.affectedVariantCount > 0
  }
  if (input.filter === 'in_stock') return input.stock > 0
  if (input.filter === 'out_of_stock') return input.stock <= 0
  return input.stock > 0 && input.stock <= input.minimumStock
}

export function classifyStock(currentStock: number, minimumStock: number): StockStatus {
  if (currentStock <= 0) return 'out_of_stock'
  if (currentStock <= minimumStock) return 'low_stock'
  return 'in_stock'
}

/**
 * Classifies active variants at branch granularity before building the product
 * summary. A missing row in a selected branch means zero stock; a missing row
 * in the all-branches view is not treated as an additional branch alert.
 */
export function summarizeVariantStock(input: {
  organizationId: string
  variants: VariantStockInput[]
  inventory: VariantBranchInventoryInput[]
  branchId?: string | null
  accessibleBranchIds?: string[]
}) {
  const activeVariants = input.variants.filter((variant) =>
    variant.is_active !== false && (!variant.organization_id || variant.organization_id === input.organizationId)
  )
  const accessible = new Set(input.accessibleBranchIds ?? [])
  const details = new Map<string, VariantStockDetail>()

  for (const variant of activeVariants) {
    const globalStock = finiteNonNegative(variant.stock_quantity)
    const globalMinimum = finiteNonNegative(variant.min_stock)
    const rows = input.inventory.filter((row) =>
      row.organization_id === input.organizationId &&
      row.variant_id === variant.id &&
      (input.branchId ? row.branch_id === input.branchId : accessible.has(row.branch_id))
    )

    if (input.branchId) {
      const row = rows.find((candidate) => candidate.branch_id === input.branchId)
      const currentStock = row ? finiteNonNegative(row.stock_quantity) : 0
      const minimumStock = row ? finiteNonNegative(row.min_stock) : globalMinimum
      const status = classifyStock(currentStock, minimumStock)
      details.set(variant.id, { status, currentStock, minimumStock, branchStatuses: [{ branchId: input.branchId, status, currentStock, minimumStock }] })
      continue
    }

    if (!rows.length) {
      details.set(variant.id, {
        status: classifyStock(globalStock, globalMinimum),
        currentStock: globalStock,
        minimumStock: globalMinimum,
        branchStatuses: [],
      })
      continue
    }

    const branchStatuses = rows.map((row) => {
      const currentStock = finiteNonNegative(row.stock_quantity)
      const minimumStock = finiteNonNegative(row.min_stock)
      return { branchId: row.branch_id, status: classifyStock(currentStock, minimumStock), currentStock, minimumStock }
    })
    const status = branchStatuses.some((row) => row.status === 'out_of_stock')
      ? 'out_of_stock'
      : branchStatuses.some((row) => row.status === 'low_stock')
        ? 'low_stock'
        : 'in_stock'
    details.set(variant.id, { status, currentStock: globalStock, minimumStock: globalMinimum, branchStatuses })
  }

  const outOfStockVariantCount = [...details.values()].filter((detail) => detail.branchStatuses.some((row) => row.status === 'out_of_stock') || (!detail.branchStatuses.length && detail.status === 'out_of_stock')).length
  const lowStockVariantCount = [...details.values()].filter((detail) => detail.branchStatuses.some((row) => row.status === 'low_stock') || (!detail.branchStatuses.length && detail.status === 'low_stock')).length
  const summary: VariantStockSummary = {
    variantCount: activeVariants.length,
    outOfStockVariantCount,
    lowStockVariantCount,
    affectedVariantCount: [...details.values()].filter((detail) => detail.status !== 'in_stock' || detail.branchStatuses.some((row) => row.status !== 'in_stock')).length,
    totalStock: input.branchId
      ? [...details.values()].reduce((total, detail) => total + detail.currentStock, 0)
      : activeVariants.reduce((total, variant) => total + finiteNonNegative(variant.stock_quantity), 0),
  }

  return { summary, details }
}

function finiteNonNegative(value: number | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}
