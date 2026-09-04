import type { PublicProduct } from '@/types/public'
import { getTenantSlugFromPathname as getSharedTenantSlugFromPathname } from '@/lib/saas/tenant'

export type PublicCartItem = {
  cartItemId: string
  productId: string
  variantId: string | null
  variantName: string | null
  name: string
  sku: string | null
  image: string | null
  unitPrice: number
  quantity: number
  availableStock: number | null
}

export const PUBLIC_CART_EVENT = 'mipos-public-cart-updated'
const MAX_CART_QUANTITY = 999

function normalizeAvailableStock(value: unknown) {
  const stock = Number(value)
  return Number.isFinite(stock) && stock >= 0
    ? Math.min(MAX_CART_QUANTITY, Math.floor(stock))
    : null
}

export function clampPublicCartQuantity(quantity: number, availableStock: number | null) {
  const requested = Number.isFinite(quantity) ? Math.floor(quantity) : 0
  const maximum = availableStock == null
    ? MAX_CART_QUANTITY
    : Math.min(MAX_CART_QUANTITY, availableStock)

  return Math.max(0, Math.min(maximum, requested))
}

export function getPublicCartStorageKey(tenantSlug: string | null | undefined) {
  return `mipos-public-cart:${tenantSlug || 'default'}`
}

export function getTenantSlugFromPathname(pathname: string) {
  return getSharedTenantSlugFromPathname(pathname) || null
}

export function getPublicCartItems(tenantSlug: string | null | undefined): PublicCartItem[] {
  if (typeof window === 'undefined') return []

  try {
    const parsed = JSON.parse(localStorage.getItem(getPublicCartStorageKey(tenantSlug)) || '[]')
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item) => item && typeof item === 'object' && typeof item.productId === 'string')
      .map((item) => {
        const legacyParts = String(item.productId).split(':')
        const productId = legacyParts[0]
        const variantId = typeof item.variantId === 'string' ? item.variantId : legacyParts[1] || null
        return {
        ...item, productId, variantId,
        cartItemId: typeof item.cartItemId === 'string' ? item.cartItemId : (variantId ? `${productId}:${variantId}` : productId),
        variantName: typeof item.variantName === 'string' ? item.variantName : null,
        availableStock: normalizeAvailableStock(item.availableStock),
      }}) as PublicCartItem[]
  } catch {
    return []
  }
}

export function setPublicCartItems(tenantSlug: string | null | undefined, items: PublicCartItem[]) {
  if (typeof window === 'undefined') return

  localStorage.setItem(getPublicCartStorageKey(tenantSlug), JSON.stringify(items))
  window.dispatchEvent(new CustomEvent(PUBLIC_CART_EVENT))
}

export function clearPublicCart(tenantSlug: string | null | undefined) {
  setPublicCartItems(tenantSlug, [])
}

export function setPublicCartItemStock(
  tenantSlug: string | null | undefined,
  cartItemId: string,
  availableStock: number
) {
  const normalizedStock = normalizeAvailableStock(availableStock) ?? 0
  let updatedItem: PublicCartItem | null = null
  const next = getPublicCartItems(tenantSlug)
    .map((item) => {
      if (item.cartItemId !== cartItemId) return item

      updatedItem = {
        ...item,
        availableStock: normalizedStock,
        quantity: clampPublicCartQuantity(item.quantity, normalizedStock),
      }
      return updatedItem
    })
    .filter((item) => item.quantity > 0)

  setPublicCartItems(tenantSlug, next)
  return updatedItem
}

export function addPublicProductToCart({
  tenantSlug,
  product,
  unitPrice,
  quantity = 1,
  variant,
}: {
  tenantSlug: string | null | undefined
  product: PublicProduct
  unitPrice: number
  quantity?: number
  variant?: {
    id: string
    variant_name: string
    sku?: string | null
    stock_quantity?: number | null
  } | null
}) {
  const current = getPublicCartItems(tenantSlug)
  const cartItemId = variant ? `${product.id}:${variant.id}` : product.id
  const displayName = variant ? `${product.name} (${variant.variant_name})` : product.name
  const displaySku = variant?.sku || product.sku || null
  const rawStock = variant && typeof variant.stock_quantity === 'number'
    ? variant.stock_quantity
    : product.stock_quantity
  const availableStock = normalizeAvailableStock(rawStock) ?? 0

  const existing = current.find((item) => item.cartItemId === cartItemId)
  const requestedQuantity = (existing?.quantity ?? 0) + quantity
  const nextQuantity = clampPublicCartQuantity(requestedQuantity, availableStock)
  const next = existing
    ? current.map((item) =>
        item.cartItemId === cartItemId
          ? { ...item, quantity: nextQuantity, availableStock, unitPrice }
          : item
      )
    : [
        ...current,
        {
          cartItemId,
          productId: product.id,
          variantId: variant?.id ?? null,
          variantName: variant?.variant_name ?? null,
          name: displayName,
          sku: displaySku,
          image: product.image || null,
          unitPrice,
          quantity: nextQuantity,
          availableStock,
        },
      ].filter((item) => item.quantity > 0)

  setPublicCartItems(tenantSlug, next)
  return {
    items: next,
    quantity: nextQuantity,
    limited: nextQuantity < requestedQuantity,
  }
}
