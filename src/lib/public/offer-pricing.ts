import { resolvePublicUnitPrice } from '@/lib/orders/public-pricing'

export function resolveOfferPrice(basePrice: number, offerPrice: number | null | undefined, variantPrice: number) {
  if (variantPrice <= 0) return 0
  if (offerPrice == null || basePrice <= 0 || offerPrice >= basePrice) return variantPrice
  const discountRatio = offerPrice / basePrice
  const calculated = Math.round(variantPrice * discountRatio)
  return calculated > 0 && calculated < variantPrice ? calculated : variantPrice
}

type OfferPricedProduct = {
  sale_price: number
  offer_price?: number | null
  has_offer?: boolean | null
  wholesale_price?: number | null
}

type OfferPricedVariant = {
  sale_price: number
  offer_price?: number | null
  wholesale_price?: number | null
}

/**
 * Precio publico de un producto o de una de sus variantes.
 *
 * La vitrina, el detalle y el cobro calculaban distinto: la tarjeta aplicaba el
 * porcentaje de la oferta al precio de la variante y el checkout usaba el precio
 * de oferta del producto padre. Con variantes de distinto precio el cliente veia
 * un precio en la tarjeta, otro en el detalle, y al confirmar le avisaban que
 * «cambio el precio». La regla vive aca y la usan los tres.
 *
 * La oferta del producto se aplica como porcentaje: una variante mas cara baja
 * lo mismo en proporcion, no al precio del producto base. El precio mayorista
 * sigue ganando sobre la oferta, como en el resto de la tienda.
 */
export function resolvePublicVariantPrice({ isWholesale, product, variant }: {
  isWholesale: boolean
  product: OfferPricedProduct
  variant?: OfferPricedVariant | null
}): number {
  const productSalePrice = Number(product.sale_price || 0)
  const salePrice = variant ? Number(variant.sale_price || 0) : productSalePrice
  // `has_offer` en false apaga la oferta aunque haya quedado un precio cargado.
  const offerEnabled = product.has_offer !== false
  const productOfferPrice = offerEnabled ? product.offer_price ?? null : null

  const offerPrice = variant
    ? (variant.offer_price != null && variant.offer_price < salePrice
        ? variant.offer_price
        : resolveOfferPrice(productSalePrice, productOfferPrice, salePrice))
    : productOfferPrice

  return resolvePublicUnitPrice({
    isWholesale,
    wholesalePrice: variant?.wholesale_price ?? product.wholesale_price ?? null,
    salePrice,
    hasOffer: offerPrice != null && offerPrice < salePrice,
    offerPrice,
  })
}
