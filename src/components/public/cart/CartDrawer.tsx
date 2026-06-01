'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Minus, Package, Plus, ShoppingBag, Trash2 } from 'lucide-react'
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

export function CartDrawer() {
  const router = useRouter()
  const { isOpen, close } = useCartDrawer()
  const { tenantSlug, items, count, subtotal, setQuantity, removeItem, clear } = usePublicCart()

  const productsHref = tenantSlug ? `/${tenantSlug}/productos` : '/productos'
  const cartHref = tenantSlug ? `/${tenantSlug}/carrito` : '/carrito'

  function handleCheckout() {
    close()
    router.push(cartHref)
  }

  return (
    <Sheet open={isOpen} onOpenChange={(val) => !val && close()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px] border-l border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <SheetHeader className="flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-5">
          <SheetTitle className="flex items-center gap-2.5 text-lg font-semibold">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Tu Carrito
            {count > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </SheetTitle>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={clear}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Vaciar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-full p-0 hover:bg-muted"
              onClick={close}
              aria-label="Cerrar carrito"
            >
              <span className="text-xl leading-none">×</span>
            </Button>
          </div>
        </SheetHeader>

        {/* Items */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-background">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <ShoppingBag className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Tu carrito está vacío
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-[250px]">
                Parece que aún no has agregado nada. Explora nuestros productos y encuentra lo que buscas.
              </p>
              <Button asChild className="mt-8 rounded-full px-8" size="lg" onClick={close}>
                <Link href={productsHref}>Empezar a comprar</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/60 p-4">
              {items.map((item) => {
                const image = resolveProductImageUrl(item.image)
                return (
                  <li key={item.productId} className="flex gap-4 rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 mb-3 transition-all hover:shadow-md">
                    {/* Thumbnail */}
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                      {image ? (
                        <Image
                          src={image}
                          alt={item.name}
                          fill
                          className="object-contain p-2"
                          sizes="80px"
                          unoptimized={
                            image.startsWith('data:') ||
                            image === '/placeholder-product.svg'
                          }
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="line-clamp-2 text-sm font-medium leading-tight text-slate-900 dark:text-slate-100">
                            {item.name}
                          </h4>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatPrice(item.unitPrice)} c/u
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Quitar ${item.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      
                      <div className="mt-3 flex items-center justify-between">
                        {/* Quantity control */}
                        <div className="flex h-8 items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => setQuantity(item.productId, item.quantity - 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-l-full text-muted-foreground transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-foreground"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[2rem] text-center text-xs font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQuantity(item.productId, item.quantity + 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-r-full text-muted-foreground transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-foreground"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Line total */}
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatPrice(item.quantity * item.unitPrice)}
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-background p-6 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
            <div className="mb-4 space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal ({count} {count === 1 ? 'artículo' : 'artículos'})</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white">
                <span>Total a pagar</span>
                <span className="text-primary">{formatPrice(subtotal)}</span>
              </div>
            </div>
            
            <Button
              className="w-full h-12 rounded-full text-base font-medium shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all"
              onClick={handleCheckout}
            >
              Ir al Checkout
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              className="mt-3 w-full rounded-full text-muted-foreground hover:text-foreground"
              onClick={close}
            >
              Seguir comprando
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
