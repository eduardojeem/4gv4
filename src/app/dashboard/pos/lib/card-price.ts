import type { Product } from '@/types/product-unified'
import { getActiveOfferPrice, WHOLESALE_DISCOUNT_RATE } from './cart-pricing'

export type ProductCardPrice = {
  /** Lo que se cobra al agregarlo (o el más bajo de sus variantes). */
  price: number
  /** Precio de lista tachado, cuando hay oferta o mayorista que lo baja. */
  listPrice: number | null
  /** Es el mínimo entre variantes de distinto precio: se muestra «Desde». */
  fromVariants: boolean
  isOffer: boolean
}

type VariantPriceFields = {
  is_active?: boolean | null
  isActive?: boolean | null
  sale_price?: number | null
  salePrice?: number | null
  wholesale_price?: number | null
  wholesalePrice?: number | null
}

function positive(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

/**
 * Precio que muestra la tarjeta del POS, con la misma regla que el carrito
 * (`priceCartLine` / `getActiveOfferPrice`).
 *
 * Antes la tarjeta mostraba siempre `sale_price` del producto: con oferta se
 * veía el precio de lista y se cobraba el de oferta, y en un producto con
 * variantes de distinto precio se veía el del padre en vez del de la variante.
 */
export function resolveProductCardPrice(
  product: Product,
  options: { isWholesale: boolean; wholesaleDiscountRate?: number },
): ProductCardPrice {
  const rate = options.wholesaleDiscountRate ?? WHOLESALE_DISCOUNT_RATE
  const listPrice = positive(product.sale_price) ?? 0

  const priceOf = (sale: number, wholesale: number | null, variantPrice?: number): { price: number; list: number; offer: boolean } => {
    if (options.isWholesale) {
      const price = wholesale ?? Math.round(sale * (1 - rate / 100))
      return { price, list: sale, offer: false }
    }
    // En mayorista la oferta minorista no aplica; en minorista, sí.
    const offer = getActiveOfferPrice(product, variantPrice)
    return offer !== null && offer > 0 && offer < sale
      ? { price: offer, list: sale, offer: true }
      : { price: sale, list: sale, offer: false }
  }

  const variants = (Array.isArray(product.variants) ? product.variants : []) as VariantPriceFields[]
  const pricedVariants = variants
    .filter((variant) => variant.is_active !== false && variant.isActive !== false)
    .map((variant) => {
      const sale = positive(variant.sale_price ?? variant.salePrice) ?? listPrice
      const wholesale = positive(variant.wholesale_price ?? variant.wholesalePrice) ?? positive(product.wholesale_price)
      return priceOf(sale, wholesale, sale)
    })
    .filter((candidate) => candidate.price > 0)

  if (product.has_variants && pricedVariants.length > 0) {
    const cheapest = pricedVariants.reduce((min, candidate) => (candidate.price < min.price ? candidate : min))
    const fromVariants = new Set(pricedVariants.map((candidate) => candidate.price)).size > 1
    return {
      price: cheapest.price,
      listPrice: cheapest.list > cheapest.price ? cheapest.list : null,
      fromVariants,
      isOffer: cheapest.offer,
    }
  }

  const simple = priceOf(listPrice, positive(product.wholesale_price))
  return {
    price: simple.price,
    listPrice: simple.list > simple.price ? simple.list : null,
    fromVariants: false,
    isOffer: simple.offer,
  }
}
