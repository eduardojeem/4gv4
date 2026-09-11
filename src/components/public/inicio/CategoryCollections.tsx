'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { usePathname } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import {
  STOREFRONT_EYEBROW_CLASS,
  STOREFRONT_HEADING_CLASS,
  STOREFRONT_RADIUS_CLASS,
  type StorefrontStyle,
} from '@/lib/website/storefront-style'
import type { PublicProduct } from '@/types/public'
import { NEWEST_PRODUCTS_SWR_OPTIONS, fetchPublicProducts, newestProductsKey } from './newest-products'

/**
 * La foto de cada categoria: la del producto mas nuevo que tenga imagen. Las
 * categorias no tienen foto propia.
 */
export function categoryCoverImages(products: PublicProduct[]): Map<string, string> {
  const covers = new Map<string, string>()
  for (const product of products) {
    const categoryId = product.category?.id
    const image = product.image?.trim()
    if (!categoryId || !image || covers.has(categoryId)) continue
    covers.set(categoryId, image)
  }
  return covers
}

/**
 * Categorias como colecciones con foto, para Moda y Deportivo. El aspecto
 * clasico usa iconos pensados para tecnologia y electrodomesticos.
 */
export function CategoryCollections({ style }: { style: Exclude<StorefrontStyle, 'classic'> }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const { categories, isLoading } = usePublicCategories()
  const { data: products } = useSWR(newestProductsKey(tenantSlug), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)
  const radius = STOREFRONT_RADIUS_CLASS[style]

  if (!mounted || isLoading) {
    return (
      <section className="border-b border-border/80 bg-background py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 h-9 w-56 animate-pulse bg-muted" />
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn('aspect-[3/4] animate-pulse bg-muted', radius)} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  const hasCounts = categories.some((c) => typeof c.productCount === 'number')
  const withProducts = hasCounts ? categories.filter((c) => (c.productCount ?? 0) > 0) : categories
  if (withProducts.length === 0) return null

  const items = [...withProducts]
    .sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 8)
  const covers = categoryCoverImages(products ?? [])

  return (
    <section aria-labelledby="colecciones-titulo" className="border-b border-border/80 bg-background py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className={STOREFRONT_EYEBROW_CLASS[style]}>Colecciones</span>
            <h2 id="colecciones-titulo" className={cn('mt-2 text-2xl text-foreground sm:text-4xl', STOREFRONT_HEADING_CLASS[style])}>
              Comprá por categoría
            </h2>
          </div>
          <Link
            href={`${tenantPrefix}/productos`}
            className="group inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-foreground transition-colors hover:text-primary"
          >
            <span>Ver todo</span>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 motion-safe:transition-transform motion-safe:group-hover:translate-x-1" />
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
          {items.map((category) => {
            const cover = covers.get(category.id)
            const coverSrc = cover ? resolveProductImageUrl(cover) : null
            const count = category.productCount ?? 0
            return (
              <li key={category.id}>
                <Link
                  href={`${tenantPrefix}/productos?category_id=${encodeURIComponent(category.id)}`}
                  className={cn(
                    'group relative block aspect-[3/4] overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    radius,
                    coverSrc ? 'bg-muted' : 'bg-primary'
                  )}
                >
                  {coverSrc && (
                    <Image
                      src={coverSrc}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover motion-safe:transition-transform motion-safe:duration-700 motion-safe:group-hover:scale-[1.04]"
                      unoptimized={coverSrc.startsWith('data:')}
                    />
                  )}
                  <span
                    className={cn(
                      'absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3 sm:p-4',
                      coverSrc
                        ? 'bg-gradient-to-t from-black/70 via-black/25 to-transparent pt-16 text-white'
                        : 'text-primary-foreground'
                    )}
                  >
                    <span className={cn('line-clamp-2 text-lg leading-tight sm:text-xl', STOREFRONT_HEADING_CLASS[style])}>
                      {category.name}
                    </span>
                    {count > 0 && (
                      <span className="text-[11px] font-medium uppercase tracking-widest opacity-80">
                        {count} {count === 1 ? 'producto' : 'productos'}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
