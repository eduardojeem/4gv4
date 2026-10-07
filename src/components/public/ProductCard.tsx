'use client'

import { useMemo, useState } from 'react'
import { FavoriteButton } from './Favorites'
import Link from 'next/link'
import { AppImage as Image } from '@/components/ui/app-image'
import { ArrowRight, Check, ChevronLeft, ChevronRight, CreditCard, Eye, MapPin, MessageCircle, Minus, Package, Plus, ShoppingCart, Sparkles, Tag, TrendingDown, Zap } from 'lucide-react'
import { PublicProduct } from '@/types/public'
import { buildCreditInstallmentPlan } from '@/lib/credits/installments'
import { InstallmentSelector } from '@/components/public/InstallmentSelector'
import { usePathname } from 'next/navigation'
import { formatPrice, cn } from '@/lib/utils'
import { resolveProductImageUrl, shouldBypassImageOptimization } from '@/lib/images'
import { galleryWithVariantImages, variantImageIndex } from '@/lib/public/variant-image'
import { usePublicCart } from '@/hooks/use-public-cart'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useStorefrontStyle } from '@/components/public/storefront-style-context'
import { usesPortraitMedia } from '@/lib/website/storefront-style'
import { getWhatsAppLink, buildProductWhatsAppMessage } from '@/lib/whatsapp'
import { resolvePublicVariantPrice } from '@/lib/public/offer-pricing'
import { hidesPublicPrice } from '@/lib/products/price-visibility'
import { PriceAccessDialog } from '@/components/public/PriceAccessDialog'
import { describeDeviceCompatibility } from '@/lib/products/device-compatibility'
import { siteUrl } from '@/lib/site-url'
import { marketUnitLabel } from '@/lib/public/market'

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
  const { addProduct, items: cartItems, setQuantity: setCartQuantity } = usePublicCart()
  const { settings: websiteSettings, isLoading: isLoadingWebsiteSettings } = useWebsiteSettings()
  const pathname = usePathname()
  // Error de la foto de la tarjeta. El detalle lleva su propia lista: antes
  // compartían el estado y una foto rota de la galería dejaba la tarjeta sin
  // imagen hasta recargar.
  const [imageError, setImageError] = useState(false)
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set())
  const markImageFailed = (src: string) => setFailedImages((current) => (current.has(src) ? current : new Set(current).add(src)))
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const storefrontStyle = useStorefrontStyle()
  // Supermercado: compra rápida con cantidades en la misma tarjeta.
  const isMarket = storefrontStyle === 'market'
  const unitLabel = isMarket ? marketUnitLabel(product.unit_measure) : null

  // Publicado sin precio: donde iba el precio va un boton que abre WhatsApp.
  // El precio real no se muestra en ningun lado, ni siquiera en el mensaje.
  const precioOculto = hidesPublicPrice(product)

  // Para que telefono sirve el repuesto: «Apple - iPhone 13, 13 Pro».
  const deviceCompatibility = describeDeviceCompatibility(product.device_brand, product.device_models)

  // La galeria incluye las fotos de las variantes: sin eso, elegir un color no
  // tenia ninguna foto que mostrar.
  const publicVariants = useMemo(() => (product.variants ?? []).filter((variant) => variant.is_active), [product.variants])
  const galleryImages = useMemo(() => galleryWithVariantImages(
    [product.image, ...(Array.isArray(product.images) ? product.images : [])],
    publicVariants,
  ), [product.image, product.images, publicVariants])
  const activeImage = galleryImages[activeImageIdx] ?? null
  const resolvedActive = resolveProductImageUrl(activeImage)

  // The server only includes wholesale_price after validating access for the
  // current organization. Never infer storefront pricing from dashboard roles.
  const isWholesale = props.isWholesale ?? product.wholesale_price != null

  // ── Price logic ──────────────────────────────────────────────────────────
  const hasOffer =
    !isWholesale &&
    product.offer_price != null &&
    product.offer_price > 0 &&
    product.offer_price < product.sale_price

  const isWholesaleDiscount =
    isWholesale &&
    product.wholesale_price != null &&
    product.wholesale_price < product.sale_price

  // La misma función que usa el checkout: si la vitrina y el cobro calcularan
  // por separado, vuelven a divergir como pasaba con el precio mayorista.
  const displayPrice = resolvePublicVariantPrice({ isWholesale, product, variant: null })
  const hasVariants = Boolean(product.has_variants && publicVariants.length > 0)
  const selectedVariant = publicVariants.find((variant) => variant.id === selectedVariantId) ?? null

  const handleVariantSelect = (variantId: string) => {
    setSelectedVariantId(variantId)
    setQuantity(1)
    if (variantId === selectedVariantId) return
    const nextVariant = publicVariants.find((variant) => variant.id === variantId) ?? null
    const variantImageIdx = variantImageIndex(galleryImages, nextVariant, publicVariants)
    if (variantImageIdx === -1) return
    setActiveImageIdx(variantImageIdx)
  }
  const selectedPrice = selectedVariant
    ? resolvePublicVariantPrice({ isWholesale, product, variant: selectedVariant })
    : displayPrice
  const selectedStock = hasVariants
    ? (selectedVariant ? selectedVariant.stock_quantity : product.stock_quantity)
    : product.stock_quantity

  const originalPrice = hasOffer || isWholesaleDiscount ? product.sale_price : null
  const discountPct = originalPrice
    ? Math.round(((originalPrice - displayPrice) / originalPrice) * 100)
    : 0
  const selectedOriginalPrice = selectedVariant && hasOffer
    ? selectedVariant.sale_price
    : originalPrice
  const selectedDiscountPct = selectedOriginalPrice && selectedPrice < selectedOriginalPrice
    ? Math.round(((selectedOriginalPrice - selectedPrice) / selectedOriginalPrice) * 100)
    : 0

  const isInStock = hasVariants
    ? (selectedVariant ? selectedVariant.stock_quantity > 0 : publicVariants.some((variant) => variant.stock_quantity > 0))
    : Boolean(product.in_stock && (product.stock_quantity ?? 0) > 0 || product.in_stock)
  const isLowStock = isInStock && (hasVariants ? selectedStock > 0 && selectedStock <= 4 : product.stock_quantity > 0 && product.stock_quantity <= 4)
  const imageSrc = resolveProductImageUrl(product.image)
  // Moda y deportivo: foto vertical a sangre, como en una tienda de ropa. El
  // placeholder se sigue mostrando entero para no recortarlo.
  const portraitMedia = usesPortraitMedia(storefrontStyle)
  const coverImage = portraitMedia && imageSrc !== '/placeholder-product.svg'

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
  const favoriteSlug = tenantSlug || websiteSettings?.company_info.slug
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''

  const productHref = `${tenantPrefix}/productos/${product.id}`
  const commerceMode = websiteSettings?.checkout.commerceMode ??
    (isLoadingWebsiteSettings ? 'catalog' : 'cart')
  const contactPhone =
    websiteSettings?.company_info.whatsapp?.trim() ||
    websiteSettings?.company_info.phone?.trim() ||
    ''

  const storeName = websiteSettings?.company_info.name || null
  const fullProductUrl = siteUrl(productHref)

  const whatsappHref = contactPhone
    ? getWhatsAppLink({
        phone: contactPhone,
        message: buildProductWhatsAppMessage({
          storeName,
          productName: product.name,
          price: precioOculto ? 0 : displayPrice,
          originalPrice: !precioOculto && originalPrice && originalPrice > displayPrice ? originalPrice : null,
          sku: product.sku,
          inStock: isInStock,
          stockQuantity: product.stock_quantity,
          installmentText: !precioOculto && maxInstallment ? `${maxInstallment.count} cuotas de ${formatPrice(maxInstallment.perInstallment)}` : null,
          productUrl: fullProductUrl,
          imageUrl: product.image ? resolveProductImageUrl(product.image) : null,
          intent: precioOculto ? 'price' : 'inquiry',
        }),
      })
    : null

  // Quick view modal WhatsApp message incorporating the exact selected variant, quantity & calculated total
  const selectedVariantInStock = hasVariants
    ? Boolean(selectedVariant && selectedVariant.stock_quantity > 0)
    : isInStock

  const modalWhatsappHref = contactPhone
    ? getWhatsAppLink({
        phone: contactPhone,
        message: buildProductWhatsAppMessage({
          storeName,
          productName: product.name,
          price: precioOculto ? 0 : selectedPrice,
          originalPrice: !precioOculto && selectedOriginalPrice && selectedOriginalPrice > selectedPrice ? selectedOriginalPrice : null,
          sku: selectedVariant?.sku || product.sku,
          variantName: selectedVariant?.variant_name,
          attributes: selectedVariant?.attributes,
          quantity,
          inStock: selectedVariantInStock,
          stockQuantity: selectedStock,
          installmentText: !precioOculto && maxInstallment ? `${maxInstallment.count} cuotas de ${formatPrice(maxInstallment.perInstallment)}` : null,
          productUrl: fullProductUrl,
          imageUrl: resolvedActive || (product.image ? resolveProductImageUrl(product.image) : null),
          intent: precioOculto ? 'price' : selectedVariantInStock ? 'order' : 'inquiry',
        }),
      })
    : null

  // La línea del carrito de este producto (sin variantes): la tarjeta del súper
  // muestra cuántos hay y deja sumar o restar sin abrir nada.
  const cartLine = isMarket && !hasVariants ? cartItems.find((item) => item.cartItemId === product.id) ?? null : null
  const changeCartQuantity = (next: number) => {
    if (!cartLine) return
    if (cartLine.availableStock != null && next > cartLine.availableStock) {
      toast.info(`Ya agregaste el máximo disponible (${cartLine.availableStock}).`)
      return
    }
    setCartQuantity(cartLine.cartItemId, next)
  }

  // ── Handlers ────────────────────────────────────────────────────────────
  function addToCart(closeModal = false) {
    if (commerceMode !== 'cart') return
    if (hasVariants && (!closeModal || !selectedVariant)) {
      setQuickViewOpen(true)
      if (!selectedVariant) toast.info('Elegí una variante para continuar.')
      return
    }
    if (!isInStock) {
      toast.error('Producto sin stock')
      return
    }
    const result = addProduct(product, Number(selectedPrice || 0), closeModal ? quantity : 1, selectedVariant)
    if (result.limited) {
      toast.info(`Ya agregaste el máximo disponible (${result.quantity}).`)
      return
    }
    toast.success('¡Agregado al carrito!')
    if (closeModal) { setQuickViewOpen(false); setQuantity(1); setActiveImageIdx(0); setSelectedVariantId(null) }
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1500)
  }

  return (
    <>
      {/* ── Card ── */}
      <article
        className={cn(
          'group relative flex flex-col overflow-hidden bg-card transition-all duration-300',
          storefrontStyle === 'classic' && 'rounded-lg border border-border/60 shadow-sm hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10',
          storefrontStyle === 'fashion' && 'rounded-none border border-transparent hover:border-border/60 hover:shadow-md',
          storefrontStyle === 'sport' && 'rounded-md border border-border/60 hover:border-foreground/40 hover:shadow-md',
          storefrontStyle === 'tech' && 'rounded-xl border border-primary/20 shadow-xs hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10',
          storefrontStyle === 'market' && 'rounded-2xl border border-border/70 shadow-2xs hover:border-primary/60 hover:shadow-md',
          storefrontStyle === 'modern' && 'rounded-2xl border border-border/40 shadow-xs hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-0.5',
          storefrontStyle === 'beauty' && 'rounded-3xl border border-pink-100 shadow-xs hover:border-pink-300 hover:shadow-lg hover:shadow-pink-500/10 dark:border-pink-900/40',
          storefrontStyle === 'services' && 'rounded-2xl border border-border/50 shadow-xs hover:border-primary/40 hover:shadow-lg',
          !isInStock && 'opacity-60 grayscale-[30%]'
        )}
      >
        {favoriteSlug && <div className="absolute right-2 top-2 z-20"><FavoriteButton item={{ productId: product.id, slug: favoriteSlug, name: product.name, store: websiteSettings?.company_info.name || favoriteSlug, image: product.image, price: product.sale_price }} /></div>}
        {/* ── Image area ── */}
        <button
          type="button"
          onClick={() => setQuickViewOpen(true)}
          className={cn(
            'relative overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
            // Cosmética y súper: el envase sobre blanco, en cuadrado.
            storefrontStyle === 'beauty' || isMarket ? 'aspect-square bg-white' : 'bg-muted/30',
            storefrontStyle !== 'beauty' && !isMarket && (portraitMedia ? 'aspect-[3/4]' : 'aspect-[4/3]')
          )}
          aria-label={`Vista rápida de ${product.name}`}
        >
          {imageSrc && !imageError ? (
            <Image
              src={imageSrc}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={
                coverImage
                  ? 'object-cover transition-transform duration-700 group-hover:scale-[1.03]'
                  : 'object-contain p-4 transition-transform duration-500 group-hover:scale-[1.06]'
              }
              priority={priority}
              quality={75}
              onError={() => setImageError(true)}
              unoptimized={shouldBypassImageOptimization(imageSrc)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground/20" />
            </div>
          )}

          {/* Badges — top left */}
          <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1.5">
            {discountPct > 0 && isMarket && (
              <span className="flex h-11 w-11 flex-col items-center justify-center rounded-full bg-red-600 leading-none text-white shadow-md" aria-label={`${discountPct}% de descuento`}>
                <span className="text-sm font-black">{discountPct}%</span>
                <span className="text-[8px] font-black tracking-wider">OFF</span>
              </span>
            )}
            {discountPct > 0 && !isMarket && (
              <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-red-600 px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow-xs">
                <Tag className="h-2.5 w-2.5" />
                -{discountPct}%
              </span>
            )}
            {product.featured && !hasOffer && (
              <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow-xs">
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
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px] z-10">
              <span className={cn(
                'rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-widest shadow-md',
                storefrontStyle === 'fashion'
                  ? 'bg-foreground text-background'
                  // Rojo fijo: el `destructive` del tema se aclara en oscuro y
                  // el blanco encima quedaba en 4,07 (hace falta 4,5).
                  : 'bg-red-700/95 text-white'
              )}>
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
        <div className={cn('flex flex-1 flex-col gap-1.5 px-3.5 pb-3.5 pt-3', isMarket && 'items-center gap-1 px-3 pb-3 pt-2 text-center')}>
          {/* Brand · Category */}
          {!isMarket && (product.brand || product.category) && (
            <p className="truncate text-[11px] font-medium text-muted-foreground">
              {[product.brand, product.category?.name].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* Para que celular sirve: en un repuesto es el dato que decide la compra. */}
          {deviceCompatibility && (
            <p className="truncate text-[11px] font-semibold text-primary" title={deviceCompatibility}>
              Para {deviceCompatibility}
            </p>
          )}

          {isMarket && !precioOculto && (
            <div className="order-first min-w-0">
              {originalPrice && (
                <p className="text-xs text-muted-foreground line-through tabular-nums">{formatPrice(originalPrice)}</p>
              )}
              <p className={cn('text-xl font-black leading-tight tracking-tight tabular-nums', hasOffer || isWholesaleDiscount ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
                {formatPrice(displayPrice)}
              </p>
              {unitLabel && <p className="text-[11px] font-semibold text-muted-foreground">{unitLabel}</p>}
            </div>
          )}

          {/* Product name */}
          <h3 className={cn(
            'line-clamp-2 flex-1 text-sm leading-snug text-foreground',
            storefrontStyle === 'classic' && 'font-semibold',
            storefrontStyle === 'fashion' && 'font-bold group-hover:text-primary transition-colors',
            storefrontStyle === 'sport' && 'font-bold uppercase tracking-tight',
            storefrontStyle === 'tech' && 'font-semibold tracking-tight group-hover:text-primary transition-colors',
            storefrontStyle === 'market' && 'font-bold text-xs sm:text-sm',
            storefrontStyle === 'modern' && 'font-bold tracking-tight text-foreground/90',
            storefrontStyle === 'services' && 'font-semibold',
            storefrontStyle === 'beauty' && 'group-hover:text-pink-700 transition-colors dark:group-hover:text-pink-300'
          )}>
            {product.name}
          </h3>
          {isMarket && product.category && (
            <p className="truncate text-[11px] text-muted-foreground">{product.category.name}</p>
          )}

          {/* Price row */}
          {precioOculto ? (
            <div
              className="mt-2 min-w-0"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-bold leading-tight text-foreground">Precio a consultar</p>
              <div className="relative z-20 mt-0.5">
                <PriceAccessDialog productName={product.name} whatsappHref={whatsappHref} />
              </div>
            </div>
          ) : isMarket ? null : (
          <div className="mt-2 min-w-0">
            <p
              className={cn(
                'text-lg font-bold leading-tight',
                // En deporte, con la misma tipografía de los títulos.
                storefrontStyle === 'sport' && 'font-black italic tracking-tight',
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
          )}

          {/* Súper: «Agregar» a lo ancho; ya en el carrito, se cambia la cantidad ahí mismo. */}
          {isMarket && !precioOculto && commerceMode === 'cart' ? (
            <div
              className="relative z-20 mt-2 w-full"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {cartLine ? (
                <div className="flex h-10 items-center justify-between rounded-full bg-primary/10 p-1 ring-1 ring-primary/30" role="group" aria-label={`Cantidad de ${product.name} en el carrito`}>
                  <button
                    type="button"
                    onClick={() => changeCartQuantity(cartLine.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-background text-primary shadow-xs transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={cartLine.quantity === 1 ? `Quitar ${product.name} del carrito` : `Quitar uno de ${product.name}`}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-base font-black tabular-nums text-foreground" aria-live="polite">
                    {cartLine.quantity}<span className="sr-only"> en el carrito</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => changeCartQuantity(cartLine.quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    aria-label={`Sumar uno de ${product.name}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => addToCart(false)}
                  disabled={!isInStock}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-black uppercase tracking-wide text-primary-foreground shadow-xs shadow-primary/20 transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={hasVariants ? `Elegir opción de ${product.name}` : `Agregar ${product.name} al carrito`}
                >
                  <ShoppingCart className="h-4 w-4 shrink-0" />
                  {!isInStock ? 'Sin stock' : hasVariants ? 'Elegir' : 'Agregar'}
                </button>
              )}
            </div>
          ) : (
          <div
            className="mt-3 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Link
              href={productHref}
              className="relative z-20 flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background text-xs font-bold text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-[0.98]"
              aria-label={`Ver detalle de ${product.name}`}
            >
              <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>Ver detalle</span>
            </Link>

            {/* Sin precio publicado no se puede comprar: se pregunta. */}
            {precioOculto && whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                suppressHydrationWarning
                className="relative z-20 flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-500 active:scale-[0.98] shadow-emerald-600/20"
                aria-label={`Preguntar el precio de ${product.name} por WhatsApp`}
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Preguntar</span>
              </a>
            )}

            {!precioOculto && commerceMode === 'cart' && (
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

            {!precioOculto && commerceMode === 'whatsapp' && whatsappHref && (
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
          )}
        </div>
      </article>

      {/* ── Detalle rápido: mismo diseño que el detalle de ofertas ── */}
      <Dialog open={quickViewOpen} onOpenChange={(open) => { setQuickViewOpen(open); if (!open) { setActiveImageIdx(0); setQuantity(1); setSelectedVariantId(null) } }}>
        <DialogContent
          className="flex max-h-[92dvh] w-[calc(100%-1rem)] sm:max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-border/80 p-0 shadow-2xl"
          showCloseButton
        >
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
          <DialogDescription className="sr-only">Imágenes, precio, disponibilidad y opciones de compra del producto.</DialogDescription>

          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {/* ── Galería ── */}
            <div className="relative border-b border-border/60 bg-muted/30">
              <div className="relative h-52 overflow-hidden sm:h-64">
                {resolvedActive && resolvedActive !== '/placeholder-product.svg' && !failedImages.has(resolvedActive) ? (
                  <Image
                    key={resolvedActive}
                    src={resolvedActive}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 640px"
                    className="object-contain p-4 transition-opacity duration-200"
                    quality={75}
                    onError={() => markImageFailed(resolvedActive)}
                    unoptimized={shouldBypassImageOptimization(resolvedActive)}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-16 w-16 text-muted-foreground/30" />
                  </div>
                )}

                <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
                  {discountPct > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 via-red-500 to-amber-500 px-3 py-1 text-xs font-black tracking-wide text-white shadow-md">
                      <TrendingDown className="h-3.5 w-3.5" />
                      -{discountPct}% OFF
                    </span>
                  )}
                  {product.featured && !hasOffer && (
                    <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow-md">
                      <Sparkles className="h-3 w-3" />
                      Destacado
                    </span>
                  )}
                </div>

                {!isInStock && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
                    <span className="rounded-full bg-red-700/95 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-white shadow-md">
                      Sin stock
                    </span>
                  </div>
                )}

                {galleryImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Imagen anterior"
                      onClick={(e) => { e.stopPropagation(); setActiveImageIdx((i) => (i - 1 + galleryImages.length) % galleryImages.length) }}
                      className="absolute left-3 top-1/2 z-30 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 shadow-md backdrop-blur-sm transition hover:bg-background"
                    >
                      <ChevronLeft className="h-4 w-4 text-foreground" />
                    </button>
                    <button
                      type="button"
                      aria-label="Imagen siguiente"
                      onClick={(e) => { e.stopPropagation(); setActiveImageIdx((i) => (i + 1) % galleryImages.length) }}
                      className="absolute right-3 top-1/2 z-30 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 shadow-md backdrop-blur-sm transition hover:bg-background"
                    >
                      <ChevronRight className="h-4 w-4 text-foreground" />
                    </button>
                  </>
                )}
              </div>

              {galleryImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto border-t border-border/40 bg-background/50 px-4 py-2">
                  {galleryImages.map((image, i) => {
                    const thumb = resolveProductImageUrl(image)
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Ver imagen ${i + 1}`}
                        aria-pressed={i === activeImageIdx}
                        onClick={() => setActiveImageIdx(i)}
                        className={cn(
                          'relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          i === activeImageIdx
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-border/70 opacity-70 hover:border-foreground/30 hover:opacity-100'
                        )}
                      >
                        {/* Miniaturas sin el optimizador: cada una era una transformación
                            nueva (pedía 1536 px para un cuadro de 48) y sin cuota
                            disponible en el servidor quedaban en blanco. */}
                        {thumb !== '/placeholder-product.svg' && !failedImages.has(thumb) ? (
                          <Image src={thumb} alt="" fill sizes="48px" unoptimized className="object-contain p-1" onError={() => markImageFailed(thumb)} />
                        ) : (
                          <Package className="m-auto h-5 w-5 text-muted-foreground/40" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Información ── */}
            <div className="flex flex-col gap-4 p-4 sm:p-6">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {product.brand && (
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{product.brand}</p>
                  )}
                  <h2 className="mt-1 text-lg font-bold leading-snug text-foreground sm:text-xl">{product.name}</h2>
                  {deviceCompatibility && (
                    <p className="mt-1 text-xs font-semibold text-primary">Para {deviceCompatibility}</p>
                  )}
                  {(selectedVariant?.sku || product.sku) && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">SKU: {selectedVariant?.sku || product.sku}</p>
                  )}
                </div>
                {favoriteSlug && <FavoriteButton item={{ productId: product.id, slug: favoriteSlug, name: product.name, store: websiteSettings?.company_info.name || favoriteSlug, image: product.image, price: product.sale_price }} />}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  isInStock
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50'
                    : 'bg-destructive/10 text-destructive ring-1 ring-destructive/20'
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', isInStock ? 'animate-pulse bg-emerald-500' : 'bg-destructive')} />
                  {hasVariants && !selectedVariant
                    ? 'Elegí una variante'
                    : isInStock
                      ? (hasVariants && selectedVariant ? `${selectedVariant.stock_quantity} disponibles` : 'Disponible para entrega inmediata')
                      : 'Agotado'}
                </span>
                {isLowStock && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:ring-amber-800/40">
                    Últimas {selectedStock} uds.
                  </span>
                )}
                {product.category && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground ring-1 ring-border/70">
                    {product.category.name}
                  </span>
                )}
                {branchLabel && (
                  <span title={branchTitle} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground ring-1 ring-border/70">
                    <MapPin className="h-3 w-3 text-primary" />
                    {branchLabel}
                  </span>
                )}
              </div>

              {/* ── Precio ── */}
              {precioOculto ? (
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <p className="text-xl font-bold leading-none tracking-tight text-foreground">Precio a consultar</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Este producto se cotiza por WhatsApp. Escribinos y te pasamos el precio al instante.
                  </p>
                </div>
              ) : (
                <div className={cn(
                  'rounded-2xl border p-4',
                  selectedDiscountPct > 0 || discountPct > 0
                    ? 'border-amber-500/25 bg-gradient-to-br from-amber-500/[0.07] via-rose-500/[0.04] to-transparent dark:border-amber-500/20'
                    : 'border-border/70 bg-muted/30'
                )}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-2xl font-black tabular-nums tracking-tight text-foreground sm:text-3xl">
                      {formatPrice(selectedPrice)}
                    </span>
                    {selectedOriginalPrice && selectedPrice < selectedOriginalPrice && (
                      <del className="text-sm font-semibold tabular-nums text-muted-foreground sm:text-base">
                        {formatPrice(selectedOriginalPrice)}
                      </del>
                    )}
                    {selectedDiscountPct > 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                        <TrendingDown className="h-3 w-3" />
                        -{selectedDiscountPct}%
                      </span>
                    )}
                  </div>
                  {selectedOriginalPrice && selectedDiscountPct > 0 && (
                    <p className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <Tag className="h-3.5 w-3.5" />
                      ¡Ahorrás {formatPrice(selectedOriginalPrice - selectedPrice)} en esta compra!
                    </p>
                  )}
                  {isWholesale && (
                    <p className="mt-1.5 text-[11px] font-semibold text-primary">Precio mayorista</p>
                  )}
                </div>
              )}

              {hasVariants && (
                <fieldset className="space-y-2.5 rounded-2xl border border-border/70 bg-card/60 p-3.5">
                  <div className="flex items-center justify-between">
                    <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Variantes disponibles <span className="text-rose-500">*</span>
                    </legend>
                    {selectedVariant && (
                      <span className="text-xs font-semibold text-primary">{selectedVariant.variant_name}</span>
                    )}
                  </div>
                  <div className="grid max-h-44 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {publicVariants.map((variant) => {
                      const isSelected = selectedVariantId === variant.id
                      const hasStock = variant.stock_quantity > 0
                      const variantPrice = resolvePublicVariantPrice({ isWholesale, product, variant })
                      const variantOriginalPrice = hasOffer && variantPrice < variant.sale_price ? variant.sale_price : null
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => handleVariantSelect(variant.id)}
                          aria-pressed={isSelected}
                          className={cn(
                            'flex flex-col justify-between rounded-xl border p-2.5 text-left text-xs transition-all',
                            isSelected
                              ? 'border-primary bg-primary/10 text-foreground shadow-xs ring-2 ring-primary/20'
                              : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/40',
                            !hasStock && 'bg-muted/40 opacity-60'
                          )}
                        >
                          <span className="flex items-start justify-between gap-1">
                            <span className="line-clamp-1 font-semibold leading-tight">{variant.variant_name}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                          </span>
                          <span className="mt-1.5 flex items-center justify-between gap-1 text-[11px]">
                            <span className={hasStock ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                              {hasStock ? `${variant.stock_quantity} disp.` : 'Sin stock'}
                            </span>
                            {!precioOculto && (
                              <span className="flex flex-col items-end leading-tight">
                                <span className={cn('font-bold', variantOriginalPrice ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>
                                  {formatPrice(variantPrice)}
                                </span>
                                {variantOriginalPrice && (
                                  <span className="text-[10px] text-muted-foreground line-through">{formatPrice(variantOriginalPrice)}</span>
                                )}
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {!selectedVariant && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Seleccioná una variante para continuar.</p>
                  )}
                </fieldset>
              )}

              {!precioOculto && installmentsVisible && (product.installments_plans?.length ?? 0) > 0 && (
                <InstallmentSelector price={selectedPrice * quantity} plans={product.installments_plans ?? []} compact />
              )}

              {product.description?.trim() && (
                // Plegada: el detalle rápido prioriza precio, variantes y compra.
                <details className="group rounded-xl border border-border/70 bg-card/60 p-3.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Descripción y detalles
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {product.description.trim().replace(/\n{3,}/g, '\n\n')}
                  </p>
                </details>
              )}
            </div>
          </div>

          {/* ── Acciones, siempre a la vista ── */}
          <div className="flex shrink-0 flex-col gap-2.5 border-t border-border/70 bg-background p-4">
            {!precioOculto && commerceMode === 'cart' && isInStock && (!hasVariants || selectedVariant) && (
              <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
                <span className="text-muted-foreground">Cantidad:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Reducir cantidad"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/40 hover:bg-muted disabled:opacity-40"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span aria-live="polite" className="w-8 text-center font-bold tabular-nums text-foreground">{quantity}</span>
                  <button
                    type="button"
                    aria-label="Aumentar cantidad"
                    disabled={quantity >= selectedStock}
                    onClick={() => setQuantity((q) => Math.min(selectedStock, q + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/40 hover:bg-muted disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            {precioOculto && (
              <PriceAccessDialog productName={product.name} whatsappHref={modalWhatsappHref || whatsappHref} variant="button" />
            )}

            <div className="flex flex-col items-stretch gap-2 pt-1 sm:flex-row">
              {precioOculto ? (
                (modalWhatsappHref || whatsappHref) && (
                  <a
                    href={(modalWhatsappHref || whatsappHref)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setQuickViewOpen(false)}
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-[0.98]"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Preguntar el precio
                  </a>
                )
              ) : commerceMode === 'cart' ? (
                <button
                  type="button"
                  onClick={() => addToCart(true)}
                  disabled={!isInStock || (hasVariants && !selectedVariant)}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {justAdded ? (
                    <><Check className="h-4 w-4" /> ¡Agregado al carrito!</>
                  ) : hasVariants && !selectedVariant ? (
                    <><ShoppingCart className="h-4 w-4" /> Elegí una variante para agregar</>
                  ) : (
                    <><ShoppingCart className="h-4 w-4" /> Agregar al carrito · {formatPrice(selectedPrice * quantity)}</>
                  )}
                </button>
              ) : (modalWhatsappHref || whatsappHref) ? (
                <a
                  href={(modalWhatsappHref || whatsappHref)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setQuickViewOpen(false)}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-[0.98]"
                >
                  <MessageCircle className="h-4 w-4" />
                  {selectedVariantInStock ? 'Pedir por WhatsApp' : 'Consultar por WhatsApp'}
                </a>
              ) : null}

              <Link
                href={productHref}
                onClick={() => setQuickViewOpen(false)}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background px-4 text-xs font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98] sm:text-sm"
              >
                Ver detalle completo
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
