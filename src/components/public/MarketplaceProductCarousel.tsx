'use client'

import { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Package, Store, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveProductImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/utils'
import type { MarketplaceProduct } from '@/lib/public/marketplace'

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
      sizes="(max-width: 640px) 78vw, 240px"
      onError={() => setFailed(true)}
      className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
    />
  )
}

export function MarketplaceProductCarousel({ products, variant = 'default' }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const isOffers = variant === 'offers'

  const normalizedProducts = useMemo(() => products.slice(0, 24), [products])

  function scroll(direction: 'left' | 'right') {
    const track = trackRef.current
    if (!track) return

    const card = track.querySelector<HTMLElement>('[data-carousel-card]')
    const step = (card?.offsetWidth ?? 240) + 16
    const nextIndex =
      direction === 'right'
        ? Math.min(activeIndex + 1, normalizedProducts.length - 1)
        : Math.max(activeIndex - 1, 0)

    setActiveIndex(nextIndex)
    track.scrollBy({
      left: direction === 'right' ? step : -step,
      behavior: 'smooth',
    })
  }

  if (!normalizedProducts.length) return null

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 scrollbar-hide"
        aria-label="Productos del marketplace"
      >
        {normalizedProducts.map((product) => {
          const hasOffer = Boolean(product.has_offer && product.offer_price && product.offer_price < product.sale_price)
          const displayPrice = hasOffer ? product.offer_price! : product.sale_price
          const discountPct = hasOffer ? Math.round((1 - product.offer_price! / product.sale_price) * 100) : 0

          return (
            <Link
              key={`${product.organization_slug}-${product.id}`}
              href={`/${product.organization_slug}/productos/${product.id}`}
              data-carousel-card
              className="group flex w-[78vw] max-w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-700 sm:w-60"
            >
              <div className={`relative aspect-square overflow-hidden ${isOffers ? 'bg-rose-50 dark:bg-rose-950/10' : 'bg-slate-100 dark:bg-slate-900'}`}>
                <ProductImage product={product} />

                <div className="absolute left-2 top-2 flex flex-col gap-1">
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
              </div>

              <div className="flex flex-1 flex-col p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-400">
                  <Store className="h-3 w-3 shrink-0" />
                  <span className="truncate">{product.organization_name}</span>
                </div>
                {product.category && (
                  <p className="mt-1 truncate text-[10px] text-slate-400 dark:text-slate-500">{product.category.name}</p>
                )}
                <h3 className="mt-1 line-clamp-2 flex-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {product.name}
                </h3>
                <div className="mt-3">
                  <p className={`text-base font-bold ${hasOffer ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-50'}`}>
                    {formatPrice(displayPrice)}
                  </p>
                  {hasOffer && (
                    <p className="text-xs text-slate-400 line-through dark:text-slate-500">
                      {formatPrice(product.sale_price)}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {normalizedProducts.length > 1 && (
        <>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => scroll('left')}
            disabled={activeIndex === 0}
            className="absolute -left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 rounded-full bg-white shadow-md disabled:opacity-40 dark:bg-slate-900 sm:inline-flex"
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
            className="absolute -right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 rounded-full bg-white shadow-md disabled:opacity-40 dark:bg-slate-900 sm:inline-flex"
            aria-label="Productos siguientes"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      {normalizedProducts.length === 0 && (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 py-12 dark:border-slate-700">
          <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
        </div>
      )}
    </div>
  )
}
