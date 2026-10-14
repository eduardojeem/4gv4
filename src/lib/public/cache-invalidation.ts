import { revalidateTag } from 'next/cache'

/** JSON values are compared structurally; JSONB does not preserve object key order. */
export function samePublicValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => samePublicValue(value, right[index]))
  }
  const a = left as Record<string, unknown>
  const b = right as Record<string, unknown>
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length
    && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && samePublicValue(a[key], b[key]))
}

const INTERNAL_PRODUCT_FIELDS = new Set(['id', 'branch_id', 'purchase_price', 'min_stock', 'max_stock', 'supplier_id', 'initial_batch'])

export function hasPublicProductChange(previous: Record<string, unknown>, patch: Record<string, unknown>): boolean {
  return Object.entries(patch).some(([key, value]) => value !== undefined
    && !INTERNAL_PRODUCT_FIELDS.has(key)
    // Variants live in a separate table, not in the parent snapshot.
    && (key === 'variants' || !samePublicValue(previous[key], value)))
}

export function invalidateMarketplaceCatalog() {
  // All of these aggregate public products. The directory embeds product cards.
  // Tag invalidation also invalidates dependent pages; no layout-wide purge.
  for (const tag of ['marketplace:products', 'marketplace:offers', 'marketplace:categories', 'marketplace:brands', 'marketplace:organizations']) {
    revalidateTag(tag, 'max')
  }
}
