import type { ProductVariantInput } from './variant-contract'
import type { VariantPriceDefaults } from './variant-combinations'
import { variantSelectionKey } from './variant-bulk'

/**
 * Qué variantes siguen los precios del producto.
 *
 * Una variante sigue un precio del producto (venta, mayorista o costo) si, la
 * primera vez que el editor la ve, tiene el mismo valor que el producto. Cuando
 * el producto cambia ese precio, las variantes que lo siguen toman el nuevo. Si
 * alguien edita ese precio en la variante, deja de seguirlo.
 *
 * Se guarda como vínculo y no se compara valor contra valor: mientras se tipea
 * el precio del producto pasa por valores intermedios (1, 15, 150…) y una
 * comparación arrastraría variantes que coinciden por casualidad.
 */
export type PriceLinks = { seen: Set<string>; sale: Set<string>; wholesale: Set<string>; cost: Set<string> }

export function createPriceLinks(): PriceLinks {
  return { seen: new Set(), sale: new Set(), wholesale: new Set(), cost: new Set() }
}

/** Registra las variantes nuevas para el editor. Las ya vistas no cambian. */
export function registerPriceLinks(links: PriceLinks, variants: ProductVariantInput[], base: VariantPriceDefaults) {
  for (const variant of variants) {
    const key = variantSelectionKey(variant)
    if (links.seen.has(key)) continue
    links.seen.add(key)
    if (base.salePrice > 0 && variant.salePrice === base.salePrice) links.sale.add(key)
    if ((variant.wholesalePrice ?? null) === (base.wholesalePrice ?? null)) links.wholesale.add(key)
    if (base.purchasePrice != null && variant.purchasePrice === base.purchasePrice) links.cost.add(key)
  }
}

/** Una edición manual del precio de una variante corta el vínculo de ese precio. */
export function unlinkEditedPrices(links: PriceLinks, key: string, patch: Partial<ProductVariantInput>) {
  if ('salePrice' in patch) links.sale.delete(key)
  if ('wholesalePrice' in patch) links.wholesale.delete(key)
  if ('purchasePrice' in patch) links.cost.delete(key)
}

/**
 * Aplica los precios del producto a las variantes vinculadas. Devuelve la misma
 * lista si no cambió nada. Un precio de venta vacío o en 0 no se copia (se está
 * tipeando) y el costo solo se copia con permiso para editarlo y si tiene valor.
 */
export function applyLinkedBasePrices(
  variants: ProductVariantInput[],
  links: PriceLinks,
  base: VariantPriceDefaults,
  options: { canUpdateCost: boolean },
): ProductVariantInput[] {
  let changed = false
  const next = variants.map((variant) => {
    const key = variantSelectionKey(variant)
    const patch: Partial<ProductVariantInput> = {}
    if (links.sale.has(key) && base.salePrice > 0 && variant.salePrice !== base.salePrice) patch.salePrice = base.salePrice
    if (links.wholesale.has(key) && (variant.wholesalePrice ?? null) !== (base.wholesalePrice ?? null)) patch.wholesalePrice = base.wholesalePrice
    if (options.canUpdateCost && links.cost.has(key) && base.purchasePrice != null && variant.purchasePrice !== base.purchasePrice) {
      patch.purchasePrice = base.purchasePrice
    }
    if (Object.keys(patch).length === 0) return variant
    changed = true
    return { ...variant, ...patch }
  })
  return changed ? next : variants
}
