'use client'

import Link from 'next/link'
import { ShoppingCart, ArrowRight, Trash2, Store, Package, RefreshCw, CloudOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatMoney } from '@/components/dashboard/orders/format'
import { useSyncedMarketplaceCarts } from '@/hooks/use-synced-marketplace-carts'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function ProfileStoreCarts() {
  const { carts, status, retry, clearCart } = useSyncedMarketplaceCarts()

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
        <div className="mb-4 flex min-h-6 items-center justify-end gap-2 text-xs text-muted-foreground" aria-live="polite">
          {status === 'syncing' && <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sincronizando…</>}
          {status === 'synced' && <span>Sincronizado entre dispositivos</span>}
          {status === 'conflict' && <span className="font-semibold text-amber-700 dark:text-amber-300">Revisamos cambios de precio o stock</span>}
          {(status === 'error' || status === 'pending') && <>
            <CloudOff className="h-3.5 w-3.5" /> Se conserva en este dispositivo
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void retry()}>Reintentar</Button>
          </>}
        </div>
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

                  {cart.conflicts > 0 && <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Ajustamos {cart.conflicts} ítem según el catálogo actual.</p>}

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
                        <AlertDialogAction onClick={() => void clearCart(cart.tenantSlug)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
