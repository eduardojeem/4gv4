'use client'

import Image from 'next/image'
import { FavoriteButton } from './Favorites'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  MessageCircle,
  Package,
  ShieldCheck,
  Store,
  Tag,
  X,
  Zap,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { resolveProductImageUrl } from '@/lib/images'
import { galleryWithVariantImages, variantImageIndex } from '@/lib/public/variant-image'
import { getCompanyMapsHref } from '@/lib/website/company-maps-url'
import { formatPrice, cn } from '@/lib/utils'
import { getWhatsAppLink } from '@/lib/whatsapp'
import type { MarketplaceProduct } from '@/lib/public/marketplace'
import { useState, useCallback, useEffect, useMemo } from 'react'
import type { PublicProductVariant } from '@/types/public'
import { resolvePublicVariantPrice } from '@/lib/public/offer-pricing'
import { PublicVariantPicker } from './PublicVariantPicker'
import { StoreSocialLinks } from './StoreSocialLinks'

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  product: MarketplaceProduct | null
  open: boolean
  onClose: () => void
}

// ─── Miniatura (maneja su propio error de imagen) ─────────────────────────────
function Thumb({
  src,
  alt,
  active,
  onClick,
}: {
  src: string
  alt: string
  active: boolean
  onClick: () => void
}) {
  const [err, setErr] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
      )}
      aria-label={alt}
      aria-pressed={active}
    >
      <Image
        src={err ? '/placeholder-product.svg' : src}
        alt={alt}
        fill
        className="object-contain p-1.5"
        sizes="56px"
        onError={() => setErr(true)}
        unoptimized={src.startsWith('data:') || src === '/placeholder-product.svg'}
      />
    </button>
  )
}

const iconButton =
  'flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/90 text-foreground shadow-sm backdrop-blur transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// ─── Componente ───────────────────────────────────────────────────────────────
