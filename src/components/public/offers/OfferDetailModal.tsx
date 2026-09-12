'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  MessageCircle,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Sparkles,
  Tag,
  TrendingDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { PublicVariantPicker } from '@/components/public/PublicVariantPicker'
import { usePublicCart } from '@/hooks/use-public-cart'
import { formatCurrency } from '@/lib/currency'
import { resolveProductImageUrl } from '@/lib/images'
import { resolveOfferPrice } from '@/lib/public/offer-pricing'
import { cn } from '@/lib/utils'
import { getWhatsAppLink } from '@/lib/whatsapp'
import type { PublicProduct } from '@/types/public'
import type { PublicCommerceMode } from '@/types/website-settings'

/**
 * Detalle de una oferta en un modal: galeria, variantes, precio efectivo y la
 * accion de compra segun el modo de venta de la tienda.
 *
 * Vive aparte de /ofertas porque el mismo detalle se abre desde el carrusel de
 * «Ofertas especiales» del inicio, que comparte las tarjetas con esa pagina.
 */

export interface OfferDetailVariant {
  id: string
  product_id: string
  variant_name: string
  attributes: Record<string, string>
  sku: string | null
  sale_price: number
  offer_price?: number | null
  stock_quantity: number
  is_active: boolean
}

export interface OfferDetailAttributeConfig {
  key: string
  label: string
  control: 'text' | 'number' | 'select' | 'color'
  options: string[]
}

export interface OfferDetailProduct {
  id: string
  name: string
  brand: string | null
  description: string | null
  sale_price: number
  offer_price: number
  has_offer: boolean
  in_stock: boolean
  stock_quantity: number
  featured: boolean
  image: string | null
  images: string[] | null
  category?: { id: string; name: string }
  created_at: string | null
  // Variantes
  has_variants?: boolean
  variant_attribute_config?: OfferDetailAttributeConfig[]
  variants?: OfferDetailVariant[]
}

function formatPrice(price: number): string {
  return formatCurrency(price)
}

function calcDiscount(sale: number, offer: number): number {
  if (sale <= 0 || offer >= sale) return 0
  return Math.round(((sale - offer) / sale) * 100)
}

