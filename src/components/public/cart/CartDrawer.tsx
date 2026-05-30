'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Minus, Package, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useCartDrawer } from '@/contexts/cart-drawer-context'
import { usePublicCart } from '@/hooks/use-public-cart'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import { CheckoutModal } from './CheckoutModal'

export function CartDrawer() {
  const { isOpen, close } = useCartDrawer()
  const { tenantSlug, items, count, subtotal, setQuantity, removeItem, clear } = usePublicCart()
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const productsHref = tenantSlug ? `/${tenantSlug}/productos` : '/productos'

  function handleCheckoutSuccess() {
    setCheckoutOpen(false)
    close()
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(val) => !val && close()}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px]"
        >
          {/* Header */}
          <SheetHeader className="flex-row items-center justify-between border-b px-5 py-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Carrito
              {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </SheetTitle>
            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                  onClick={clear}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Vaciar
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={close}
                aria-label="Cerrar carrito"
              >
                <span className="text-lg leading-none">×</span>
              </Button>
            </div>
          </SheetHeader>

          {/* Items — scrollable middle */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground/40" />
                <p className="mt-4 font-semibold text-slate-700 dark:text-slate-300">
                  Tu carrito está vacío
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Agregá productos desde el catálogo
                </p>
                <Button asChild className="mt-6" onClick={close}>
                  <Link href={productsHref}>Ver productos</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {items.map((item) => {
                  const image = resolveProductImageUrl(item.image)
                  return (
                    <li key={item.productId} className="flex gap-3 px-5 py-4">
                      {/* Thumbnail */}
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
                        {image ? (
                          <Image
                            src={image}
                            alt={item.name}
                            fill
                            className="object-contain p-1.5"
                            sizes="64px"
                            unoptimized={
                              image.startsWith('data:') ||
                              image === '/placeholder-product.svg'
                            }
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                        <div>
                          <p className="line-clamp-1 text-sm font-semibold leading-snug">
                            {item.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatPrice(item.unitPrice)} c/u
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          {/* Quantity control */}
                          <div className="flex items-center rounded-lg border">
                            <button
                              type="button"
                              onClick={() =>
                                setQuantity(item.productId, item.quantity - 1)
                              }
                              className="flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              aria-label="Reducir cantidad"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-8 text-center text-sm font-semibold">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setQuantity(item.productId, item.quantity + 1)
                              }
                              className="flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              aria-label="Aumentar cantidad"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Line total + delete */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">
                              {formatPrice(item.quantity * item.unitPrice)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeItem(item.productId)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Quitar ${item.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Footer — sticky */}
          {items.length > 0 && (
            <div className="border-t bg-background px-5 py-4">
              <div className="mb-4 space-y-1.5 rounded-xl border bg-muted/30 p-4">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Productos ({count})</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(subtotal)}</span>
                </div>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={() => setCheckoutOpen(true)}
              >
                Confirmar pedido
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-muted-foreground"
                onClick={close}
              >
                Seguir comprando
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onSuccess={handleCheckoutSuccess}
      />
    </>
  )
}