export function MarketplaceProductModal({ product, open, onClose }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [mainError, setMainError] = useState(false)
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({})

  // Incluye las fotos de las variantes, para que elegir un color muestre la suya.
  const allImages: string[] = product
    ? galleryWithVariantImages(
        [product.image, ...(Array.isArray(product.images) ? product.images : [])],
        product.variants ?? [],
        resolveProductImageUrl,
      ).filter((image) => image !== '/placeholder-product.svg')
    : []

  const hasMultiple = allImages.length > 1
  const currentSrc = allImages[activeIdx] ?? null

  // Resetear índice cuando cambia de producto
  useEffect(() => {
    setActiveIdx(0)
    setMainError(false)
    setSelectedAttrs({})
  }, [product?.id])

  const prev = useCallback(() => { setMainError(false); setActiveIdx((i) => Math.max(0, i - 1)) }, [])
  const next = useCallback(
    () => { setMainError(false); setActiveIdx((i) => Math.min(allImages.length - 1, i + 1)) },
    [allImages.length]
  )

  // Navegación con teclado ← →
  useEffect(() => {
    if (!open || !hasMultiple) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hasMultiple, prev, next])

  const variants = useMemo<PublicProductVariant[]>(
    () => (product?.variants ?? []).filter((variant) => variant.is_active),
    [product?.variants]
  )
  const hasVariants = Boolean(product?.has_variants && variants.length > 0)
  const attributeKeys = useMemo(() => {
    const nonSelectable = new Set(['image_url', 'image', 'photo', 'imageurl'])
    if (product?.variant_attribute_config?.length) {
      return product.variant_attribute_config
        .filter((config) => !nonSelectable.has(config.key.toLowerCase()))
        .map((config) => config.key)
    }
    return Array.from(new Set(variants.flatMap((variant) => Object.keys(variant.attributes ?? {}))))
      .filter((k) => !nonSelectable.has(k.toLowerCase()))
  }, [product?.variant_attribute_config, variants])
  const matchedVariant = useMemo(() => {
    if (!hasVariants || attributeKeys.some((key) => !selectedAttrs[key])) return null
    return variants.find((variant) => attributeKeys.every((key) => variant.attributes[key] === selectedAttrs[key])) ?? null
  }, [attributeKeys, hasVariants, selectedAttrs, variants])

  // La foto sigue a la variante elegida, como en la pagina de detalle.
  const variantImageIdx = useMemo(
    () => variantImageIndex(allImages, matchedVariant, variants, resolveProductImageUrl),
    [allImages, matchedVariant, variants],
  )
  useEffect(() => {
    if (variantImageIdx === -1) return
    setMainError(false)
    setActiveIdx(variantImageIdx)
  }, [variantImageIdx])

  if (!product) return null

  const selectedSalePrice = matchedVariant?.sale_price ?? product.sale_price
  const displayPrice = resolvePublicVariantPrice({ isWholesale: false, product, variant: matchedVariant })
  const hasOffer = displayPrice < selectedSalePrice
  const discountPct = hasOffer
    ? Math.round((1 - displayPrice / selectedSalePrice) * 100)
    : 0
  const savings = hasOffer ? selectedSalePrice - displayPrice : 0

  const stockQuantity = matchedVariant?.stock_quantity ?? product.stock_quantity
  const isInStock = matchedVariant ? matchedVariant.stock_quantity > 0 : product.in_stock
  const isLowStock = isInStock && typeof stockQuantity === 'number' && stockQuantity > 0 && stockQuantity <= 4

  const productHref = `/${product.organization_slug}/productos/${product.id}`
  const storeHref = `/${product.organization_slug}/inicio`

  const mapsHref =
    product.organization_maps_url ||
    getCompanyMapsHref(
      null,
      product.organization_address || (product.organization_city ? `${product.organization_city}, Paraguay` : null)
    )

  const contact = product.organization_contact ?? null
  const whatsappDigits = (contact?.whatsapp ?? '').replace(/\D/g, '')
  const whatsappHref = whatsappDigits.length >= 6
    ? getWhatsAppLink({
        phone: whatsappDigits,
        message: `¡Hola ${product.organization_name}! Vi «${product.name}» en el Marketplace y quería hacer una consulta.`,
      })
    : null
  const hasSocial = Boolean(contact?.instagram || contact?.facebook || contact?.tiktok)
  const description = product.description?.trim().replace(/\n{3,}/g, '\n\n')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/*
        Móvil: una columna que scrollea, con las acciones fijas abajo.
        Escritorio: galería a la izquierda e información a la derecha.
      */}
      <DialogContent
        className="flex max-h-[92dvh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-2xl border bg-background p-0 shadow-2xl focus:outline-none sm:max-w-4xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <DialogDescription className="sr-only">Vista previa del producto. Continuá en la tienda del vendedor para comprar.</DialogDescription>

        <div className="grid min-h-0 flex-1 overflow-y-auto overscroll-contain md:h-[min(620px,calc(92dvh-4.5rem))] md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
          {/* ── Galería ─────────────────────────────────────────────────────── */}
          <div className="flex flex-col border-b bg-muted/30 md:min-h-0 md:border-b-0 md:border-r">
            <div className="relative aspect-square max-h-[42dvh] w-full md:aspect-auto md:max-h-none md:min-h-0 md:flex-1">
              {currentSrc && !mainError ? (
                <Image
                  key={currentSrc}
                  src={currentSrc}
                  alt={`${product.name} — imagen ${activeIdx + 1}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 460px"
                  className="object-contain p-6 transition-opacity duration-300"
                  quality={90}
                  onError={() => setMainError(true)}
                  unoptimized={currentSrc.startsWith('data:') || currentSrc === '/placeholder-product.svg'}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Package className="h-16 w-16 text-muted-foreground/40" aria-hidden="true" />
                </div>
              )}

              <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
                {discountPct > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                    <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                    -{discountPct}%
                  </span>
                )}
                {product.featured && !hasOffer && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                    <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                    Destacado
                  </span>
                )}
              </div>

              <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                {hasMultiple && (
                  <span className="rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur">
                    {activeIdx + 1}/{allImages.length}
                  </span>
                )}
                <button type="button" onClick={onClose} className={iconButton} aria-label="Cerrar">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {hasMultiple && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    disabled={activeIdx === 0}
                    aria-label="Imagen anterior"
                    className={cn(iconButton, 'absolute left-3 top-1/2 z-10 -translate-y-1/2 disabled:pointer-events-none disabled:opacity-0')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    disabled={activeIdx === allImages.length - 1}
                    aria-label="Imagen siguiente"
                    className={cn(iconButton, 'absolute right-3 top-1/2 z-10 -translate-y-1/2 disabled:pointer-events-none disabled:opacity-0')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {!isInStock && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[2px]">
                  <span className="rounded-full bg-foreground px-4 py-1.5 text-xs font-bold text-background shadow">Agotado</span>
                </div>
              )}
            </div>

            {hasMultiple && (
              <div className="flex shrink-0 gap-2 overflow-x-auto border-t bg-background/60 px-3 py-2">
                {allImages.map((src, i) => (
                  <Thumb
                    key={src}
                    src={src}
                    alt={`${product.name} imagen ${i + 1}`}
                    active={i === activeIdx}
                    onClick={() => { setActiveIdx(i); setMainError(false) }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Información ─────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-5 p-4 sm:p-6 md:min-h-0 md:overflow-y-auto">
            <div className="space-y-2">
              {(product.brand || product.category) && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {[product.brand, product.category?.name].filter(Boolean).join(' · ')}
                </p>
              )}
              <h2 className="text-balance text-xl font-bold leading-snug text-foreground sm:text-2xl">
                {product.name}
              </h2>
            </div>

            {/* Precio */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className={cn('text-3xl font-extrabold tracking-tight tabular-nums', hasOffer ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>
                  {formatPrice(displayPrice)}
                </p>
                {hasOffer && (
                  <p className="text-base font-medium tabular-nums text-muted-foreground line-through">
                    {formatPrice(selectedSalePrice)}
                  </p>
                )}
              </div>
              {hasOffer && (
                <p className="inline-flex rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  Ahorrás {formatPrice(savings)}
                </p>
              )}
            </div>

            {/* Disponibilidad + favorito */}
            <div className="flex flex-wrap items-center gap-2">
              {isInStock ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  En stock
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  Agotado
                </span>
              )}
              {isLowStock && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                  Últimas {stockQuantity} unidades
                </span>
              )}
              <div className="ml-auto">
                <FavoriteButton item={{ productId: product.id, slug: product.organization_slug, name: product.name, store: product.organization_name, image: product.image, price: displayPrice }} />
              </div>
            </div>

            {hasVariants && (
              <PublicVariantPicker
                variants={variants}
                config={product.variant_attribute_config}
                selected={selectedAttrs}
                onChange={(key, value) => setSelectedAttrs((current) => ({ ...current, [key]: value }))}
              />
            )}

            {description && (
              <details className="group rounded-xl border bg-muted/20 px-3.5 py-2.5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-foreground">
                  Descripción y características
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
                </summary>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </details>
            )}

            {/* Vendedor: quién vende, dónde está y por dónde seguirlo */}
            <section aria-label={`Vendido por ${product.organization_name}`} className="space-y-3 rounded-xl border p-3.5">
              <div className="flex items-center gap-3">
                <Link
                  href={storeHref}
                  onClick={onClose}
                  className="group flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-background">
                    {product.organization_logo_url ? (
                      <Image
                        src={resolveProductImageUrl(product.organization_logo_url)}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <Store className="h-5 w-5 text-primary" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] text-muted-foreground">Vendido por</span>
                    <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">
                      {product.organization_name}
                    </span>
                  </span>
                </Link>
                {mapsHref ? (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
                    title={product.organization_address ? `${product.organization_address}${product.organization_city ? ` - ${product.organization_city}` : ''}` : 'Abrir ubicación en Google Maps'}
                  >
                    <MapPin className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
                    <span className="max-w-[110px] truncate">{product.organization_city || 'Ubicación'}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  </a>
                ) : product.organization_city ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {product.organization_city}
                  </span>
                ) : null}
              </div>

              {(hasSocial || whatsappHref) && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  {hasSocial ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Seguila en</span>
                      <StoreSocialLinks company={contact} companyName={product.organization_name} variant="icon" />
                    </div>
                  ) : <span />}
                  {whatsappHref && (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366]/10 px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#25D366] hover:text-white dark:text-[#4ADE80]"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      Consultar por WhatsApp
                    </a>
                  )}
                </div>
              )}

              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                La compra se hace en la tienda del vendedor.
              </p>
            </section>
          </div>
        </div>

        {/* Acciones: siempre visibles y siempre hacia la tienda del vendedor. */}
        <div className="grid shrink-0 gap-2 border-t bg-background px-4 py-3 sm:grid-cols-2 sm:px-6">
          <Link
            href={productHref}
            onClick={onClose}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:order-2"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span>Ver detalle en la tienda</span>
          </Link>
          <Link
            href={storeHref}
            onClick={onClose}
            className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:order-1"
          >
            <Store className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">Visitar {product.organization_name}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
