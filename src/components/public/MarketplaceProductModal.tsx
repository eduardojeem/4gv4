'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
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
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
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
        'relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
        active
          ? 'border-cyan-500 shadow-sm'
          : 'border-transparent opacity-60 hover:border-slate-300 hover:opacity-100',
      ].join(' ')}
      aria-label={alt}
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

  const prev = useCallback(() => setActiveIdx((i) => Math.max(0, i - 1)), [])
  const next = useCallback(
    () => setActiveIdx((i) => Math.min(allImages.length - 1, i + 1)),
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
        className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl focus:outline-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{product.name}</DialogTitle>

        {/* ── 1. GALERÍA (shrink-0) ────────────────────────────────────────── */}
        <div className="shrink-0">

          {/* Imagen principal */}
          <div className="relative h-52 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 sm:h-60">
            {currentSrc && !mainError ? (
              <Image
                key={currentSrc}
                src={currentSrc}
                alt={`${product.name} — imagen ${activeIdx + 1}`}
                fill
                sizes="480px"
                className="object-contain p-5 transition-opacity duration-200"
                quality={90}
                onError={() => setMainError(true)}
                unoptimized={
                  currentSrc.startsWith('data:') ||
                  currentSrc === '/placeholder-product.svg'
                }
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package className="h-14 w-14 text-slate-300 dark:text-slate-600" />
              </div>
            )}

            {/* Badges — top left */}
            <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
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

            {/* Contador + botón cerrar — top right */}
            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
              {hasMultiple && (
                <span className="rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                  {activeIdx + 1}/{allImages.length}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-slate-600 shadow-md backdrop-blur-sm transition-colors hover:bg-white hover:text-slate-900 dark:bg-slate-900/85 dark:text-slate-300 dark:hover:bg-slate-900"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
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
                  className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-600 shadow-md backdrop-blur-sm transition-all hover:bg-white disabled:pointer-events-none disabled:opacity-0 dark:bg-slate-900/85 dark:text-slate-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={activeIdx === allImages.length - 1}
                  aria-label="Imagen siguiente"
                  className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-600 shadow-md backdrop-blur-sm transition-all hover:bg-white disabled:pointer-events-none disabled:opacity-0 dark:bg-slate-900/85 dark:text-slate-300"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {/* Sin stock overlay */}
            {!isInStock && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[2px] dark:bg-slate-900/60">
                <span className="rounded-full bg-slate-700/90 px-4 py-1.5 text-sm font-semibold text-white shadow">
                  Agotado
                </span>
              </div>
            )}
          </div>

          {/* Strip de thumbnails — solo si hay 2+ imágenes */}
          {hasMultiple && (
            <div className="flex gap-2 overflow-x-auto bg-slate-50 px-4 py-2.5 scrollbar-hide dark:bg-slate-900/50">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-4 p-5">

            {/* Pill de la tienda */}
            <Link
              href={storeHref}
              onClick={onClose}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-950/70"
            >
              <Store className="h-3 w-3 shrink-0" />
              {product.organization_name}
            </Link>

            {/* Nombre + marca + categoría */}
            <div>
              {(product.brand || product.category) && (
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {[product.brand, product.category?.name].filter(Boolean).join(' · ')}
                </p>
              )}
              <h2 className="text-[17px] font-bold leading-snug text-slate-900 dark:text-slate-50">
                {product.name}
              </h2>
            </div>

            {/* Precio */}
            <div className="flex items-baseline gap-3">
              <p
                className={`text-3xl font-extrabold leading-tight tracking-tight ${
                  hasOffer
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-slate-50'
                }`}
              >
                {formatPrice(displayPrice)}
              </p>
              {hasOffer && (
                <p className="text-base text-slate-400 line-through dark:text-slate-500">
                  {formatPrice(product.sale_price)}
                </p>
              )}
            </div>

            {/* Indicadores de stock */}
            <div className="flex flex-wrap items-center gap-2">
              {isInStock ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Check className="h-3 w-3" />
                  En stock
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  Agotado
                </span>
              )}
              {isLowStock && (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  Últimas {product.stock_quantity} unidades
                </span>
              )}
            </div>

            {/* Descripción completa */}
            {product.description?.trim() && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {product.description.trim().replace(/\n{3,}/g, '\n\n')}
                </p>
              </div>
            )}

            <div className="h-1" />
          </div>
        </div>

        {/* ── 3. Footer fijo con CTAs ──────────────────────────────────────── */}
        <div className="shrink-0 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex flex-col gap-2">
            <Link
              href={productHref}
              onClick={onClose}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-sm font-semibold text-white shadow-sm transition-all hover:bg-cyan-700 active:scale-[0.98]"
            >
              <ExternalLink className="h-4 w-4" />
              Ver detalle completo
            </Link>

            <Link
              href={storeHref}
              onClick={onClose}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
            >
              <Building2 className="h-4 w-4 text-slate-400" />
              Ir a la tienda
              <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-400" />
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
