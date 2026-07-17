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
    <main className="min-h-screen">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        {/* Gradiente de fondo */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_50%,rgba(6,182,212,0.07),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_80%_20%,rgba(139,92,246,0.04),transparent)]" />

        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Link
              href="/marketplace"
              className="flex items-center gap-1 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
            >
              <Store className="h-3 w-3" />
              Marketplace
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
            <span className="font-medium text-slate-700 dark:text-slate-200">Productos</span>
          </nav>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            {/* Título + stats */}
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-sm shadow-cyan-500/30">
                  <Package className="h-5 w-5" />
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
                  Productos
                </h1>
              </div>

              {/* Pills de stats */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {products.length} producto{products.length !== 1 ? 's' : ''} disponibles
                </span>
                {offerProducts.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
                    <Tag className="h-3 w-3" />
                    {offerProducts.length} en oferta
                  </span>
                )}
                {featuredProducts.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
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
              className="shrink-0 gap-2 rounded-xl"
            >
              <Link href="/marketplace/empresas">
                Ver empresas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Carrusel ofertas ───────────────────────────────────────────────── */}
      {offerProducts.length > 0 && (
        <section className="relative overflow-hidden border-b border-rose-100/80 bg-gradient-to-b from-rose-50/50 via-rose-50/20 to-white py-10 dark:border-rose-950/30 dark:from-rose-950/10 dark:to-slate-950">
          {/* Subtle warm glow behind section */}
          <div className="pointer-events-none absolute -left-4 top-0 h-40 w-40 rounded-full bg-rose-500/5 blur-3xl" />
          
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-md shadow-rose-500/20">
                  <Tag className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                    Ofertas imperdibles
                  </h2>
                  <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                    {offerProducts.length} producto{offerProducts.length !== 1 ? 's' : ''} en promoción por tiempo limitado
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  ⚡ SUPER PRECIO
                </span>
              </div>
            </div>
            <MarketplaceProductCarousel products={offerProducts} variant="offers" />
          </div>
        </section>
      )}

      {/* ── Carrusel destacados ────────────────────────────────────────────── */}
      {featuredProducts.length > 0 && (
        <section className="border-b border-slate-100 py-8 dark:border-slate-800/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-sm shadow-cyan-500/30">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Destacados</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Seleccionados por cada empresa
                </p>
              </div>
            </div>
            <MarketplaceProductCarousel products={featuredProducts} />
          </div>
        </section>
      )}

      {/* ── Barra de categorías sticky ─────────────────────────────────────── */}
      <div className="sticky top-16 z-20 border-b border-slate-200/80 bg-white/95 py-2.5 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-950/95">
        <CategoryCarouselSection
          activeId={categoria}
          showViewAll={false}
          showCount
        />
      </div>

      {/* ── Catálogo completo ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ProductsClient
          products={products}
          initialQuery={q ?? ''}
          initialCategory={categoria ?? ''}
        />
      </section>
    </main>
  )
}
