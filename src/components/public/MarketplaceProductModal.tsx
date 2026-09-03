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
  Package,
  Store,
  Tag,
  X,
  Zap,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import type { MarketplaceProduct } from '@/lib/public/marketplace'
import { useState, useCallback, useEffect } from 'react'

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  product: MarketplaceProduct | null
  open: boolean
  onClose: () => void
}

// ─── Thumbnail component (maneja su propio error de imagen) ───────────────────
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
      className={[
        'relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
        active
          ? 'border-cyan-500 shadow-md shadow-cyan-500/10'
          : 'border-slate-200/50 dark:border-slate-800/40 opacity-60 hover:border-slate-300 dark:hover:border-slate-700 hover:opacity-100',
      ].join(' ')}
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

// ─── Component ────────────────────────────────────────────────────────────────
export function MarketplaceProductModal({ product, open, onClose }: Props) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [mainError, setMainError] = useState(false)

  // Construir lista única de imágenes: [image, ...images] sin duplicados y sin nulls
  const allImages: string[] = product
    ? Array.from(
        new Set(
          [
            product.image,
            ...(Array.isArray(product.images) ? product.images : []),
          ]
            .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
            .map((s) => resolveProductImageUrl(s))
            .filter((s) => s !== '/placeholder-product.svg')
        )
      )
    : []

  const hasMultiple = allImages.length > 1
  const currentSrc = allImages[activeIdx] ?? null

  // Resetear índice cuando cambia de producto
  useEffect(() => {
    setActiveIdx(0)
    setMainError(false)
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

  if (!product) return null

  const hasOffer =
    product.has_offer &&
    product.offer_price != null &&
    product.offer_price < product.sale_price

  const displayPrice = hasOffer ? product.offer_price! : product.sale_price
  const discountPct = hasOffer
    ? Math.round((1 - product.offer_price! / product.sale_price) * 100)
    : 0

  const isInStock = product.in_stock
  const isLowStock =
    isInStock &&
    typeof product.stock_quantity === 'number' &&
    product.stock_quantity > 0 &&
    product.stock_quantity <= 4

  const productHref = `/${product.organization_slug}/productos/${product.id}`
  const storeHref = `/${product.organization_slug}/inicio`

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/*
        LAYOUT STRATEGY — flex flex-col con max-h-[92dvh]:
          1. Galería  →  shrink-0  (imagen + thumbnails, altura fija)
          2. Info     →  min-h-0 flex-1 overflow-y-auto  (scrolleable)
          3. Footer   →  shrink-0  (siempre visible)
      */}
      <DialogContent
        className="flex max-h-[90dvh] w-[calc(100%-1rem)] sm:max-w-lg flex-col gap-0 overflow-hidden rounded-xl border bg-background p-0 shadow-xl focus:outline-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <DialogDescription className="sr-only">Vista previa del producto. Continuá en la tienda del vendedor para comprar.</DialogDescription>

        {/* ── 1. GALERÍA (shrink-0) ────────────────────────────────────────── */}
        <div className="min-h-0 overflow-y-auto overscroll-contain">
        <div className="border-b border-slate-200/30 dark:border-slate-800/30">

          {/* Imagen principal */}
          <div className="relative h-40 overflow-hidden bg-muted/30 sm:h-48">
            {currentSrc && !mainError ? (
              <Image
                key={currentSrc}
                src={currentSrc}
                alt={`${product.name} — imagen ${activeIdx + 1}`}
                fill
                sizes="480px"
                className="object-contain p-5 transition-opacity duration-300"
                quality={90}
                onError={() => setMainError(true)}
                unoptimized={
                  currentSrc.startsWith('data:') ||
                  currentSrc === '/placeholder-product.svg'
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package className="h-16 w-16 text-slate-300 dark:text-slate-650" />
              </div>
            )}

            {/* Badges — top left */}
            <div className="absolute left-3.5 top-3.5 z-10 flex flex-col gap-1.5">
              {discountPct > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow-lg shadow-rose-600/20">
                  <Tag className="h-3 w-3" />
                  -{discountPct}%
                </span>
              )}
              {product.featured && !hasOffer && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow-lg shadow-amber-500/20">
                  <Zap className="h-3 w-3" />
                  Destacado
                </span>
              )}
            </div>

            {/* Contador + botón cerrar — top right */}
            <div className="absolute right-3.5 top-3.5 z-10 flex items-center gap-2">
              {hasMultiple && (
                <span className="rounded-full bg-black/50 border border-white/10 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                  {activeIdx + 1}/{allImages.length}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 border border-slate-200/50 text-slate-700 shadow-md backdrop-blur-md transition-all hover:bg-white hover:scale-105 active:scale-95 dark:bg-slate-900/80 dark:border-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-900"
                aria-label="Cerrar"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Flechas de navegación — solo si hay más de 1 imagen */}
            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  disabled={activeIdx === 0}
                  aria-label="Imagen anterior"
                  className="absolute left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 border border-slate-200/50 text-slate-700 shadow-md backdrop-blur-md transition-all hover:bg-white hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-0 dark:bg-slate-900/80 dark:border-slate-800/50 dark:text-slate-200"
                >
                  <ChevronLeft className="h-4.5 w-4.5" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={activeIdx === allImages.length - 1}
                  aria-label="Imagen siguiente"
                  className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 border border-slate-200/50 text-slate-700 shadow-md backdrop-blur-md transition-all hover:bg-white hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-0 dark:bg-slate-900/80 dark:border-slate-800/50 dark:text-slate-200"
                >
                  <ChevronRight className="h-4.5 w-4.5" />
                </button>
              </>
            )}

            {/* Sin stock overlay */}
            {!isInStock && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[2px] dark:bg-slate-950/40">
                <span className="rounded-full bg-slate-900/90 px-4 py-1.5 text-xs font-extrabold text-white shadow-lg">
                  Agotado
                </span>
              </div>
            )}
          </div>

          {/* Strip de thumbnails — solo si hay 2+ imágenes */}
          {hasMultiple && (
            <div className="flex gap-2 overflow-x-auto bg-slate-50/50 px-3 py-2 border-t border-slate-200/10 dark:bg-slate-900/30">
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

        {/* ── 2. Contenido scrolleable ─────────────────────────────────────── */}
        <div>
          <div className="flex flex-col gap-3 p-4">

            {/* Pill de la tienda */}
            <Link
              href={storeHref}
              onClick={onClose}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50/80 px-3 py-1.5 text-xs font-bold text-cyan-700 transition-all hover:bg-cyan-100 dark:border-cyan-800/40 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-950/60 shadow-sm"
            >
              <Store className="h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" />
              {product.organization_name}
            </Link>

            {/* Nombre + marca + categoría */}
            <div>
              {(product.brand || product.category) && (
                <span className="mb-2 inline-block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900/80 px-2 py-0.5 rounded">
                  {[product.brand, product.category?.name].filter(Boolean).join(' · ')}
                </span>
              )}
              <h2 className="text-base font-bold text-foreground leading-snug">
                {product.name}
              </h2>
            </div>

            {/* Precio */}
            <div className="flex items-baseline gap-3 py-0.5">
              <p
                className={`text-2xl font-bold tracking-tight ${
                  hasOffer
                    ? 'text-rose-600 dark:text-rose-450'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {formatPrice(displayPrice)}
              </p>
              {hasOffer && (
                <p className="text-sm font-semibold text-slate-400 line-through dark:text-slate-500">
                  {formatPrice(product.sale_price)}
                </p>
              )}
            </div>

            {/* Indicadores de stock */}
            <div className="flex flex-wrap items-center gap-2">
              <FavoriteButton item={{ productId: product.id, slug: product.organization_slug, name: product.name, store: product.organization_name }} />
              {isInStock ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-250/20 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  En stock
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  Agotado
                </span>
              )}
              {isLowStock && (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-250/20 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  Últimas {product.stock_quantity} unidades
                </span>
              )}
            </div>

            {/* Descripción completa */}
            {product.description?.trim() && (
              <details className="rounded-md border bg-muted/30 p-2.5">
                <summary className="cursor-pointer text-sm font-medium">Descripción y características</summary>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-650 dark:text-slate-400">
                  {product.description.trim().replace(/\n{3,}/g, '\n\n')}
                </p>
              </details>
            )}

            <div className="h-1" />
          </div>
        </div>

        </div>
        {/* Actions remain scoped to this seller's storefront. */}
        <div className="shrink-0 border-t bg-background px-4 py-3">
          <div className="flex flex-col gap-2">
            <Link
              href={productHref}
              onClick={onClose}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-primary/90 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-95 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Ver detalle en la tienda</span>
            </Link>

            <Link
              href={storeHref}
              onClick={onClose}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border/80 bg-muted/40 text-sm font-semibold text-foreground transition-all hover:bg-muted active:scale-[0.98]"
            >
              <Store className="h-4 w-4 text-primary" />
              <span>Visitar tienda ({product.organization_name})</span>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
