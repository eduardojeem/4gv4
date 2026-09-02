'use client'

import { useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Flame, Package, Sparkles, Layers, Grid3X3 } from 'lucide-react'
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

export function FeaturedProducts() {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [activeSpecialTab, setActiveSpecialTab] = useState<'all' | 'offers' | 'featured'>('all')

  const { data, error, isLoading } = useSWR(
    withOrgQuery('/api/public/products?per_page=32&sort=newest', tenantSlug),
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const products = isMounted ? (data ?? []) : []
  const effectiveIsLoading = !isMounted || isLoading

  // Categorías presentes en los productos cargados
  const availableCategories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const p of products) {
      if (p.category?.id && p.category?.name) {
        const existing = map.get(p.category.id)
        if (existing) {
          existing.count++
        } else {
          map.set(p.category.id, { id: p.category.id, name: p.category.name, count: 1 })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [products])

  const offersCount = useMemo(
    () => products.filter((p) => p.has_offer && p.offer_price && p.offer_price < p.sale_price).length,
    [products]
  )

  const featuredCount = useMemo(
    () => products.filter((p) => p.featured).length,
    [products]
  )

  // Filtro dinámico por categoría o pestañas especiales
  const displayedProducts = useMemo(() => {
    let result = products

    if (activeSpecialTab === 'offers') {
      result = result.filter((p) => p.has_offer && p.offer_price && p.offer_price < p.sale_price)
    } else if (activeSpecialTab === 'featured') {
      result = result.filter((p) => p.featured)
    }

    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.category?.id === selectedCategory)
    }

    return result
  }, [products, selectedCategory, activeSpecialTab])

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
              Productos Disponibles
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Descubrí los artículos en stock con garantía, opciones de financiación y entrega inmediata.
            </p>
          </div>

          <Button asChild variant="outline" className="hidden sm:inline-flex rounded-xl font-bold shadow-xs gap-1.5">
            <Link href={`${tenantPrefix}/productos`}>
              <span>Ver catálogo completo ({products.length})</span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </Link>
          </Button>
        </div>

        {/* Pestañas de Filtro Rápido y Categorías */}
        <div className="flex flex-wrap items-center gap-2 pb-2 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveSpecialTab('all')
              setSelectedCategory('all')
            }}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs shrink-0',
              activeSpecialTab === 'all' && selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Todos ({products.length})</span>
          </button>

          {offersCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveSpecialTab('offers')
                setSelectedCategory('all')
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs shrink-0',
                activeSpecialTab === 'offers'
                  ? 'border-rose-500 bg-rose-600 text-white'
                  : 'border border-rose-200 bg-rose-50/70 text-rose-700 hover:bg-rose-100 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300'
              )}
            >
              <Flame className="h-3.5 w-3.5" />
              <span>En Oferta ({offersCount})</span>
            </button>
          )}

          {featuredCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveSpecialTab('featured')
                setSelectedCategory('all')
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all shadow-xs shrink-0',
                activeSpecialTab === 'featured'
                  ? 'bg-amber-600 text-white'
                  : 'border border-border/80 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Top Selección ({featuredCount})</span>
            </button>
          )}

          {/* Filtros por Categoría Comercial */}
          {availableCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveSpecialTab('all')
                setSelectedCategory(selectedCategory === cat.id ? 'all' : cat.id)
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all shadow-xs shrink-0',
                selectedCategory === cat.id
                  ? 'bg-secondary text-secondary-foreground font-bold border border-primary/40'
                  : 'border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40'
              )}
            >
              <Grid3X3 className="h-3 w-3 opacity-70" />
              <span>{cat.name}</span>
              <span className="text-[10px] opacity-60 bg-muted px-1.5 py-0.5 rounded-full">{cat.count}</span>
            </button>
          ))}
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
            {displayedProducts.slice(0, 16).map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center bg-card">
            <Package className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-semibold text-foreground">No hay productos en esta selección</p>
            <button
              type="button"
              onClick={() => {
                setActiveSpecialTab('all')
                setSelectedCategory('all')
              }}
              className="mt-3 text-xs font-bold text-primary hover:underline"
            >
              Ver todos los productos
            </button>
          </div>
        )}

        {/* Botón Ver Catálogo Completo */}
        <div className="mt-10 text-center">
          <Button asChild size="lg" variant="outline" className="rounded-2xl font-bold px-8 shadow-xs hover:border-primary/50">
            <Link href={`${tenantPrefix}/productos`}>
              <span>Explorar los {products.length} productos en el catálogo</span>
              <ArrowRight className="h-4 w-4 text-primary ml-2" />
            </Link>
          </Button>
        </div>

      </div>
    </section>
  )
}
