'use client'

import { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Package, Store, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import type { MarketplaceProduct } from '@/lib/public/marketplace'
import { MarketplaceProductModal } from './MarketplaceProductModal'

type Props = {
  products: MarketplaceProduct[]
  variant?: 'default' | 'offers'
}

function ProductImage({ product }: { product: MarketplaceProduct }) {
  const [failed, setFailed] = useState(false)
  const imageSrc = failed ? '/placeholder-product.svg' : resolveProductImageUrl(product.image)
  return (
    <Image
      src={imageSrc}
      alt={product.name}
      fill
      unoptimized
      sizes="(max-width: 640px) 78vw, 260px"
      onError={() => setFailed(true)}
      className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
    />
  )
}

export function MarketplaceProductCarousel({ products, variant = 'default' }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null)
  const isOffers = variant === 'offers'

  const normalizedProducts = useMemo(() => products.slice(0, 24), [products])

  function scroll(direction: 'left' | 'right') {
    const track = trackRef.current
    if (!track) return
    const card = track.querySelector<HTMLElement>('[data-carousel-card]')
    const step = (card?.offsetWidth ?? 256) + 16
    const nextIndex =
      direction === 'right'
        ? Math.min(activeIndex + 1, normalizedProducts.length - 1)
        : Math.max(activeIndex - 1, 0)
    setActiveIndex(nextIndex)
    track.scrollBy({ left: direction === 'right' ? step : -step, behavior: 'smooth' })
  }

  if (!normalizedProducts.length) return null

  return (
    <>
      <div className="relative">
        {/* ── Fades laterales indicadoras de scroll ─────────────────────── */}
        <div
          className="pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-gradient-to-r from-white to-transparent transition-opacity dark:from-slate-950"
          style={{ opacity: activeIndex > 0 ? 1 : 0 }}
        />
        <div
          className="pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-gradient-to-l from-white to-transparent transition-opacity dark:from-slate-950"
          style={{ opacity: activeIndex < normalizedProducts.length - 1 ? 1 : 0 }}
        />

        {/* ── Track ─────────────────────────────────────────────────────── */}
        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-hide"
          aria-label="Productos del marketplace"
        >
          {normalizedProducts.map((product) => {
            const hasOffer = Boolean(
              product.has_offer && product.offer_price && product.offer_price < product.sale_price
            )
            const displayPrice = hasOffer ? product.offer_price! : product.sale_price
            const discountPct = hasOffer
              ? Math.round((1 - product.offer_price! / product.sale_price) * 100)
              : 0

            return (
              <button
                key={`${product.organization_slug}-${product.id}`}
                type="button"
                data-carousel-card
                onClick={() => setSelected(product)}
                aria-label={`Ver ${product.name}`}
                className={[
                  'group flex w-[78vw] max-w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border bg-white text-left transition-all duration-200 hover:-translate-y-0.5 sm:w-64',
                  isOffers
                    ? 'border-rose-200/60 hover:border-rose-300 hover:shadow-lg hover:shadow-rose-500/5 dark:border-rose-900/30 dark:bg-slate-950 dark:hover:border-rose-700'
                    : 'border-slate-200/80 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-500/5 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-800',
                ].join(' ')}
              >
                {/* Imagen */}
                <div
                  className={`relative aspect-square overflow-hidden ${
                    isOffers
                      ? 'bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/20 dark:to-rose-900/10'
                      : 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'
                  }`}
                >
                  <ProductImage product={product} />

                  {/* Badges */}
                  <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1">
                    {hasOffer && discountPct > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                        <Tag className="h-2.5 w-2.5" />
                        -{discountPct}%
                      </span>
                    )}
                    {product.featured && !hasOffer && (
                      <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                        Destacado
                      </span>
                    )}
                  </div>

                  {/* Agotado */}
                  {!product.in_stock && (
                    <div className="absolute inset-0 flex items-end justify-center bg-white/40 pb-3 backdrop-blur-[1px] dark:bg-slate-900/40">
                      <span className="rounded-full bg-slate-800/80 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                        Agotado
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col p-3.5">
                  <div className="flex items-center gap-1.5">
                    <Store className="h-3 w-3 shrink-0 text-cyan-600 dark:text-cyan-400" />
                    <span className="truncate text-[11px] font-semibold text-cyan-700 dark:text-cyan-400">
                      {product.organization_name}
                    </span>
                  </div>
                  {product.category && (
                    <p className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">
                      {product.category.name}
                    </p>
                  )}
                  <h3 className="mt-1.5 line-clamp-2 flex-1 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-50">
                    {product.name}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-2">
                    <p
                      className={`text-lg font-bold tabular-nums leading-none ${
                        hasOffer ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-50'
                      }`}
                    >
                      {formatPrice(displayPrice)}
                    </p>
                    {hasOffer && (
                      <p className="text-xs text-slate-400 line-through dark:text-slate-500">
                        {formatPrice(product.sale_price)}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Botones de navegación ──────────────────────────────────────── */}
        {normalizedProducts.length > 1 && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => scroll('left')}
              disabled={activeIndex === 0}
              className="absolute -left-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 rounded-full bg-white shadow-md disabled:opacity-0 dark:bg-slate-900 sm:inline-flex"
              aria-label="Productos anteriores"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => scroll('right')}
              disabled={activeIndex >= normalizedProducts.length - 1}
              className="absolute -right-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 rounded-full bg-white shadow-md disabled:opacity-0 dark:bg-slate-900 sm:inline-flex"
              aria-label="Productos siguientes"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Modal */}
      <MarketplaceProductModal
        product={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </>
  )
}
