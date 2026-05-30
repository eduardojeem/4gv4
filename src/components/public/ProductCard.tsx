'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Check, Eye, Package, ShoppingCart, Tag, Zap, XCircle } from 'lucide-react'
import { PublicProduct } from '@/types/public'
import { useAuth } from '@/contexts/auth-context'
import { usePathname } from 'next/navigation'
import { formatPrice, cn } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'
import { WHOLESALE_PRICE_PERMISSION } from '@/lib/auth/roles-permissions'
import { usePublicCart } from '@/hooks/use-public-cart'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

interface ProductCardProps {
  product: PublicProduct
  priority?: boolean
  isWholesale?: boolean
}

export function ProductCard(props: ProductCardProps) {
  const { product, priority = false } = props
  const { hasPermission } = useAuth()
  const { addProduct } = usePublicCart()
  const pathname = usePathname()
  const [imageError, setImageError] = useState(false)
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const hasWholesalePermission = hasPermission(WHOLESALE_PRICE_PERMISSION)
  const isWholesale = props.isWholesale ?? hasWholesalePermission

  // ── Price logic ──────────────────────────────────────────────────────────
  const hasOffer =
    !isWholesale &&
    product.has_offer === true &&
    product.offer_price != null &&
    product.offer_price < product.sale_price

  const isWholesaleDiscount =
    isWholesale &&
    product.wholesale_price != null &&
    product.wholesale_price < product.sale_price

  const displayPrice = hasOffer
    ? product.offer_price!
    : isWholesale && product.wholesale_price
    ? product.wholesale_price
    : product.sale_price

  const originalPrice = hasOffer || isWholesaleDiscount ? product.sale_price : null
  const discountPct = originalPrice
    ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
    : 0

  const isInStock = product.in_stock
  const isLowStock = isInStock && product.stock_quantity > 0 && product.stock_quantity <= 4
  const imageSrc = resolveProductImageUrl(product.image)

  // ── Tenant prefix ────────────────────────────────────────────────────────
  const pathSegments = pathname.split('/').filter(Boolean)
  const tenantPrefix =
    pathSegments.length > 1 &&
    ['inicio', 'productos', 'mis-reparaciones', 'carrito', 'track', 'cliente'].includes(
      pathSegments[1]
    )
      ? `/${pathSegments[0]}`
      : ''

  const productHref = `${tenantPrefix}/productos/${product.id}`

  // ── Handlers ────────────────────────────────────────────────────────────
  function addToCart(closeModal = false) {
    if (!isInStock) {
      toast.error('Producto sin stock')
      return
    }
    addProduct(product, Number(displayPrice || 0), 1)
    toast.success('Agregado al carrito')
    if (closeModal) setQuickViewOpen(false)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1500)
  }

  return (
    <>
      {/* ── Card ── */}
      <article
        className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
        onClick={() => setQuickViewOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setQuickViewOpen(true)}
        aria-label={`Vista rápida de ${product.name}`}
      >
        {/* ── Image area ── */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted/50 to-muted/20">
          {imageSrc && !imageError ? (
            <Image
              src={imageSrc}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain p-4 transition-transform duration-500 group-hover:scale-[1.06]"
              priority={priority}
              quality={80}
              onError={() => setImageError(true)}
              unoptimized={
                imageSrc.startsWith('data:') || imageSrc === '/placeholder-product.svg'
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground/20" />
            </div>
          )}

          {/* Badges — top left */}
          <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1.5">
            {discountPct > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow-sm">
                <Tag className="h-2.5 w-2.5" />
                -{discountPct}%
              </span>
            )}
            {product.featured && !hasOffer && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow-sm">
                <Zap className="h-2.5 w-2.5" />
                Destacado
              </span>
            )}
          </div>

          {/* Out-of-stock overlay */}
          {!isInStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
              <span className="rounded-full bg-destructive/90 px-4 py-1.5 text-xs font-semibold text-destructive-foreground shadow">
                Agotado
              </span>
            </div>
          )}
        </div>

        {/* Low-stock strip */}
        {isLowStock && (
          <div className="flex items-center gap-1.5 border-t border-amber-200/60 bg-amber-50 px-3.5 py-1.5 dark:border-amber-900/30 dark:bg-amber-950/20">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              Últimas {product.stock_quantity} unidades
            </span>
          </div>
        )}

        {/* ── Info area ── */}
        <div className="flex flex-1 flex-col gap-1.5 px-3.5 pb-3.5 pt-3">
          {/* Brand · Category */}
          {(product.brand || product.category) && (
            <p className="truncate text-[11px] font-medium text-muted-foreground">
              {[product.brand, product.category?.name].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* Product name */}
          <h3 className="line-clamp-2 flex-1 text-sm font-semibold leading-snug text-foreground">
            {product.name}
          </h3>

          {/* Price row */}
          <div className="mt-2 min-w-0">
            <p
              className={cn(
                'text-lg font-bold leading-tight',
                hasOffer || isWholesaleDiscount
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-foreground'
              )}
            >
              {formatPrice(displayPrice)}
            </p>
            {originalPrice && (
              <p className="text-xs text-muted-foreground line-through">
                {formatPrice(originalPrice)}
              </p>
            )}
          </div>

          {/* Action buttons — stopPropagation so card click (open modal) doesn't fire */}
          <div
            className="mt-3 flex gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Link
              href={productHref}
              className="relative z-20 flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-xs font-semibold text-foreground transition-all duration-150 hover:bg-muted hover:border-border/80 active:scale-95"
              aria-label={`Ver detalle de ${product.name}`}
            >
              <Eye className="h-3.5 w-3.5 shrink-0" />
              Ver detalle
            </Link>

            <button
              type="button"
              onClick={() => addToCart(false)}
              disabled={!isInStock}
              className="relative z-20 flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Agregar ${product.name} al carrito`}
            >
              {justAdded ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
              )}
              {justAdded ? '¡Listo!' : 'Agregar'}
            </button>
          </div>
        </div>
      </article>

      {/* ── Quick-view modal ── */}
      <Dialog open={quickViewOpen} onOpenChange={setQuickViewOpen}>
        <DialogContent
          className="max-h-[90vh] w-[calc(100%-2rem)] max-w-sm gap-0 overflow-y-auto rounded-2xl p-0"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">{product.name}</DialogTitle>

          {/* Image strip */}
          <div className="relative h-52 shrink-0 overflow-hidden bg-gradient-to-br from-muted/50 to-muted/20">
            {imageSrc && !imageError ? (
              <Image
                src={imageSrc}
                alt={product.name}
                fill
                sizes="384px"
                className="object-contain p-6"
                quality={90}
                onError={() => setImageError(true)}
                unoptimized={
                  imageSrc.startsWith('data:') || imageSrc === '/placeholder-product.svg'
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package className="h-16 w-16 text-muted-foreground/20" />
              </div>
            )}

            {/* Discount / featured badges */}
            <div className="absolute left-3 top-3 flex flex-col gap-1.5">
              {discountPct > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow">
                  <Tag className="h-2.5 w-2.5" />
                  -{discountPct}%
                </span>
              )}
              {product.featured && !hasOffer && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow">
                  <Zap className="h-2.5 w-2.5" />
                  Destacado
                </span>
              )}
            </div>

            {/* Close button — top right */}
            <button
              type="button"
              onClick={() => setQuickViewOpen(false)}
              className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-background"
              aria-label="Cerrar"
            >
              <XCircle className="h-4 w-4" />
            </button>

            {!isInStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
                <span className="rounded-full bg-destructive/90 px-4 py-1.5 text-xs font-semibold text-destructive-foreground shadow">
                  Agotado
                </span>
              </div>
            )}
          </div>

          {/* Info panel */}
          <div className="flex flex-col gap-3 p-4">
            {/* Brand + name */}
            <div>
              {product.brand && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {product.brand}
                </p>
              )}
              <h2 className="mt-0.5 text-base font-bold leading-snug text-foreground">
                {product.name}
              </h2>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant={isInStock ? 'secondary' : 'destructive'}
                className="gap-1 rounded-full text-[11px]"
              >
                {isInStock ? (
                  <><Check className="h-2.5 w-2.5" /> En stock</>
                ) : (
                  <><XCircle className="h-2.5 w-2.5" /> Agotado</>
                )}
              </Badge>
              {product.category && (
                <Badge variant="outline" className="rounded-full text-[11px]">
                  {product.category.name}
                </Badge>
              )}
              {isLowStock && (
                <Badge className="rounded-full bg-amber-500 text-[11px] text-white">
                  Últimas {product.stock_quantity} uds.
                </Badge>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2">
              <p
                className={cn(
                  'text-2xl font-bold leading-tight',
                  hasOffer || isWholesaleDiscount
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-foreground'
                )}
              >
                {formatPrice(displayPrice)}
              </p>
              {originalPrice && (
                <p className="text-sm text-muted-foreground line-through">
                  {formatPrice(originalPrice)}
                </p>
              )}
            </div>

            {/* Description */}
            {product.description?.trim() && (
              <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {product.description.trim().replace(/\n{3,}/g, '\n\n')}
              </p>
            )}

            {/* CTA buttons */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => addToCart(true)}
                disabled={!isInStock}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {justAdded ? (
                  <><Check className="h-4 w-4" /> ¡Agregado!</>
                ) : (
                  <><ShoppingCart className="h-4 w-4" /> Agregar al carrito</>
                )}
              </button>

              <Link
                href={productHref}
                onClick={() => setQuickViewOpen(false)}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-xs font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98]"
              >
                <Eye className="h-3.5 w-3.5" />
                Ver detalle completo
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
