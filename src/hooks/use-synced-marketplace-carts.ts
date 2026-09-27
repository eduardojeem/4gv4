'use client'

import { useCallback, useEffect, useState } from 'react'
import { PUBLIC_CART_EVENT, getPublicCartItems, getPublicCartStorageKey, type PublicCartItem } from '@/lib/public-cart'
import { mergeForMigration, toSyncItems } from '@/lib/marketplace/cart-sync-client'
import type { CartSyncItem } from '@/lib/marketplace/cart-sync'

export type CartSyncStatus = 'local' | 'syncing' | 'synced' | 'pending' | 'conflict' | 'error'

export type SyncedMarketplaceCart = {
  tenantSlug: string
  displayName: string
  logoUrl: string | null
  items: PublicCartItem[]
  itemCount: number
  totalAmount: number
  href: string
  conflicts: number
  lastVerifiedAt: string | null
}

type RemoteCart = {
  last_verified_at: string | null
  organization: { name: string; slug: string; logo_url: string | null } | Array<{ name: string; slug: string; logo_url: string | null }> | null
  items: Array<{ product_id: string; variant_id: string | null; quantity: number }>
}

type SyncResponse = {
  organization: { name: string; slug: string; logo_url: string | null }
  items: Array<{ productId: string; variantId: string | null; quantity: number; unitPrice: number; name: string; image: string | null; availableStock: number }>
  conflicts: unknown[]
  lastVerifiedAt: string
}

function localSlugs() {
  const slugs = new Set<string>()
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (key?.startsWith('mipos-public-cart:')) slugs.add(key.slice('mipos-public-cart:'.length))
  }
  return slugs
}

function toCart(slug: string, result: SyncResponse): SyncedMarketplaceCart {
  const items: PublicCartItem[] = result.items.map((item) => ({
    cartItemId: item.variantId ? `${item.productId}:${item.variantId}` : item.productId,
    productId: item.productId,
    variantId: item.variantId,
    variantName: null,
    name: item.name,
    sku: null,
    image: item.image,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    availableStock: item.availableStock,
  }))
  return {
    tenantSlug: slug,
    displayName: result.organization.name,
    logoUrl: result.organization.logo_url,
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    totalAmount: items.reduce((total, item) => total + item.quantity * item.unitPrice, 0),
    href: slug === 'default' ? '/carrito' : `/${slug}/carrito`,
    conflicts: result.conflicts.length,
    lastVerifiedAt: result.lastVerifiedAt,
  }
}

export function useSyncedMarketplaceCarts() {
  const [carts, setCarts] = useState<SyncedMarketplaceCart[]>([])
  const [status, setStatus] = useState<CartSyncStatus>('local')

  const synchronize = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus('pending')
      return
    }
    setStatus('syncing')
    try {
      const remoteResponse = await fetch('/api/marketplace/profile/carts', { cache: 'no-store' })
      if (!remoteResponse.ok) throw new Error('remote carts unavailable')
      const remotePayload = await remoteResponse.json() as { carts?: RemoteCart[] }
      const remoteBySlug = new Map<string, { items: CartSyncItem[]; info: NonNullable<RemoteCart['organization']> }>()
      for (const cart of remotePayload.carts ?? []) {
        const info = Array.isArray(cart.organization) ? cart.organization[0] : cart.organization
        if (!info?.slug) continue
        remoteBySlug.set(info.slug, {
          info,
          items: cart.items.map((item) => ({ productId: item.product_id, variantId: item.variant_id, quantity: item.quantity })),
        })
      }

      const slugs = localSlugs()
      for (const slug of remoteBySlug.keys()) slugs.add(slug)
      const synced = await Promise.all([...slugs].map(async (slug) => {
        const local = getPublicCartItems(slug)
        const remote = remoteBySlug.get(slug)?.items ?? []
        const items = remote.length > 0 ? mergeForMigration(local, remote) : toSyncItems(local)
        if (items.length === 0) return null
        const response = await fetch('/api/marketplace/profile/carts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationSlug: slug, items }),
        })
        if (!response.ok) throw new Error('cart sync failed')
        const result = await response.json() as SyncResponse
        const cart = toCart(slug, result)
        localStorage.setItem(getPublicCartStorageKey(slug), JSON.stringify(cart.items))
        return cart
      }))

      const visible = synced.filter((cart): cart is SyncedMarketplaceCart => Boolean(cart?.items.length))
      setCarts(visible)
      setStatus(visible.some((cart) => cart.conflicts > 0) ? 'conflict' : 'synced')
    } catch {
      const fallback = [...localSlugs()].map((slug) => {
        const items = getPublicCartItems(slug)
        return {
          tenantSlug: slug,
          displayName: slug === 'default' ? 'Tienda principal' : slug.split('-').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' '),
          logoUrl: null,
          items,
          itemCount: items.reduce((total, item) => total + item.quantity, 0),
          totalAmount: items.reduce((total, item) => total + item.quantity * item.unitPrice, 0),
          href: slug === 'default' ? '/carrito' : `/${slug}/carrito`,
          conflicts: 0,
          lastVerifiedAt: null,
        }
      }).filter((cart) => cart.items.length > 0)
      setCarts(fallback)
      setStatus('error')
    }
  }, [])

  const clearCart = useCallback(async (slug: string) => {
    localStorage.removeItem(getPublicCartStorageKey(slug))
    setCarts((current) => current.filter((cart) => cart.tenantSlug !== slug))
    try {
      await fetch(`/api/marketplace/profile/carts?organizationSlug=${encodeURIComponent(slug)}`, { method: 'DELETE' })
    } catch {
      setStatus('pending')
    }
    window.dispatchEvent(new Event(PUBLIC_CART_EVENT))
  }, [])

  useEffect(() => {
    void synchronize()
    const update = () => void synchronize()
    window.addEventListener(PUBLIC_CART_EVENT, update)
    window.addEventListener('storage', update)
    window.addEventListener('online', update)
    return () => {
      window.removeEventListener(PUBLIC_CART_EVENT, update)
      window.removeEventListener('storage', update)
      window.removeEventListener('online', update)
    }
  }, [synchronize])

  return { carts, status, retry: synchronize, clearCart }
}
