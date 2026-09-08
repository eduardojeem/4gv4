type ErrorLike = {
  message?: string | null
  code?: string | null
  details?: string | null
  hint?: string | null
} | null

type InventoryRow = {
  product_id: string
  stock_quantity: number | null
  /** NULL usa el umbral del producto. Ver migracion 20260907130000. */
  min_stock?: number | null
  max_stock?: number | null
  reserved_quantity?: number | null
}

export interface BranchStockEntry {
  stock: number
  minStock: number | null
  maxStock: number | null
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
  /**
   * Umbrales propios de la sucursal. Un minimo de 50 pensado para el deposito
   * central dejaba al kiosco en «Stock bajo» permanente.
   */
  thresholdMap: Map<string, { minStock: number | null; maxStock: number | null }>
  /**
   * Unidades comprometidas por pedidos. La columna existia desde la migracion
   * de multi-sucursal y no la leia nadie: la pantalla mostraba stock fisico
   * donde el usuario lee «disponible».
   */
  reservedMap: Map<string, number>
  branchScoped: boolean
  /**
   * Se pidio el stock de una sucursal y no se pudo leer. Distinto de
   * `branchScoped: false`, que tambien es lo que se devuelve cuando no hay
   * ninguna sucursal seleccionada: sin esta marca, un fallo de RLS o de red
   * quedaba indistinguible de "esta pantalla es global" y se pintaba el stock
   * global bajo un cartel que decia el nombre de la sucursal.
   */
  failed: boolean
  error: string | null
}

export function formatBranchInventoryError(error: ErrorLike) {
  if (!error) return 'No se pudo sincronizar el stock por sucursal.'

  const message = `${error.message || 'No se pudo sincronizar el stock por sucursal.'}${error.code ? ` (${error.code})` : ''}`

  return [
    message,
    error.details,
    error.hint,
  ].filter(Boolean).join(' - ')
}

export async function loadBranchInventoryStockMap(
  supabase: BranchInventoryClient,
  branchId?: string | null,
  productIds?: string[]
): Promise<BranchInventoryMapResult> {
  if (!branchId) {
    return {
      stockMap: new Map(),
      thresholdMap: new Map(),
      reservedMap: new Map(),
      branchScoped: false,
      failed: false,
      error: null,
    }
  }

  try {
    const baseQuery = supabase
      .from('branch_inventory')
      .select('product_id, stock_quantity, min_stock, max_stock, reserved_quantity')

    const query = baseQuery.eq('branch_id', branchId)
    const response = productIds && productIds.length > 0 && typeof query.in === 'function'
      ? await query.in('product_id', productIds)
      : await query

    if (response.error) {
      throw new Error(formatBranchInventoryError(response.error))
    }

    const rows = (response.data ?? []) as InventoryRow[]
    return {
      stockMap: new Map(rows.map((row) => [row.product_id, Number(row.stock_quantity || 0)])),
      thresholdMap: new Map(rows.map((row) => [row.product_id, {
        minStock: row.min_stock === null || row.min_stock === undefined ? null : Number(row.min_stock),
        maxStock: row.max_stock === null || row.max_stock === undefined ? null : Number(row.max_stock),
      }])),
      reservedMap: new Map(rows.map((row) => [row.product_id, Number(row.reserved_quantity || 0)])),
      branchScoped: true,
      failed: false,
      error: null,
    }
  } catch (error) {
    // No se cae al stock global en silencio: quien llama decide si corta o si
    // avisa, pero nadie muestra el numero equivocado sin saberlo.
    const message = error instanceof Error
      ? error.message
      : 'No se pudo cargar el stock por sucursal.'
    console.warn('[branches/inventory] Branch stock read failed:', message)
    return {
      stockMap: new Map(),
      thresholdMap: new Map(),
      reservedMap: new Map(),
      branchScoped: false,
      failed: true,
      error: message,
    }
  }
}

export function applyBranchInventoryToProducts<T extends { id: string; stock_quantity?: number | null }>(
  products: T[],
  stockMap: Map<string, number>,
  branchScoped: boolean,
  thresholdMap?: Map<string, { minStock: number | null; maxStock: number | null }>
): Array<T & { branch_stock_quantity?: number }> {
  return products.map((product) => {
    if (stockMap.has(product.id)) {
      const branchStock = Number(stockMap.get(product.id) || 0)
      // El umbral de la sucursal solo pisa al del producto cuando esta
      // configurado: NULL significa «usar el del producto».
      const thresholds = thresholdMap?.get(product.id)
      return {
        ...product,
        stock_quantity: branchStock,
        branch_stock_quantity: branchStock,
        ...(thresholds?.minStock !== null && thresholds?.minStock !== undefined
          ? { min_stock: thresholds.minStock }
          : {}),
        ...(thresholds?.maxStock !== null && thresholds?.maxStock !== undefined
          ? { max_stock: thresholds.maxStock }
          : {}),
      }
    }

    if (branchScoped) {
      // A catalog product without a row in the selected branch has no stock there.
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
    throw new Error(formatBranchInventoryError(response.error))
  }

  return { applied: true }
}
