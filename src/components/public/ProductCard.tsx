'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Check, ChevronLeft, ChevronRight, CreditCard, Eye, MapPin, MessageCircle, Package, ShoppingCart, Sparkles, Tag, TrendingDown, X, Zap } from 'lucide-react'
import { PublicProduct } from '@/types/public'
import { buildCreditInstallmentPlan } from '@/lib/credits/installments'
import { InstallmentSelector } from '@/components/public/InstallmentSelector'
import { usePathname } from 'next/navigation'
import { formatPrice, cn } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'
import { resolvePublicUnitPrice } from '@/lib/orders/public-pricing'
import { usePublicCart } from '@/hooks/use-public-cart'
import { useCartDrawer } from '@/contexts/cart-drawer-context'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { getWhatsAppLink } from '@/lib/whatsapp'

interface ProductCardProps {
  product: PublicProduct
  priority?: boolean
  isWholesale?: boolean
  /** Name of the branch the listing is scoped to (when a branch filter is active). */
  branchName?: string
  /** Branches where this product has stock (used when browsing all branches). */
  productBranches?: Array<{ id: string; name: string }>
}

export function ProductCard(props: ProductCardProps) {
  const { product, priority = false, branchName, productBranches } = props

  // Branch label: an explicit selected branch wins; otherwise summarize the
  // branches where this product is available.
  const branchLabel =
    branchName ||
    (productBranches && productBranches.length === 1
      ? productBranches[0].name
      : productBranches && productBranches.length > 1
        ? `${productBranches.length} sucursales`
        : '')
  const branchTitle =
    !branchName && productBranches && productBranches.length > 0
      ? productBranches.map((branch) => branch.name).join(', ')
      : undefined
  const { addProduct } = usePublicCart()
  const { open: openCartDrawer } = useCartDrawer()
  const { settings: websiteSettings, isLoading: isLoadingWebsiteSettings } = useWebsiteSettings()
  const pathname = usePathname()
  const [imageError, setImageError] = useState(false)
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const [activeImageIdx, setActiveImageIdx] = useState(0)

  // Compute gallery images: deduplicate image_url and images[]
  const galleryImages = (() => {
    const seen = new Set<string>()
    const result: string[] = []
    const candidates = [
      ...(product.image ? [product.image] : []),
      ...(Array.isArray(product.images) ? product.images : []),
    ]
    for (const img of candidates) {
      if (img && !seen.has(img)) {
        seen.add(img)
        result.push(img)
      }
    }
    return result
  })()
  const activeImage = galleryImages[activeImageIdx] ?? null
  const resolvedActive = resolveProductImageUrl(activeImage)

  // The server only includes wholesale_price after validating access for the
  // current organization. Never infer storefront pricing from dashboard roles.
  const isWholesale = props.isWholesale ?? product.wholesale_price != null

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

  // La misma función que usa el checkout: si la vitrina y el cobro calcularan
  // por separado, vuelven a divergir como pasaba con el precio mayorista.
  const displayPrice = resolvePublicUnitPrice({
    isWholesale,
    wholesalePrice: product.wholesale_price ?? null,
    salePrice: product.sale_price,
    hasOffer: product.has_offer === true,
    offerPrice: product.offer_price ?? null,
  })

  const originalPrice = hasOffer || isWholesaleDiscount ? product.sale_price : null
  const discountPct = originalPrice
    ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
    : 0

  const isInStock = product.in_stock
  const isLowStock = isInStock && product.stock_quantity > 0 && product.stock_quantity <= 4
  const imageSrc = resolveProductImageUrl(product.image)

  // ── Cuotas / financiación (informativo) ───────────────────────────────────
  const installmentsVisible =
    product.installments_enabled === true && product.installments_public !== false
  const installmentOptions =
    installmentsVisible && Array.isArray(product.installments_plans)
      ? [...product.installments_plans]
          .filter((plan) => plan && plan.count >= 1)
          .sort((a, b) => a.count - b.count)
          .map((plan) => {
            const built = buildCreditInstallmentPlan({
              principalAmount: displayPrice,
              interestRate: plan.rate ?? 0,
              installmentCount: plan.count,
              frequency: 'monthly',
            })
            return {
              count: plan.count,
              perInstallment: built.installments[0]?.amount ?? 0,
              financedTotal: built.financedTotal,
              hasInterest: built.interestAmount > 0,
            }
          })
      : []
  // Para la tarjeta mostramos la opción con más cuotas (la cuota más baja de mostrar)
  const maxInstallment =
    installmentOptions.length > 0 ? installmentOptions[installmentOptions.length - 1] : null

  // ── Tenant prefix ────────────────────────────────────────────────────────
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''

  const productHref = `${tenantPrefix}/productos/${product.id}`
  const commerceMode = websiteSettings?.checkout.commerceMode ??
    (isLoadingWebsiteSettings ? 'catalog' : 'cart')
  const contactPhone =
    websiteSettings?.company_info.whatsapp?.trim() ||
    websiteSettings?.company_info.phone?.trim() ||
    ''
  const whatsappHref = contactPhone
    ? getWhatsAppLink({
        phone: contactPhone,
        message: `Hola, quiero consultar por ${product.name} (${formatPrice(displayPrice)}).`,
      })
    : null

  // ── Handlers ────────────────────────────────────────────────────────────
  function addToCart(closeModal = false) {
    if (commerceMode !== 'cart') return
    if (!isInStock) {
      toast.error('Producto sin stock')
      return
    }
    const result = addProduct(product, Number(displayPrice || 0), 1)
    if (result.limited) {
      toast.info(`Ya agregaste el máximo disponible (${result.quantity}).`)
      return
    }
    toast.success('¡Agregado al carrito!')
    if (closeModal) setQuickViewOpen(false)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1500)
    openCartDrawer()
  }

  return (
    <>
      {/* ── Card ── */}
      <article
        className="group relative flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm transition-colors hover:border-primary/30"
      >
        {/* ── Image area ── */}
        <button
          type="button"
          onClick={() => setQuickViewOpen(true)}
          className="relative aspect-[4/3] overflow-hidden bg-muted/30 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          aria-label={`Vista rápida de ${product.name}`}
        >
          {imageSrc && !imageError ? (
            <Image
              src={imageSrc}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, (max-width: 1536px) 33vw, 25vw"
              className="object-contain p-4 transition-transform duration-500 group-hover:scale-[1.06]"
              priority={priority}
              quality={75}
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

          {/* Branch badge — top right */}
          {branchLabel && (
            <span
              title={branchTitle}
              className="absolute right-2.5 top-2.5 z-10 flex max-w-[70%] items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold leading-none text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur-sm"
            >
              <MapPin className="h-2.5 w-2.5 shrink-0 text-primary" />
              <span className="truncate">{branchLabel}</span>
            </span>
          )}

          {/* Out-of-stock overlay */}
          {!isInStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
              <span className="rounded-full bg-destructive/90 px-4 py-1.5 text-xs font-semibold text-destructive-foreground shadow">
                Agotado
              </span>
            </div>
          )}
        </button>

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
            {maxInstallment && (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                <CreditCard className="h-3 w-3 shrink-0" />
                Hasta {maxInstallment.count} cuotas de {formatPrice(maxInstallment.perInstallment)}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div
            className="mt-3 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Link
              href={productHref}
              className="relative z-20 flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background text-xs font-bold text-foreground transition-all hover:border-border hover:bg-muted active:scale-[0.98]"
              aria-label={`Ver detalle de ${product.name}`}
            >
              <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>Ver detalle</span>
            </Link>

            {commerceMode === 'cart' && (
              <button
                type="button"
                onClick={() => addToCart(false)}
                disabled={!isInStock}
                className={cn(
                  'relative z-20 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 active:scale-95 shadow-xs disabled:cursor-not-allowed disabled:opacity-40',
                  justAdded
                    ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20'
                )}
                aria-label={`Agregar ${product.name} al carrito`}
                title={`Agregar ${product.name} al carrito`}
              >
                {justAdded ? (
                  <Check className="h-4 w-4 animate-in zoom-in" />
                ) : (
                  <ShoppingCart className="h-4 w-4 transition-transform hover:scale-110" />
                )}
              </button>
            )}

            {commerceMode === 'whatsapp' && whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-20 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs transition-all hover:bg-emerald-500 active:scale-95 shadow-emerald-600/20"
                aria-label={`Consultar por ${product.name} en WhatsApp`}
                title={`Consultar por ${product.name} en WhatsApp`}
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </article>

      {/* ── Quick-view modal ── */}
      <Dialog open={quickViewOpen} onOpenChange={(open) => { setQuickViewOpen(open); if (!open) setActiveImageIdx(0) }}>
        <DialogContent
          className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-2xl gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">{product.name}</DialogTitle>

          {/* ── Two-column layout ─────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row">

            {/* ── Left column: image gallery ──────────────────────────── */}
            <div className="relative flex-shrink-0 sm:w-[42%] bg-gradient-to-br from-muted/60 to-muted/30 dark:from-muted/20 dark:to-background">
              {/* Main image */}
              <div className="relative aspect-square sm:aspect-[4/5] overflow-hidden">
                {resolvedActive && !imageError ? (
                  <Image
                    src={resolvedActive}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 320px"
                    className="object-contain p-6 transition-opacity duration-200"
                    quality={80}
                    onError={() => setImageError(true)}
                    unoptimized={resolvedActive.startsWith('data:') || resolvedActive === '/placeholder-product.svg'}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-20 w-20 text-muted-foreground/20" />
                  </div>
                )}

                {/* Out-of-stock overlay */}
                {!isInStock && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/65 backdrop-blur-[2px]">
                    <span className="rounded-full bg-destructive/90 px-5 py-2 text-sm font-bold text-destructive-foreground shadow">
                      Agotado
                    </span>
                  </div>
                )}

                {/* Prev/Next gallery arrows */}
                {galleryImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Imagen anterior"
                      onClick={(e) => { e.stopPropagation(); setActiveImageIdx((i) => (i - 1 + galleryImages.length) % galleryImages.length) }}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 shadow backdrop-blur-sm transition hover:bg-background"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Imagen siguiente"
                      onClick={(e) => { e.stopPropagation(); setActiveImageIdx((i) => (i + 1) % galleryImages.length) }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 shadow backdrop-blur-sm transition hover:bg-background"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Gallery dots */}
              {galleryImages.length > 1 && (
                <div className="flex justify-center gap-1.5 py-2.5">
                  {galleryImages.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Ver imagen ${i + 1}`}
                      onClick={() => setActiveImageIdx(i)}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-200',
                        i === activeImageIdx
                          ? 'w-4 bg-primary'
                          : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'
                      )}
                    />
                  ))}
                </div>
              )}

              {/* Top-left badges */}
              <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                {discountPct > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow-md">
                    <TrendingDown className="h-2.5 w-2.5" />
                    -{discountPct}%
                  </span>
                )}
                {product.featured && !hasOffer && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow-md">
                    <Sparkles className="h-2.5 w-2.5" />
                    Destacado
                  </span>
                )}
              </div>
            </div>

            {/* ── Right column: info panel ─────────────────────────────── */}
            <div className="flex flex-1 flex-col gap-0 overflow-y-auto">

              {/* Header bar */}
              <div className="flex items-start justify-between gap-2 border-b border-border/60 px-5 py-4">
                <div className="min-w-0">
                  {product.brand && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      {product.brand}
                    </p>
                  )}
                  <h2 className="mt-0.5 text-base font-bold leading-snug text-foreground">
                    {product.name}
                  </h2>
                  {/* SKU */}
                  {product.sku && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      SKU: {product.sku}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setQuickViewOpen(false)}
                  className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Cerrar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex flex-1 flex-col gap-4 px-5 py-4">

                {/* Status / Category badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                    isInStock
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800/40'
                      : 'bg-destructive/10 text-destructive ring-1 ring-destructive/20'
                  )}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', isInStock ? 'bg-emerald-500 animate-pulse' : 'bg-destructive')} />
                    {isInStock ? 'En stock' : 'Sin stock'}
                  </span>
                  {product.category && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
                      {product.category.name}
                    </span>
                  )}
                  {branchLabel && (
                    <span title={branchTitle} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
                      <MapPin className="h-2.5 w-2.5 text-primary" />
                      {branchLabel}
                    </span>
                  )}
                  {isLowStock && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800/40">
                      Últimas {product.stock_quantity} uds.
                    </span>
                  )}
                </div>

                {/* ── Price block ── */}
                <div className="rounded-2xl bg-muted/40 dark:bg-muted/20 px-4 py-3.5 ring-1 ring-border/60">
                  <div className="flex items-end gap-3">
                    <p className={cn(
                      'text-3xl font-black leading-none tracking-tight',
                      hasOffer || isWholesaleDiscount
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-foreground'
                    )}>
                      {formatPrice(displayPrice)}
                    </p>
                    {originalPrice && (
                      <p className="mb-0.5 text-sm text-muted-foreground line-through">
                        {formatPrice(originalPrice)}
                      </p>
                    )}
                  </div>
                  {/* Savings chip */}
                  {originalPrice && discountPct > 0 && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Tag className="h-3 w-3" />
                      Ahorrás {formatPrice(originalPrice - displayPrice)}
                    </p>
                  )}
                </div>

                {/* Installments */}
                {installmentsVisible && (product.installments_plans?.length ?? 0) > 0 && (
                  <InstallmentSelector
                    price={displayPrice}
                    plans={product.installments_plans ?? []}
                    compact
                  />
                )}

                {/* Description */}
                {product.description?.trim() && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {product.description.trim().replace(/\n{3,}/g, '\n\n')}
                  </p>
                )}

              </div>

              {/* ── CTA footer ── */}
              <div className="flex flex-col gap-2 border-t border-border/60 px-5 py-4">
                {commerceMode === 'cart' && (
                  <button
                    type="button"
                    onClick={() => addToCart(true)}
                    disabled={!isInStock}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {justAdded ? (
                      <><Check className="h-4 w-4" /> ¡Agregado al carrito!</>
                    ) : (
                      <><ShoppingCart className="h-4 w-4" /> Agregar al carrito</>
                    )}
                  </button>
                )}
                {commerceMode === 'whatsapp' && whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setQuickViewOpen(false)}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98]"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Consultar por WhatsApp
                  </a>
                )}
                <Link
                  href={productHref}
                  onClick={() => setQuickViewOpen(false)}
                  className="flex h-9 w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-background text-xs font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver detalle completo
                </Link>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