export function OfferDetailModal({
  offer,
  isOpen,
  onClose,
  tenantPrefix,
  commerceMode,
  contactPhone,
}: {
  offer: OfferDetailProduct | null
  isOpen: boolean
  onClose: () => void
  tenantPrefix: string
  commerceMode: PublicCommerceMode
  contactPhone: string
}) {
  const { addProduct } = usePublicCart()
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [addedToCart, setAddedToCart] = useState(false)
  // Variant selection: map attribute key → chosen option value
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({})

  // Reset state when offer changes
  const hasVariants = Boolean(offer?.has_variants && offer?.variants && offer.variants.length > 0)

  // Find matching variant from selected attributes
  const activeVariants = offer?.variants?.filter((v) => v.is_active && v.stock_quantity > 0) ?? []
  const allVariants = offer?.variants?.filter((v) => v.is_active) ?? []


  const attributeKeys: string[] = useMemo(() => {
    const nonSelectable = new Set(['image_url', 'image', 'photo', 'imageurl'])
    if (!offer?.variant_attribute_config || offer.variant_attribute_config.length === 0) {
      // Fallback: derive from variants themselves
      const keys = new Set<string>()
      for (const v of allVariants) {
        for (const k of Object.keys(v.attributes)) {
          if (!nonSelectable.has(k.toLowerCase())) keys.add(k)
        }
      }
      return Array.from(keys)
    }
    return offer.variant_attribute_config
      .filter((c) => !nonSelectable.has(c.key.toLowerCase()))
      .map((c) => c.key)
  }, [offer?.variant_attribute_config, allVariants])

  // Matched variant (exact match on all keys)
  const matchedVariant: OfferDetailVariant | null = useMemo(() => {
    if (!hasVariants || attributeKeys.length === 0) return null
    const allSelected = attributeKeys.every((k) => Boolean(selectedAttrs[k]))
    if (!allSelected) return null
    return allVariants.find((v) =>
      attributeKeys.every((k) => v.attributes[k] === selectedAttrs[k])
    ) ?? null
  }, [hasVariants, attributeKeys, selectedAttrs, allVariants])

  const selectionComplete = !hasVariants || attributeKeys.every((k) => Boolean(selectedAttrs[k]))

  // Effective price/stock (from variant if matched, else from offer base)
  const effectivePrice = matchedVariant
    ? (matchedVariant.offer_price != null && matchedVariant.offer_price < matchedVariant.sale_price
        ? matchedVariant.offer_price
        : resolveOfferPrice(offer.sale_price, offer.offer_price, matchedVariant.sale_price))
    : offer?.offer_price ?? 0
  const effectiveStock = matchedVariant ? matchedVariant.stock_quantity : (offer?.stock_quantity ?? 0)
  const effectiveInStock = matchedVariant ? matchedVariant.stock_quantity > 0 : (offer?.in_stock ?? false)

  if (!offer) return null

  const discount = calcDiscount(
    matchedVariant?.sale_price ?? offer.sale_price,
    effectivePrice
  )
  const savings = Math.max(0, offer.sale_price - effectivePrice)
  const productHref = `${tenantPrefix}/productos/${offer.id}`

  // Images deduplication
  const galleryImages: string[] = (() => {
    const list: string[] = []
    const seen = new Set<string>()
    const candidates = [
      ...(offer.image ? [offer.image] : []),
      ...(Array.isArray(offer.images) ? offer.images : []),
    ]
    for (const img of candidates) {
      if (img && !seen.has(img)) {
        seen.add(img)
        list.push(img)
      }
    }
    return list
  })()

  const currentImage = galleryImages[activeImageIdx] || offer.image || null
  const resolvedActive = resolveProductImageUrl(currentImage)

  const variantLabel = matchedVariant ? matchedVariant.variant_name : ''
  const whatsappMsg = variantLabel
    ? `Hola, quiero consultar por la oferta de ${offer.name} — ${variantLabel} (${formatPrice(effectivePrice)}).`
    : `Hola, quiero consultar por la oferta de ${offer.name} (${formatPrice(effectivePrice)}).`

  const whatsappHref =
    contactPhone
      ? getWhatsAppLink({ phone: contactPhone, message: whatsappMsg })
      : null

  const handleSelectAttr = (key: string, value: string) => {
    setSelectedAttrs((prev) => {
      const next = { ...prev, [key]: value }
      // If the current selection of subsequent attrs is no longer available, clear them
      const keys = attributeKeys
      const idx = keys.indexOf(key)
      const cleared = { ...next }
      for (let i = idx + 1; i < keys.length; i++) {
        const k = keys[i]
        const avail = new Set<string>()
        for (const v of activeVariants) {
          const matchesBefore = keys.slice(0, i).every((kk) => v.attributes[kk] === cleared[kk])
          if (matchesBefore && v.attributes[k]) avail.add(v.attributes[k])
        }
        if (cleared[k] && !avail.has(cleared[k])) delete cleared[k]
      }
      return cleared
    })
    setQuantity(1)
    setAddedToCart(false)
  }

  const handleAddToCart = () => {
    if (!effectiveInStock || !selectionComplete) return
    const product: PublicProduct = {
      ...offer,
      sku: matchedVariant?.sku ?? '',
      wholesale_price: null,
      is_active: true,
      unit_measure: 'unidad',
      barcode: null,
      sale_price: effectivePrice,
      offer_price: effectivePrice,
    }
    const result = addProduct(product, effectivePrice, quantity)
    if (result.limited) {
      toast.info(`Ya agregaste el máximo disponible (${result.quantity}).`)
      return
    }
    toast.success('¡Agregado al carrito!')
    setAddedToCart(true)
    setTimeout(() => {
      setAddedToCart(false)
      onClose()
    }, 1200)
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          setActiveImageIdx(0)
          setQuantity(1)
          setAddedToCart(false)
          setSelectedAttrs({})
        }
      }}
    >
      <DialogContent
        className="flex max-h-[92dvh] w-[calc(100%-1rem)] sm:max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl border-border/80"
        showCloseButton
      >
        <DialogTitle className="sr-only">{offer.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Detalles de la oferta de {offer.name}, precio especial, ahorro y opciones de compra.
        </DialogDescription>

        <div className="min-h-0 overflow-y-auto overscroll-contain">
          {/* ── Galería de imágenes / portada ── */}
          <div className="relative bg-muted/30 border-b border-border/60">
            <div className="relative h-52 sm:h-64 overflow-hidden">
              {resolvedActive && resolvedActive !== '/placeholder-product.svg' ? (
                <Image
                  src={resolvedActive}
                  alt={offer.name}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 640px"
                  className="object-contain p-4 transition-transform duration-300"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-16 w-16 text-muted-foreground/30" />
                </div>
              )}

              {/* Badges superiores sobre imagen */}
              <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5 pointer-events-none">
                {discount > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 via-red-500 to-amber-500 px-3 py-1 text-xs font-black tracking-wide text-white shadow-md">
                    <Flame className="h-3.5 w-3.5 fill-white animate-pulse" />
                    -{discount}% OFF
                  </span>
                )}
                {offer.featured && (
                  <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow-md">
                    <Sparkles className="h-3 w-3 fill-white" />
                    Destacado
                  </span>
                )}
              </div>

              {/* Overlay sin stock */}
              {!effectiveInStock && selectionComplete && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px] z-20">
                  <span className="rounded-full bg-destructive/90 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-destructive-foreground shadow-md">
                    Sin stock
                  </span>
                </div>
              )}

              {/* Controles de galería */}
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Imagen anterior"
                    onClick={() => setActiveImageIdx((i) => (i - 1 + galleryImages.length) % galleryImages.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 shadow-md backdrop-blur-sm transition hover:bg-background"
                  >
                    <ChevronLeft className="h-4 w-4 text-foreground" />
                  </button>
                  <button
                    type="button"
                    aria-label="Imagen siguiente"
                    onClick={() => setActiveImageIdx((i) => (i + 1) % galleryImages.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 shadow-md backdrop-blur-sm transition hover:bg-background"
                  >
                    <ChevronRight className="h-4 w-4 text-foreground" />
                  </button>
                </>
              )}
            </div>

            {/* Miniaturas de galería */}
            {galleryImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto px-4 py-2 border-t border-border/40 bg-background/50">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    aria-label={`Ver imagen ${idx + 1}`}
                    className={cn(
                      'relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                      idx === activeImageIdx
                        ? 'border-rose-500 ring-2 ring-rose-500/30'
                        : 'border-border/70 hover:border-foreground/30 opacity-70 hover:opacity-100'
                    )}
                  >
                    <Image
                      src={resolveProductImageUrl(img)}
                      alt=""
                      fill
                      unoptimized
                      sizes="48px"
                      className="object-contain p-1"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Información de la oferta ── */}
          <div className="flex flex-col gap-4 p-4 sm:p-6">
            <div>
              {offer.brand && (
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {offer.brand}
                </p>
              )}
              <h2 className="mt-1 text-lg sm:text-xl font-bold leading-snug text-foreground">
                {offer.name}
              </h2>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    effectiveInStock
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50'
                      : 'bg-destructive/10 text-destructive ring-1 ring-destructive/20'
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', effectiveInStock ? 'bg-emerald-500 animate-pulse' : 'bg-destructive')} />
                  {!selectionComplete ? 'Seleccioná una variante' : effectiveInStock ? 'Disponible para entrega inmediata' : 'Agotado'}
                </span>

                {offer.category && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border/70">
                    {offer.category.name}
                  </span>
                )}
              </div>
            </div>

            {/* ── Bloque de precio y ahorro ── */}
            <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.07] via-rose-500/[0.04] to-transparent p-4 dark:border-amber-500/20">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-foreground">
                  {formatPrice(effectivePrice)}
                </span>
                {(matchedVariant?.sale_price ?? offer.sale_price) > effectivePrice && (
                  <del className="text-sm sm:text-base font-semibold tabular-nums text-muted-foreground">
                    {formatPrice(matchedVariant?.sale_price ?? offer.sale_price)}
                  </del>
                )}
                {discount > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                    <TrendingDown className="h-3 w-3" />
                    -{discount}%
                  </span>
                )}
              </div>

              {savings > 0 && effectiveInStock && selectionComplete && (
                <div className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Tag className="h-3.5 w-3.5" />
                  <span>¡Ahorrás {formatPrice(savings)} en esta compra!</span>
                </div>
              )}
            </div>

            {hasVariants && (
              <PublicVariantPicker
                variants={offer.variants ?? []}
                config={offer.variant_attribute_config}
                selected={selectedAttrs}
                onChange={handleSelectAttr}
                title="Variantes disponibles"
              />
            )}
            {hasVariants && !selectionComplete && <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Seleccioná todas las opciones para continuar.</p>}

            {/* Descripción */}
            {offer.description?.trim() && (
              <div className="rounded-xl border border-border/70 bg-card/60 p-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Descripción y detalles
                </h4>
                <p className="mt-1.5 whitespace-pre-line text-xs sm:text-sm leading-relaxed text-muted-foreground">
                  {offer.description.trim()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer con acciones de compra ── */}
        <div className="shrink-0 flex flex-col gap-2.5 border-t border-border/70 bg-background p-4">
          {commerceMode === 'cart' && effectiveInStock && selectionComplete && (
            <div className="flex items-center justify-between gap-3 text-xs sm:text-sm font-medium">
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
                <span className="w-8 text-center font-bold tabular-nums text-foreground">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Aumentar cantidad"
                  disabled={effectiveStock > 0 && quantity >= effectiveStock}
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/40 hover:bg-muted disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
            {commerceMode === 'cart' ? (
              <Button
                type="button"
                onClick={handleAddToCart}
                disabled={!effectiveInStock || !selectionComplete}
                className="h-11 flex-1 gap-2 rounded-xl font-bold bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white shadow-md shadow-rose-600/20 hover:from-rose-500 hover:to-rose-600 disabled:opacity-50"
              >
                {addedToCart ? (
                  <>
                    <Check className="h-4 w-4 text-white" />
                    <span>¡Agregado al carrito!</span>
                  </>
                ) : !selectionComplete ? (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    <span>Seleccioná las variantes</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    <span>Agregar al carrito · {formatPrice(effectivePrice * quantity)}</span>
                  </>
                )}
              </Button>
            ) : whatsappHref ? (
              <Button
                asChild
                className="h-11 flex-1 gap-2 rounded-xl font-bold bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500"
              >
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                >
                  <MessageCircle className="h-4 w-4" />
                  Consultar por WhatsApp
                </a>
              </Button>
            ) : null}

            <Button
              asChild
              variant="outline"
              className="h-11 gap-1.5 rounded-xl border-border/80 hover:bg-muted font-semibold text-xs sm:text-sm"
            >
              <Link href={productHref} onClick={onClose}>
                <span>Ver página completa</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
