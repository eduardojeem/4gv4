import { applyAutomaticPromotionToProduct, type PublicPromotion } from '@/lib/public-promotions'
import { resolvePublicVariantPrice } from '@/lib/public/offer-pricing'

export type PublicCatalogSummary = {
  stockQuantity: number
  price: number | null
  originalPrice: number | null
  priceFrom: boolean
  hasOffer: boolean
  representativeVariantId: string | null
  promotionName: string | null
}

export type CatalogProductInput = {
  id: string
  category_id?: string | null
  sale_price: number
  stock_quantity: number
  has_variants?: boolean
  has_offer?: boolean | null
  offer_price?: number | null
  hide_price?: boolean | null
}

export type CatalogVariantInput = {
  id: string
  sale_price: number
  stock_quantity: number
  is_active: boolean
  offer_price?: number | null
}

export function summarizeCatalogProduct(
  product: CatalogProductInput,
  variants: CatalogVariantInput[],
  promotions: PublicPromotion[],
  options: { onlyOffers?: boolean; now: Date },
): PublicCatalogSummary | null {
  const positiveStock = (stock: number) => Number.isFinite(stock) && stock > 0 ? stock : 0
  const usesVariants = Boolean(product.has_variants) || variants.length > 0
  const availableVariants = variants.filter((variant) => variant.is_active && positiveStock(variant.stock_quantity) > 0)
  const stockQuantity = usesVariants
    ? availableVariants.reduce((sum, variant) => sum + positiveStock(variant.stock_quantity), 0)
    : positiveStock(product.stock_quantity)
  if (stockQuantity <= 0) return null

  // A minimum basket spend cannot be promised by a product-card price.
  const unconditionalPromotions = promotions.filter((promotion) => !promotion.min_purchase || promotion.min_purchase <= 0)
  const priced = applyAutomaticPromotionToProduct(product, unconditionalPromotions, options.now)
  const availableOptions = usesVariants ? availableVariants : [null]
  const candidates = availableOptions.map((variant) => {
    const basePrice = variant?.sale_price ?? product.sale_price
    const price = resolvePublicVariantPrice({ isWholesale: false, product: priced, variant })
    return { variant, price, basePrice, hasOffer: price > 0 && price < basePrice }
  }).filter((candidate) => !options.onlyOffers || candidate.hasOffer)
  if (candidates.length === 0) return null

  // Stable representative when two options have the same effective price.
  candidates.sort((a, b) => a.price - b.price || (a.variant?.id ?? '').localeCompare(b.variant?.id ?? ''))
  const representative = candidates[0]
  const variantOffer = representative.variant?.offer_price
  const usesOwnVariantOffer = variantOffer != null && variantOffer > 0 && variantOffer < representative.basePrice
  if (product.hide_price) {
    return { stockQuantity, price: null, originalPrice: null, priceFrom: false,
      hasOffer: false, representativeVariantId: null, promotionName: null }
  }
  return {
    stockQuantity,
    price: representative.price,
    originalPrice: representative.hasOffer ? representative.basePrice : null,
    priceFrom: candidates.some((candidate) => candidate.price !== representative.price),
    hasOffer: representative.hasOffer,
    representativeVariantId: representative.variant?.id ?? null,
    promotionName: representative.hasOffer && !usesOwnVariantOffer ? priced.promotion_name : null,
  }
}
