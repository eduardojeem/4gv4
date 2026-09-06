'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ShoppingCart, ArrowRight, Trash2, Store, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatMoney } from '@/components/dashboard/orders/format'
import { PUBLIC_CART_EVENT, type PublicCartItem } from '@/lib/public-cart'

export interface ActiveStoreCart {
  tenantSlug: string
  displayName: string
  itemCount: number
  totalAmount: number
  items: PublicCartItem[]
  href: string
}

function getStoreDisplayName(slug: string): string {
  if (!slug || slug === 'default') return 'Tienda Principal'
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function ProfileStoreCarts() {
  const [carts, setCarts] = useState<ActiveStoreCart[]>([])
  const [mounted, setMounted] = useState(false)

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
              displayName: getStoreDisplayName(slug),
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
  }, [])

  useEffect(() => {
    setMounted(true)
    scanCarts()

    const handleUpdate = () => scanCarts()
    window.addEventListener(PUBLIC_CART_EVENT, handleUpdate)
    window.addEventListener('storage', handleUpdate)

    return () => {
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

  if (!mounted) return null

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
                    <Store className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-foreground">
                      {cart.displayName}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                      {cart.itemCount} {cart.itemCount === 1 ? 'ítem' : 'ítems'}
                    </Badge>
                  </div>

                  {/* Previews de productos */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {cart.items.slice(0, 3).map((item, idx) => (
                      <div
                        key={item.cartItemId || idx}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
                      >
                        <Package className="h-3 w-3 text-primary/70" />
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleClearCart(cart.tenantSlug)}
                    className="h-9 px-2.5 text-muted-foreground hover:text-destructive text-xs"
                    title="Vaciar este carrito"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
