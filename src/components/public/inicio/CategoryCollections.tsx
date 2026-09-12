'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { usePathname } from 'next/navigation'
import { ArrowRight, Grid3X3, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveProductImageUrl } from '@/lib/images'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import type { StorefrontStyle } from '@/lib/website/storefront-style'
import type { PublicProduct } from '@/types/public'
import { NEWEST_PRODUCTS_SWR_OPTIONS, fetchPublicProducts, newestProductsKey } from './newest-products'

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

interface CollectionItem {
  id: string
  name: string
  tag?: string
  href: string
  imageUrl: string
  count?: number
}

export function CategoryCollections({ style: _style }: { style: Exclude<StorefrontStyle, 'classic'> }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const { categories, isLoading } = usePublicCategories()
  const { data: products } = useSWR(newestProductsKey(tenantSlug), fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)

  if (!mounted || isLoading) {
    return (
      <section className="border-b border-border/80 bg-background py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-8 h-8 w-56 animate-pulse rounded-xl bg-muted text-center" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  const covers = categoryCoverImages(products ?? [])
  const validDbCategories = categories.filter((c) => (c.productCount ?? 0) > 0)
  if (validDbCategories.length === 0) return null

  const items = [...validDbCategories]
    .sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 8)

  const displayCollections: CollectionItem[] = items.map((cat) => {
    const cover = covers.get(cat.id)
    return {
      id: cat.id,
      name: cat.name,
      tag: cat.name.toLowerCase().includes('corporat') ? 'Empresas' : 'Colección',
      href: `${tenantPrefix}/productos?category_id=${encodeURIComponent(cat.id)}`,
      imageUrl: cover ? resolveProductImageUrl(cover) : null,
      count: cat.productCount,
    }
  })

  return (
    <section aria-labelledby="categorias-principales-titulo" className="border-b border-border/70 bg-background py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Cabecera estilo boutique editorial */}
        <div className="mb-8 sm:mb-12 flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Explorá nuestras colecciones
          </span>
          <h2
            id="categorias-principales-titulo"
            className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground"
          >
            Colecciones Destacadas
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-lg">
            Encontrá el corte, modelo y color ideal para tu estilo en nuestras líneas exclusivas.
          </p>
        </div>

        {/* Grilla editorial vertical aspect-[4/5] */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
          {displayCollections.map((col) => {
            return (
              <div key={col.id} className="group relative">
                <Link
                  href={col.href}
                  className="relative block aspect-[4/5] overflow-hidden rounded-2xl border border-border/60 bg-muted/40 shadow-sm transition-all duration-500 hover:shadow-xl hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {col.imageUrl && (
                    <Image
                      src={col.imageUrl}
                      alt={col.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                      unoptimized={col.imageUrl.startsWith('data:')}
                    />
                  )}

                  {/* Gradiente oscuro inferior para texto nítido */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 transition-opacity duration-300 group-hover:opacity-95" />

                  {/* Tag superior */}
                  {col.tag && (
                    <div className="absolute top-3.5 left-3.5 z-10" aria-hidden="true">
                      <span className="inline-block rounded-full bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white border border-white/20">
                        {col.tag}
                      </span>
                    </div>
                  )}

                  {/* Contenido en blanco abajo */}
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 flex flex-col justify-end text-white z-10">
                    <h3 className="text-base sm:text-lg font-bold leading-tight text-white group-hover:text-white transition-colors line-clamp-1">
                      {col.name}
                    </h3>

                    {typeof col.count === 'number' && col.count > 0 && (
                      <span className="text-[11px] font-medium text-slate-300 mt-0.5">
                        {col.count} {col.count === 1 ? 'producto' : 'productos'}
                      </span>
                    )}

                    <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-white/90 group-hover:text-white group-hover:translate-x-1 transition-all" aria-hidden="true">
                      <span>Ver colección</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>

        {/* Enlace para ver todo el catálogo */}
        <div className="mt-8 text-center sm:hidden">
          <Link
            href={`${tenantPrefix}/productos`}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary hover:underline"
          >
            <span>Ver todo el catálogo</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
