'use client'

import { useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Package, Tag } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

type Product = MarketplaceOrganization['featured_products'][number] & {
  organizationName: string
  organizationSlug: string
}

type Props = {
  products: Product[]
  title?: string
  variant?: 'default' | 'offers'
}

export function ProductsCarousel({ products, title, variant = 'default' }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)

  function scroll(dir: 'left' | 'right') {
    const el = trackRef.current
    if (!el) return
    const cardWidth = (el.firstElementChild?.clientWidth ?? 224) + 16
    el.scrollBy({ left: dir === 'right' ? cardWidth * 2 : -cardWidth * 2, behavior: 'smooth' })
  }

  if (!products.length) return null

  const isOffers = variant === 'offers'

  return (
    <div className="relative px-5">
      {/* Scroll track */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {products.map((product) => {
          const imageSrc = resolveProductImageUrl(product.image)
          const hasOffer = product.has_offer && product.offer_price && product.offer_price < product.sale_price
          const displayPrice = hasOffer ? product.offer_price! : product.sale_price
          const discountPct = hasOffer
            ? Math.round((1 - product.offer_price! / product.sale_price) * 100)
            : 0

          return (
            <Link
              key={`${product.organizationSlug}-${product.id}`}
              href={`/${product.organizationSlug}/inicio`}
              className="group flex w-52 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div className={`relative aspect-square overflow-hidden ${isOffers ? 'bg-rose-50 dark:bg-rose-950/10' : 'bg-slate-100 dark:bg-slate-900'}`}>
                {imageSrc ? (
                  <Image
                    src={imageSrc}
                    alt={product.name}
                    fill
                    className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                    sizes="208px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                  </div>
                )}

                {/* Badges */}
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
                <p className="truncate text-[11px] font-medium text-cyan-700 dark:text-cyan-400">
                  {product.organizationName}
                </p>
                <h3 className="mt-1 line-clamp-2 flex-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {product.name}
                </h3>
                <div className="mt-2">
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

      {/* Gradient fades */}
      <div className="pointer-events-none absolute right-5 top-0 h-full w-14 bg-gradient-to-l from-white dark:from-slate-950" />
      <div className="pointer-events-none absolute left-5 top-0 h-full w-14 bg-gradient-to-r from-white dark:from-slate-950" />

      {/* Scroll buttons */}
      {products.length > 4 && (
        <>
          <button
            onClick={() => scroll('left')}
            className="absolute -left-1 top-1/2 z-10 flex h-9 w-9 -translate-y-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="absolute -right-1 top-1/2 z-10 flex h-9 w-9 -translate-y-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </button>
        </>
      )}
    </div>
  )
}
