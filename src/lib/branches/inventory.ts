type ErrorLike = { message?: string | null } | null

type InventoryRow = {
  product_id: string
  stock_quantity: number | null
}

type QueryResult<T> = PromiseLike<{ data: T[] | null; error: ErrorLike }>

type BranchInventoryQuery<T> = QueryResult<T> & {
  eq: (field: string, value: string) => BranchInventoryQuery<T>
  in?: (field: string, values: string[]) => QueryResult<T>
}

export type BranchInventoryClient = {
  from: (table: string) => {
    select: (columns: string) => BranchInventoryQuery<InventoryRow>
    upsert?: (
      values: Record<string, unknown>,
      options?: { onConflict?: string }
    ) => PromiseLike<{ error: ErrorLike }>
  }
}

export interface BranchInventoryMapResult {
  stockMap: Map<string, number>
  branchScoped: boolean
}

export async function loadBranchInventoryStockMap(
  supabase: BranchInventoryClient,
  branchId?: string | null,
  productIds?: string[]
): Promise<BranchInventoryMapResult> {
  if (!branchId) {
    return { stockMap: new Map(), branchScoped: false }
  }

  try {
    const baseQuery = supabase
      .from('branch_inventory')
      .select('product_id, stock_quantity')

    const query = baseQuery.eq('branch_id', branchId)
    const response = productIds && productIds.length > 0 && typeof query.in === 'function'
      ? await query.in('product_id', productIds)
      : await query

    if (response.error) {
      throw new Error(response.error.message || 'No se pudo cargar el stock por sucursal.')
    }

    const rows = (response.data ?? []) as InventoryRow[]
    return {
      stockMap: new Map(rows.map((row) => [row.product_id, Number(row.stock_quantity || 0)])),
      branchScoped: true,
    }
  } catch (error) {
    console.warn('[branches/inventory] Falling back to global stock:', error)
    return { stockMap: new Map(), branchScoped: false }
  }
}

export function applyBranchInventoryToProducts<T extends { id: string; stock_quantity?: number | null }>(
  products: T[],
  stockMap: Map<string, number>,
  branchScoped: boolean
): Array<T & { branch_stock_quantity?: number }> {
  // If branch_inventory has no data at all, fall back to global stock
  // This handles the case where the table exists but hasn't been populated yet
  if (branchScoped && stockMap.size === 0) {
    return products.map((product) => ({ ...product }))
  }

  return products.map((product) => {
    if (stockMap.has(product.id)) {
      const branchStock = Number(stockMap.get(product.id) || 0)
      return {
        ...product,
        stock_quantity: branchStock,
        branch_stock_quantity: branchStock,
      }
    }

    if (branchScoped) {
      // Product exists in catalog but not in this branch's inventory → out of stock for this branch
      return {
        ...product,
        stock_quantity: 0,
        branch_stock_quantity: 0,
      }
    }

    return product
  })
}

export async function upsertBranchInventoryStock(params: {
  supabase: BranchInventoryClient
  branchId?: string | null
  productId: string
  stockQuantity: number
}) {
  const { supabase, branchId, productId, stockQuantity } = params
  if (!branchId) return { applied: false }

  const branchTable = supabase.from('branch_inventory')
  if (typeof branchTable.upsert !== 'function') {
    throw new Error('La tabla branch_inventory no soporta upsert en este cliente.')
  }

  const response = await branchTable.upsert(
    {
      branch_id: branchId,
      product_id: productId,
      stock_quantity: stockQuantity,
    },
    { onConflict: 'branch_id,product_id' }
  )

  if (response.error) {
    throw new Error(response.error.message || 'No se pudo sincronizar el stock por sucursal.')
  }

  return { applied: true }
}
