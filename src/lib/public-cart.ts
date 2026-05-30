import type { PublicProduct } from '@/types/public'

export type PublicCartItem = {
  productId: string
  name: string
  sku: string | null
  image: string | null
  unitPrice: number
  quantity: number
}

export const PUBLIC_CART_EVENT = 'mipos-public-cart-updated'

export function getPublicCartStorageKey(tenantSlug: string | null | undefined) {
  return `mipos-public-cart:${tenantSlug || 'default'}`
}

export function getTenantSlugFromPathname(pathname: string) {
  const [maybeSlug, section] = pathname.split('/').filter(Boolean)
  return maybeSlug && ['inicio', 'productos', 'mis-reparaciones', 'track', 'carrito', 'cliente'].includes(section || '')
    ? maybeSlug
    : null
}

export function getPublicCartItems(tenantSlug: string | null | undefined): PublicCartItem[] {
  if (typeof window === 'undefined') return []

  try {
    const parsed = JSON.parse(localStorage.getItem(getPublicCartStorageKey(tenantSlug)) || '[]')
    return Array.isArray(parsed) ? parsed : []
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
  const next = existing
    ? current.map((item) =>
        item.productId === product.id
          ? { ...item, quantity: Math.min(999, item.quantity + quantity), unitPrice }
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
          quantity,
        },
      ]

  setPublicCartItems(tenantSlug, next)
  return next
}
