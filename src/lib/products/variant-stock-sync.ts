/**
 * Ajustes de stock que deja pendientes una edicion de variantes.
 *
 * El editor muestra el stock de cada variante, pero `save_product_with_variants`
 * no toca el stock de las que ya existen: el stock vive en el inventario por
 * sucursal y se mueve con movimientos trazables. Antes eso se traducia en un
 * campo editable que no hacia nada. Aca se calcula la diferencia para aplicarla
 * como un ajuste registrado.
 */

export type VariantStockAdjustment = {
  variantId: string
  variantName: string
  from: number
  to: number
  delta: number
  idempotencyKey: string
}

export function planVariantStockAdjustments(
  currentStockById: Map<string, number>,
  variants: Array<{ id?: string; name?: string; stockQuantity: number }>,
  now: Date = new Date(),
): VariantStockAdjustment[] {
  // Hasta el minuto: reintentar el mismo guardado no duplica el ajuste, pero un
  // cambio distinto sigue siendo un movimiento nuevo.
  const minute = now.toISOString().slice(0, 16)

  return variants.flatMap((variant) => {
    if (!variant.id || !currentStockById.has(variant.id)) return []
    const from = Number(currentStockById.get(variant.id) ?? 0)
    const to = Math.max(0, Number(variant.stockQuantity ?? 0))
    if (from === to) return []
    return [{
      variantId: variant.id,
      variantName: variant.name?.trim() || 'variante',
      from,
      to,
      delta: to - from,
      idempotencyKey: `variant-edit:${variant.id}:${from}:${to}:${minute}`,
    }]
  })
}
