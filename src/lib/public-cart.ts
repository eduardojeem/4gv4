import type { PublicProduct } from '@/types/public'
import { getTenantSlugFromPathname as getSharedTenantSlugFromPathname } from '@/lib/saas/tenant'

export type PublicCartItem = {
  productId: string
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
      .map((item) => ({
        ...item,
        availableStock: normalizeAvailableStock(item.availableStock),
      })) as PublicCartItem[]
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
  productId: string,
  availableStock: number
) {
  const normalizedStock = normalizeAvailableStock(availableStock) ?? 0
  let updatedItem: PublicCartItem | null = null
  const next = getPublicCartItems(tenantSlug)
    .map((item) => {
      if (item.productId !== productId) return item

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
}: {
  tenantSlug: string | null | undefined
  product: PublicProduct
  unitPrice: number
  quantity?: number
}) {
  const current = getPublicCartItems(tenantSlug)
  const existing = current.find((item) => item.productId === product.id)
  const availableStock = normalizeAvailableStock(product.stock_quantity) ?? 0
  const requestedQuantity = (existing?.quantity ?? 0) + quantity
  const nextQuantity = clampPublicCartQuantity(requestedQuantity, availableStock)
  const next = existing
    ? current.map((item) =>
        item.productId === product.id
          ? { ...item, quantity: nextQuantity, availableStock, unitPrice }
          : item
      )
    : [
        ...current,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku || null,
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
