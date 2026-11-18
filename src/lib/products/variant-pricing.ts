/**
 * Precio de una línea del POS con o sin variante.
 *
 * Es la misma regla que `public.pos_line_unit_price` en la base
 * (supabase/migrations/20261118120000_pos_variant_own_prices.sql). Si cambia
 * una, tiene que cambiar la otra: el servidor recalcula el total y rechaza el
 * cobro si no coincide con lo que vio el cajero.
 *
 * - Minorista: precio de venta de la variante; si es 0, el del producto.
 * - Mayorista: el precio mayorista de la variante; si no tiene, el del producto
 *   solo cuando la variante cuesta lo mismo que el producto (si cuesta otra cosa,
 *   heredar un mayorista pensado para otro precio podría venderla por debajo de
 *   lo previsto); si no, su precio de venta menos el 10%.
 */

export const VARIANT_WHOLESALE_FALLBACK_RATE = 10

type PriceSource = { sale_price?: unknown; wholesale_price?: unknown } | null | undefined

function positive(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function roundCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Precio de venta por unidad de la variante (o del producto si la variante no tiene). */
export function variantRetailPrice(product: PriceSource, variant: PriceSource): number {
  return positive(variant?.sale_price) ?? positive(product?.sale_price) ?? 0
}

/**
 * Precio mayorista explícito que corresponde a la línea, o null cuando se cobra
 * el precio de venta menos el 10% (lo resuelve quien calcula la línea).
 */
export function variantExplicitWholesale(product: PriceSource, variant: PriceSource): number | null {
  const own = positive(variant?.wholesale_price)
  if (own !== null) return own
  const productWholesale = positive(product?.wholesale_price)
  if (productWholesale === null) return null
  if (!variant) return productWholesale
  return variantRetailPrice(product, variant) === (positive(product?.sale_price) ?? 0) ? productWholesale : null
}

/** Precio unitario cobrado por la línea, como lo calcula el servidor. */
export function variantUnitPrice(product: PriceSource, variant: PriceSource, priceMode: 'retail' | 'wholesale'): number {
  const retail = variant ? variantRetailPrice(product, variant) : positive(product?.sale_price) ?? 0
  if (priceMode !== 'wholesale') return retail
  return variantExplicitWholesale(product, variant) ?? roundCents(retail * (1 - VARIANT_WHOLESALE_FALLBACK_RATE / 100))
}
