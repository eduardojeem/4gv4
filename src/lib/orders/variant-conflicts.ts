/**
 * Lineas del carrito que no se pueden comprar como estan porque les falta la
 * variante, o traen una que ya no existe o es de otro producto.
 *
 * El pedido las rechazaba con un error generico: el cliente veia «Elegí
 * nuevamente la variante del producto» y no sabia cual de todas arreglar, ni
 * podia seguir. Devolverlas una por una deja que el carrito las saque y diga
 * que hacer.
 */

export type CartLineRequest = {
  productId: string
  variantId: string | null
}

export type VariantConflict = {
  productId: string
  variantId: string | null
  productName: string
  reason: 'MISSING_VARIANT' | 'UNKNOWN_VARIANT'
}

export function findVariantConflicts(
  items: ReadonlyArray<CartLineRequest>,
  products: ReadonlyMap<string, { name?: unknown; has_variants?: unknown }>,
  variants: ReadonlyMap<string, { product_id?: unknown }>,
): VariantConflict[] {
  return items.flatMap((item): VariantConflict[] => {
    const product = products.get(item.productId)
    if (!product) return []

    const productName = typeof product.name === 'string' && product.name.trim() ? product.name : 'un producto'
    const missingVariant = Boolean(product.has_variants) && !item.variantId

    if (missingVariant) {
      return [{ productId: item.productId, variantId: item.variantId, productName, reason: 'MISSING_VARIANT' }]
    }

    if (!item.variantId) return []

    const variant = variants.get(item.variantId)
    if (variant && String(variant.product_id) === item.productId) return []

    return [{ productId: item.productId, variantId: item.variantId, productName, reason: 'UNKNOWN_VARIANT' }]
  })
}
