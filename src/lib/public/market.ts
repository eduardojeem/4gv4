import type { PublicProduct } from '@/types/public'

const PER_UNIT = /^(u|un|und|unid|unidad|unidades|pza|pieza|piezas)\.?$/i

/**
 * «Precio por kg», «Precio por litro»: en un súper el precio sin la unidad no
 * dice nada. Lo que se vende por unidad no lleva aclaración.
 */
export function marketUnitLabel(unitMeasure: string | null | undefined): string | null {
  const unit = unitMeasure?.trim()
  if (!unit || PER_UNIT.test(unit)) return null
  return `Precio por ${unit.toLowerCase()}`
}

/** Porcentaje de descuento redondeado, o 0 si no hay oferta real. */
export function productDiscountPct(product: Pick<PublicProduct, 'sale_price' | 'offer_price' | 'has_offer'>): number {
  const sale = Number(product.sale_price) || 0
  const offer = Number(product.offer_price) || 0
  if (!product.has_offer || offer <= 0 || sale <= 0 || offer >= sale) return 0
  return Math.round(((sale - offer) / sale) * 100)
}

export const MARKET_DISCOUNT_TIERS = [10, 20, 30, 40, 50] as const

export interface MarketDiscountTier {
  /** Descuento mínimo del escalón («20% o más»). */
  min: number
  count: number
}

/**
 * Los escalones de «Descuentos» que tienen productos, como en los súper
 * («20% OFF», «30% OFF»…). Cada escalón incluye los descuentos mayores: así un
 * cliente que busca «al menos 30%» ve todo lo que le sirve.
 */
export function marketDiscountTiers(products: Array<Pick<PublicProduct, 'sale_price' | 'offer_price' | 'has_offer'>>): MarketDiscountTier[] {
  const discounts = products.map(productDiscountPct).filter((pct) => pct > 0)
  return MARKET_DISCOUNT_TIERS
    .map((min) => ({ min, count: discounts.filter((pct) => pct >= min).length }))
    .filter((tier) => tier.count > 0)
}
