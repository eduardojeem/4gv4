/**
 * Precio unitario de cara al público.
 *
 * El catálogo mostraba un precio y el checkout recalculaba otro: al mayorista
 * se le exhibía su precio y se le facturaba el minorista. La regla vive acá para
 * que la vitrina y el cobro no puedan volver a separarse.
 */

export type PublicPriceInput = {
  isWholesale: boolean
  /** Solo se resuelve para clientes mayoristas; null si el producto no tiene. */
  wholesalePrice: number | null
  salePrice: number
  hasOffer: boolean
  offerPrice: number | null
}

/**
 * El precio mayorista gana sobre las ofertas minoristas: son dos esquemas de
 * descuento distintos y acumularlos regalaría margen. Una oferta solo aplica si
 * efectivamente baja del precio de lista.
 */
export function resolvePublicUnitPrice(input: PublicPriceInput): number {
  const salePrice = toPositiveNumber(input.salePrice)

  if (input.isWholesale) {
    const wholesalePrice = toPositiveNumber(input.wholesalePrice)
    if (wholesalePrice !== null) return wholesalePrice
    return salePrice ?? 0
  }

  const offerPrice = toPositiveNumber(input.offerPrice)
  if (input.hasOffer && offerPrice !== null && (salePrice === null || offerPrice < salePrice)) {
    return offerPrice
  }

  return salePrice ?? 0
}

function toPositiveNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}
