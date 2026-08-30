'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Flame, Package, Sparkles, Tag, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/public/ProductCard'
import { getTenantSlugFromPathname, withOrgQuery } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import type { PublicProduct } from '@/types/public'

const fetcher = async (url: string): Promise<PublicProduct[]> => {
  const res = await fetch(url)
  const body = await res.json().catch(() => null)
  const products = body?.data?.products
  if (!res.ok || !Array.isArray(products)) {
    throw new Error('Failed to fetch products')
  }
  return products as PublicProduct[]
}

type FilterTab = 'all' | 'offers' | 'featured'

export function FeaturedProducts() {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const { data, error, isLoading } = useSWR(
    withOrgQuery('/api/public/products?per_page=16&sort=newest', tenantSlug),
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const products = isMounted ? (data ?? []) : []
  const effectiveIsLoading = !isMounted || isLoading

  // Filtro por pestaña
  const displayedProducts = useMemo(() => {
    if (activeTab === 'offers') {
      return products.filter((p) => p.has_offer && p.offer_price && p.offer_price < p.sale_price)
    }
    if (activeTab === 'featured') {
      return products.filter((p) => p.featured)
    }
    return products
  }, [products, activeTab])

  const offersCount = useMemo(
    () => products.filter((p) => p.has_offer && p.offer_price && p.offer_price < p.sale_price).length,
    [products]
  )

  if (!effectiveIsLoading && (error || products.length === 0)) return null

  return (
    <section id="productos" className="py-12 sm:py-16 bg-background border-b border-border/80">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Cabecera de Sección */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Catálogo Destacado
            </span>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Productos Recomendados
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Descubrí los artículos más buscados y las mejores oportunidades.
            </p>
          </div>

          <Button asChild variant="outline" className="hidden sm:inline-flex rounded-xl font-bold shadow-xs gap-1.5">
            <Link href={`${tenantPrefix}/productos`}>
              <span>Ver catálogo completo</span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </Link>
          </Button>
        </div>

        {/* Pestañas de Filtro Rápido */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs shrink-0',
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'border border-border/80 bg-card text-muted-foreground hover:text-foreground'
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Todos los destacados</span>
          </button>

          {offersCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('offers')}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs shrink-0',
                activeTab === 'offers'
                  ? 'border-rose-500 bg-rose-600 text-white'
                  : 'border border-rose-200 bg-rose-50/70 text-rose-700 hover:bg-rose-100 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300'
              )}
            >
              <Flame className="h-3.5 w-3.5" />
              <span>En Oferta ({offersCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('featured')}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs shrink-0',
              activeTab === 'featured'
                ? 'bg-amber-600 text-white'
                : 'border border-border/80 bg-card text-muted-foreground hover:text-foreground'
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Top Selección</span>
          </button>
        </div>

        {/* Grid de Productos */}
        {effectiveIsLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
            ))}
          </div>
        ) : displayedProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">
            {displayedProducts.slice(0, 8).map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 2} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center bg-card">
            <Package className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground">No hay productos en esta selección</p>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className="mt-3 text-xs font-bold text-primary hover:underline"
            >
              Ver todos los productos
            </button>
          </div>
        )}

        {/* Botón Ver Todo en Mobile */}
        <div className="mt-8 text-center sm:hidden">
          <Button asChild variant="outline" className="w-full gap-2 rounded-xl font-bold">
            <Link href={`${tenantPrefix}/productos`}>
              <span>Ver catálogo completo</span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </Link>
          </Button>
        </div>

      </div>
    </section>
  )
}
