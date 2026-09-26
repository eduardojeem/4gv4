/**
 * Ofertas del marketplace: una sola cuenta para saber si un producto está en
 * oferta, cuánto se ahorra y en qué orden mostrarlas.
 *
 * Antes cada pantalla repetía `has_offer && offer_price < sale_price` y el
 * porcentaje por su lado, y /marketplace/productos sacaba las ofertas solo de
 * los primeros 120 productos del catálogo: las demás no aparecían.
 */

type OfferFields = {
  has_offer?: boolean | null
  offer_price?: number | null
  sale_price: number
}

export type OfferPricing = {
  hasOffer: boolean
  /** Lo que paga el cliente. */
  price: number
  /** Precio sin oferta; igual a `price` si no hay oferta. */
  regularPrice: number
  savings: number
  percent: number
}

export function getOfferPricing(product: OfferFields): OfferPricing {
  const regularPrice = Number(product.sale_price) || 0
  const offerPrice = product.offer_price == null ? null : Number(product.offer_price)
  const hasOffer = Boolean(
    product.has_offer && offerPrice != null && offerPrice > 0 && offerPrice < regularPrice
  )
  if (!hasOffer || offerPrice == null) {
    return { hasOffer: false, price: regularPrice, regularPrice, savings: 0, percent: 0 }
  }
  return {
    hasOffer: true,
    price: offerPrice,
    regularPrice,
    savings: regularPrice - offerPrice,
    percent: Math.round((1 - offerPrice / regularPrice) * 100),
  }
}

export function isOnOffer(product: OfferFields): boolean {
  return getOfferPricing(product).hasOffer
}

/** Mayor descuento primero; a igual porcentaje, el que más ahorra. */
export function sortOffersByDiscount<T extends OfferFields>(products: T[]): T[] {
  return products
    .filter(isOnOffer)
    .map((product) => ({ product, pricing: getOfferPricing(product) }))
    .sort((a, b) => b.pricing.percent - a.pricing.percent || b.pricing.savings - a.pricing.savings)
    .map(({ product }) => product)
}

type Keyed = { id: string; organization_slug: string }

const keyOf = (product: Keyed) => `${product.organization_slug}-${product.id}`

/**
 * Suma al catálogo las ofertas que no vinieron en la página cargada, sin
 * duplicar. Así el filtro «Ofertas» del catálogo alcanza a todas.
 */
export function mergeOffersIntoCatalog<T extends Keyed>(catalog: T[], offers: T[]): T[] {
  const seen = new Set(catalog.map(keyOf))
  const extra = offers.filter((offer) => !seen.has(keyOf(offer)))
  return extra.length > 0 ? [...catalog, ...extra] : catalog
}
