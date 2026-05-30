import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Package, Sparkles, Store, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarketplaceProductCarousel } from '@/components/public/MarketplaceProductCarousel'
import { ProductsClient } from '@/components/public/ProductsClient'
import { CategoryCarouselSection } from '@/components/public/CategoryCarouselSection'
import { getMarketplaceProducts } from '@/lib/public/marketplace'

export const metadata: Metadata = {
  title: 'Productos | Marketplace MiPOS',
  description: 'Catálogo global de productos publicados por empresas en el marketplace.',
}

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ q?: string; categoria?: string }>
}

export default async function MarketplaceProductsPage({ searchParams }: PageProps) {
  const { q, categoria } = await searchParams
  const products = await getMarketplaceProducts(96)

  const offerProducts = products.filter((p) => p.has_offer && p.offer_price && p.offer_price < p.sale_price)
  const featuredProducts = products.filter((p) => p.featured && !(p.has_offer && p.offer_price))

  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(6,182,212,0.08),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/marketplace" className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300">
              <Store className="h-3 w-3" />
              Marketplace
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-slate-700 dark:text-slate-200">Productos</span>
          </nav>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white">
                  <Package className="h-5 w-5" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  Productos
                </h1>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                <span>{products.length} producto{products.length !== 1 ? 's' : ''} públicos</span>
                {offerProducts.length > 0 && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                    <span className="flex items-center gap-1 font-medium text-rose-600 dark:text-rose-400">
                      <Tag className="h-3.5 w-3.5" />
                      {offerProducts.length} en oferta
                    </span>
                  </>
                )}
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 gap-2">
              <Link href="/marketplace/empresas">
                Ver empresas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Carrusel de ofertas ── */}
      {offerProducts.length > 0 && (
        <section className="border-b border-rose-100 bg-gradient-to-b from-rose-50/60 to-white py-10 dark:border-rose-900/20 dark:from-rose-950/10 dark:to-slate-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white">
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Ofertas</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {offerProducts.length} producto{offerProducts.length !== 1 ? 's' : ''} con descuento
                  </p>
                </div>
              </div>
              <span className="hidden animate-pulse rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white sm:inline-block">
                ¡HOT!
              </span>
            </div>
            <MarketplaceProductCarousel products={offerProducts} variant="offers" />
          </div>
        </section>
      )}

      {/* ── Carrusel de destacados ── */}
      {featuredProducts.length > 0 && (
        <section className="border-b border-slate-100 py-10 dark:border-slate-800/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Destacados</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selección de productos marcados como favoritos por cada empresa
                </p>
              </div>
            </div>
            <MarketplaceProductCarousel products={featuredProducts} />
          </div>
        </section>
      )}

      {/* ── Catálogo completo con filtros ── */}
      {/* ── Carrusel de categorías ── */}
      <section className="border-b border-slate-100 py-8 dark:border-slate-800/60">
        <CategoryCarouselSection
          activeId={categoria}
          title="Filtrar por categoría"
          showViewAll={false}
          compact
          showCount
        />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-400" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Catálogo completo</h2>
        </div>
        <ProductsClient
          products={products}
          initialQuery={q ?? ''}
          initialCategory={categoria ?? ''}
        />
      </section>
    </main>
  )
}
