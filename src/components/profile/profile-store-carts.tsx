'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { ShoppingCart, ArrowRight, Trash2, Store, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatMoney } from '@/components/dashboard/orders/format'
import { PUBLIC_CART_EVENT, type PublicCartItem } from '@/lib/public-cart'
import { useFavorites } from '@/lib/public/favorites-store'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export interface ActiveStoreCart {
  tenantSlug: string
  displayName: string
  itemCount: number
  totalAmount: number
  items: PublicCartItem[]
  href: string
  logoUrl?: string | null
  changedPrices?: number
  unavailableItems?: number
  syncFailed?: boolean
}

type CartProductMetadata = {
  name: string
  image: string | null
  price: number | null
  hasOffer: boolean
  offerPrice: number | null
  isActive: boolean
  stockQuantity: number
}

type CartVariantMetadata = {
  productId: string
  name: string
  price: number
  isActive: boolean
  stockQuantity: number
}

/**
 * Como se llama la tienda de un carrito.
 *
 * El carrito guarda solo el slug, asi que antes se armaba un nombre a mano
 * capitalizando cada palabra: `servicio-tecnico-don-jose` salia como «Servicio
 * Tecnico Don Jose», que se parece a un nombre pero no es el nombre. Los
 * favoritos del mismo navegador SI guardan el nombre real de cada tienda, asi
 * que se usa ese cuando esta. Si no, se muestra el slug tal cual: un
 * identificador se lee como identificador y no se confunde con un dato.
 */
function getStoreDisplayName(slug: string, realNames: Map<string, string>): string {
  if (!slug || slug === 'default') return 'Tienda Principal'
  return realNames.get(slug) || slug
}

