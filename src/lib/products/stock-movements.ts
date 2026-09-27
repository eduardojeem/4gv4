/**
 * Todo cambio de stock deja su renglón en el historial.
 *
 * La edición desde el listado escribía `products.stock_quantity` directo, sin
 * pasar por `product_movements`. Cuando un producto aparecía en cero no había
 * forma de saber quién lo dejó así: en treinta días no hay ni un movimiento que
 * haya llevado un stock a cero, y sin embargo hay productos en cero. La ficha
 * del producto sí lo registraba; el listado, no.
 */

export type MovementClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
  }
}

export type StockAdjustment = {
  organizationId: string
  productId: string
  branchId?: string | null
  previousStock: number
  nextStock: number
  userId?: string | null
  /** De dónde salió el cambio, para poder reconstruirlo después. */
  notes?: string
}

/**
 * Registra el ajuste. Devuelve `false` si no había nada que registrar (el stock
 * no cambió) y lanza sólo si la inserción falla, para que quien llama decida:
 * el stock ya se guardó, pero un hueco en la trazabilidad no se recupera.
 */
export async function recordStockAdjustment(
  client: MovementClient,
  ajuste: StockAdjustment,
): Promise<boolean> {
  const anterior = Number(ajuste.previousStock ?? 0)
  const nuevo = Number(ajuste.nextStock ?? 0)
  if (!Number.isFinite(anterior) || !Number.isFinite(nuevo) || anterior === nuevo) return false

  const { error } = await client.from('product_movements').insert({
    organization_id: ajuste.organizationId,
    product_id: ajuste.productId,
    branch_id: ajuste.branchId ?? null,
    movement_type: 'adjustment',
    quantity: Math.abs(nuevo - anterior),
    previous_stock: anterior,
    new_stock: nuevo,
    notes: ajuste.notes ?? 'Ajuste desde la edición del producto',
    user_id: ajuste.userId ?? null,
  })

  if (error) throw new Error(error.message)
  return true
}
