type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}

export type OrderStockItem = {
  product_id: string | null
  product_name?: string | null
  quantity: number
}

type ReservedStockItem = {
  productId: string
  quantity: number
  productName?: string | null
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message)
  return 'Error desconocido.'
}

function aggregateStockItems(items: OrderStockItem[]): ReservedStockItem[] {
  const byProduct = new Map<string, ReservedStockItem>()

  for (const item of items) {
    if (!item.product_id) continue
    const quantity = Number(item.quantity || 0)
    if (!Number.isFinite(quantity) || quantity <= 0) continue

    const existing = byProduct.get(item.product_id)
    if (existing) {
      existing.quantity += quantity
    } else {
      byProduct.set(item.product_id, {
        productId: item.product_id,
        productName: item.product_name,
        quantity,
      })
    }
  }

  return Array.from(byProduct.values())
}

export async function reserveOrderStock(
  supabase: SupabaseLike,
  organizationId: string,
  items: OrderStockItem[]
) {
  const reserved: ReservedStockItem[] = []

  for (const item of aggregateStockItems(items)) {
    const { data, error } = await supabase.rpc('decrement_product_stock', {
      p_product_id: item.productId,
      p_organization_id: organizationId,
      p_quantity: item.quantity,
    })

    if (error || data !== true) {
      await releaseReservedStock(supabase, organizationId, reserved.map((item) => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
      })))
      return {
        success: false as const,
        error: error
          ? getErrorMessage(error)
          : `Stock insuficiente para "${item.productName || 'Producto'}".`,
      }
    }

    reserved.push(item)
  }

  return { success: true as const, reserved }
}

export async function releaseReservedStock(
  supabase: SupabaseLike,
  organizationId: string,
  items: OrderStockItem[]
) {
  for (const item of aggregateStockItems(items)) {
    const { error } = await supabase.rpc('increment_product_stock', {
      p_product_id: item.productId,
      p_organization_id: organizationId,
      p_quantity: item.quantity,
    })

    if (error) {
      throw new Error(getErrorMessage(error))
    }
  }
}