export function ProfileStoreCarts() {
  const [carts, setCarts] = useState<ActiveStoreCart[]>([])

  // Los favoritos del mismo navegador traen `{ slug, store }` con el nombre real
  // de cada tienda: sin esto habria que inventarlo a partir del slug.
  const favoritesState = useFavorites()
  const realStoreNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const favorite of favoritesState?.items || []) {
      if (favorite.slug && favorite.store) map.set(favorite.slug, favorite.store)
    }
    return map
  }, [favoritesState?.items])

  const scanCarts = useCallback(() => {
    if (typeof window === 'undefined') return
    const activeCarts: ActiveStoreCart[] = []

    try {
      const keys = new Set<string>()
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k) keys.add(k)
      }
      Object.keys(localStorage).forEach((k) => keys.add(k))

      for (const key of keys) {
        if (key && key.startsWith('mipos-public-cart:')) {
          const raw = localStorage.getItem(key)
          if (!raw) continue

          const items: PublicCartItem[] = JSON.parse(raw)
          if (Array.isArray(items) && items.length > 0) {
            const slug = key.replace('mipos-public-cart:', '')
            const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
            const totalAmount = items.reduce(
              (sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
              0
            )
            const href = !slug || slug === 'default' ? '/carrito' : `/${slug}/carrito`

            activeCarts.push({
              tenantSlug: slug,
              displayName: getStoreDisplayName(slug, realStoreNames),
              itemCount,
              totalAmount,
              items,
              href,
            })
          }
        }
      }
    } catch {
      // Ignorar errores de parseo
    }

    setCarts(activeCarts)

    void Promise.all(activeCarts.map(async (cart) => {
      try {
        const response = await fetch(`/api/public/favorites/metadata?org=${encodeURIComponent(cart.tenantSlug)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productIds: [...new Set(cart.items.map((item) => item.productId))],
            variantIds: cart.items.flatMap((item) => item.variantId ? [item.variantId] : []),
          }),
        })
        if (!response.ok) throw new Error('catalog unavailable')
        const payload = await response.json() as {
          metadata?: Record<string, CartProductMetadata>
          variants?: Record<string, CartVariantMetadata>
          organization?: { name?: string; logo_url?: string | null } | null
        }
        const metadata = payload.metadata ?? {}
        let changedPrices = 0
        let unavailableItems = 0
        const syncedItems = cart.items.map((item) => {
          const current = metadata[item.productId]
          if (!current) {
            unavailableItems += 1
            return { ...item, availableStock: 0 }
          }
          const currentVariant = item.variantId ? payload.variants?.[item.variantId] : null
          const currentPrice = currentVariant
            ? currentVariant.price
            : current.hasOffer && current.offerPrice != null ? current.offerPrice : current.price
          const currentStock = currentVariant?.stockQuantity ?? current.stockQuantity
          const currentActive = current.isActive && (currentVariant?.isActive ?? true)
          if (currentPrice != null && currentPrice !== item.unitPrice) changedPrices += 1
          if (!currentActive || currentStock <= 0) unavailableItems += 1
          return {
            ...item,
            name: currentVariant ? `${current.name} (${currentVariant.name})` : current.name || item.name,
            image: current.image || item.image,
            unitPrice: currentPrice ?? item.unitPrice,
            availableStock: currentActive ? currentStock : 0,
            quantity: Math.min(item.quantity, currentActive ? currentStock : 0),
          }
        }).filter((item) => item.quantity > 0)
        const totalAmount = syncedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        const itemCount = syncedItems.reduce((sum, item) => sum + item.quantity, 0)

        setCarts((current) => current.map((entry) => entry.tenantSlug === cart.tenantSlug ? {
          ...entry,
          displayName: payload.organization?.name || entry.displayName,
          logoUrl: payload.organization?.logo_url,
          items: syncedItems,
          totalAmount,
          itemCount,
          changedPrices,
          unavailableItems,
        } : entry))
      } catch {
        setCarts((current) => current.map((entry) => entry.tenantSlug === cart.tenantSlug ? { ...entry, syncFailed: true } : entry))
      }
    }))
  }, [realStoreNames])

  useEffect(() => {
    const initialScan = window.setTimeout(scanCarts, 0)

    const handleUpdate = () => scanCarts()
    window.addEventListener(PUBLIC_CART_EVENT, handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
      window.clearTimeout(initialScan)
      window.removeEventListener(PUBLIC_CART_EVENT, handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [scanCarts])

  const handleClearCart = (tenantSlug: string) => {
    try {
      const key = `mipos-public-cart:${tenantSlug}`
      localStorage.removeItem(key)
      window.dispatchEvent(new Event(PUBLIC_CART_EVENT))
      scanCarts()
    } catch {
      // Noop
    }
  }

  return (
    <div id="carritos" className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShoppingCart className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Carritos pendientes en tiendas
            </h3>
            <p className="text-xs text-muted-foreground">
              Productos que dejaste seleccionados en comercios de la red
            </p>
          </div>
        </div>
        {carts.length > 0 && (
          <Badge variant="secondary" className="font-semibold text-xs">
            {carts.length} {carts.length === 1 ? 'tienda' : 'tiendas'}
          </Badge>
        )}
      </div>

      <div className="p-5">
        {carts.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <ShoppingCart className="mx-auto h-8 w-8 opacity-40 mb-2" />
            <p className="text-sm font-medium text-foreground">No tenés carritos pendientes</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Cuando agregues productos en cualquier tienda, podrás verlos reunidos aquí para finalizar tu compra rápidamente.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4 rounded-xl text-xs">
              <Link href="/marketplace/productos">Explorar catálogo general</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {carts.map((cart) => (
              <div
                key={cart.tenantSlug}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border/80 bg-background/60 p-4 transition-all hover:border-primary/30 hover:bg-background"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {cart.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cart.logoUrl} alt="" className="h-6 w-6 rounded object-contain" />
                    ) : <Store className="h-4 w-4 text-primary" aria-hidden="true" />}
                    <span className="text-sm font-bold text-foreground">
                      {cart.displayName}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                      {cart.itemCount} {cart.itemCount === 1 ? 'ítem' : 'ítems'}
                    </Badge>
                  </div>

                  {(cart.changedPrices ?? 0) > 0 && <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Se actualizaron precios según el catálogo actual.</p>}
                  {(cart.unavailableItems ?? 0) > 0 && <p className="text-xs font-semibold text-destructive">Hay productos sin stock o que ya no están disponibles.</p>}
                  {cart.syncFailed && <p className="text-xs text-muted-foreground">No pudimos verificar precio y stock ahora. Se confirmarán al continuar.</p>}

                  {/* Previews de productos */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {cart.items.slice(0, 3).map((item, idx) => (
                      <div
                        key={item.cartItemId || idx}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
                      >
                        {item.image ? (
                          // La imagen ya fue validada al agregar el producto al carrito.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt={item.name} className="h-6 w-6 rounded object-cover" />
                        ) : (
                          <Package className="h-3 w-3 text-primary/70" aria-hidden="true" />
                        )}
                        <span className="max-w-[140px] truncate font-medium text-foreground">
                          {item.name}
                        </span>
                        {item.quantity > 1 && (
                          <span className="text-xs font-bold text-primary">x{item.quantity}</span>
                        )}
                      </div>
                    ))}
                    {cart.items.length > 3 && (
                      <span className="text-[11px] text-muted-foreground">
                        +{cart.items.length - 3} más
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-foreground pt-0.5">
                    Total estimado:{' '}
                    <span className="text-sm font-extrabold text-primary">
                      {formatMoney(cart.totalAmount)}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 sm:pt-0 self-end sm:self-center">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 px-2.5 text-muted-foreground hover:text-destructive text-xs"
                        aria-label={`Vaciar carrito de ${cart.displayName}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Vaciar este carrito?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminarán {cart.itemCount} {cart.itemCount === 1 ? 'producto' : 'productos'} del carrito de {cart.displayName}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Conservar carrito</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleClearCart(cart.tenantSlug)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Vaciar carrito
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button asChild size="sm" className="h-9 gap-1.5 rounded-xl text-xs font-bold">
                    <Link href={cart.href}>
                      Continuar compra
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
