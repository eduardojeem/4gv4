import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Flame, Package, Sparkles, Star, Store, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarketplaceProductCarousel } from '@/components/public/MarketplaceProductCarousel'
import { ProductsClient } from '@/components/public/ProductsClient'
import { CategoryCarouselSection } from '@/components/public/CategoryCarouselSection'
import { getMarketplaceProducts, getMarketplaceCategories, getMarketplaceBrands } from '@/lib/public/marketplace'

export const metadata: Metadata = {
  title: 'Productos | Marketplace MiPOS',
  description: 'Catálogo global de productos publicados por empresas en el marketplace.',
}

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ q?: string; categoria?: string; subcategoria?: string; marca?: string }>
}

export default async function MarketplaceProductsPage({ searchParams }: PageProps) {
  const { q, categoria, subcategoria, marca } = await searchParams

  const [products, categories, categoryBrands, allBrands] = await Promise.all([
    getMarketplaceProducts(120, { q, categoria, subcategoria, marca }),
    getMarketplaceCategories(),
    categoria ? getMarketplaceBrands(30, { categoria }) : Promise.resolve([]),
    getMarketplaceBrands(60),
  ])

  const brands = categoria && categoryBrands.length > 0 ? categoryBrands : allBrands
  const offerProducts = products.filter((p) => p.has_offer && p.offer_price && p.offer_price < p.sale_price)
  const featuredProducts = products.filter((p) => p.featured && !(p.has_offer && p.offer_price))

  return (
    <div className="min-h-screen">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border/80 bg-gradient-to-b from-primary/[0.04] via-card to-background">
        <div className="pointer-events-none absolute -left-12 -top-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute right-4 top-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href="/marketplace"
              className="flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <Store className="h-3.5 w-3.5" />
              Marketplace
            </Link>
            <ChevronRight className="h-3 w-3 opacity-60" />
            <span className="font-semibold text-foreground bg-muted px-2 py-0.5 rounded-md">
              Productos
            </span>
          </nav>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            {/* Título + stats */}
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                  <Package className="h-5 w-5" />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  Catálogo de Productos
                </h1>
              </div>

              {/* Pills de stats */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {products.length} producto{products.length !== 1 ? 's' : ''} disponibles
                </span>
                {offerProducts.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 shadow-xs dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
                    <Tag className="h-3 w-3" />
                    {offerProducts.length} en oferta
                  </span>
                )}
                {featuredProducts.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
                    <Sparkles className="h-3 w-3" />
                    {featuredProducts.length} destacados
                  </span>
                )}
              </div>
            </div>

            {/* CTA */}
            <Button
              asChild
              size="sm"
              variant="outline"
              className="w-fit shrink-0 gap-2 rounded-xl border-border/80 bg-card shadow-xs hover:bg-muted"
            >
              <Link href="/marketplace/tiendas">
                <Store className="h-4 w-4" />
                Ver todas las tiendas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Carrusel ofertas ─────────────────────────────────────────────────── */}
      {offerProducts.length > 0 && !categoria && !marca && (
        <section className="border-b border-rose-100 bg-gradient-to-b from-rose-50/50 via-rose-50/20 to-white py-8 dark:border-rose-900/20 dark:from-rose-950/20 dark:via-slate-950 dark:to-slate-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500 text-white shadow-sm shadow-rose-500/30">
                  <Flame className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
                    Ofertas destacadas
                  </h2>
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    Precios promocionales por tiempo limitado
                  </p>
                </div>
              </div>

              <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
                {offerProducts.length} ofertas
              </span>
            </div>

            <MarketplaceProductCarousel products={offerProducts} variant="offers" />
          </div>
        </section>
      )}

      {/* ── Carrusel destacados con Pasarela Automática ──────────────────────── */}
      {featuredProducts.length > 0 && !categoria && !marca && (
        <section className="relative overflow-hidden border-b border-amber-200/50 bg-gradient-to-b from-amber-50/60 via-amber-50/20 to-white py-10 dark:border-amber-900/30 dark:from-amber-950/20 dark:via-slate-950/50 dark:to-slate-950">
          <div className="pointer-events-none absolute -right-6 top-0 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl dark:bg-amber-500/5" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-400/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                      Productos destacados
                    </h2>
                    <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shadow-xs border border-amber-300/40">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      RECOMENDADOS
                    </span>
                  </div>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-0.5">
                    {featuredProducts.length} producto{featuredProducts.length !== 1 ? 's' : ''} seleccionados por calidad y popularidad
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 shadow-xs dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300">
                  <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  Top Selección
                </span>
              </div>
            </div>

            <MarketplaceProductCarousel products={featuredProducts} variant="featured" />
          </div>
        </section>
      )}

      {/* ── Barra de categorías sticky ─────────────────────────────────────── */}
      <div className="sticky top-16 z-20 border-b border-border/80 bg-background/95 py-2.5 backdrop-blur-md">
        <CategoryCarouselSection
          activeId={categoria}
          showViewAll={false}
          showCount
        />
      </div>

      {/* ── Catálogo completo con Filtros por Categoría, Subcategoría y Marca ── */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ProductsClient
          products={products}
          categories={categories}
          brands={brands}
          initialQuery={q ?? ''}
          initialCategory={categoria ?? ''}
          initialSubcategory={subcategoria ?? ''}
          initialBrand={marca ?? ''}
        />
      </section>
    </div>
  )
}
