import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Flame, Package, Sparkles, Star, Store, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarketplaceProductCarousel } from '@/components/public/MarketplaceProductCarousel'
import { ProductsClient } from '@/components/public/ProductsClient'
import { getMarketplaceProductsPage, getMarketplaceCategories, getMarketplaceBrands, getMarketplaceOffers } from '@/lib/public/marketplace'
import { getOfferPricing, mergeOffersIntoCatalog, sortOffersByDiscount } from '@/lib/public/marketplace-offers'

export const metadata: Metadata = {
  title: 'Productos | Marketplace MiPOS',
  description: 'Catálogo global de productos publicados por empresas en el marketplace.',
}

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ q?: string; categoria?: string; subcategoria?: string; marca?: string; ofertas?: string }>
}

export default async function MarketplaceProductsPage({ searchParams }: PageProps) {
  const { q, categoria, subcategoria, marca, ofertas } = await searchParams
  const hasFilters = Boolean(q || categoria || subcategoria || marca)

  const [productPage, categories, categoryBrands, allBrands, allOffers] = await Promise.all([
    getMarketplaceProductsPage(120, { q, categoria, subcategoria, marca }),
    getMarketplaceCategories(),
    categoria ? getMarketplaceBrands(30, { categoria }) : Promise.resolve([]),
    getMarketplaceBrands(60),
    // Las ofertas se piden aparte: sacarlas de los primeros 120 productos del
    // catálogo dejaba afuera las demás. Con filtros, la página filtrada ya
    // trae las que corresponden.
    hasFilters ? Promise.resolve([]) : getMarketplaceOffers(100),
  ])

  const brands = categoria && categoryBrands.length > 0 ? categoryBrands : allBrands
  const offerProducts = sortOffersByDiscount(hasFilters ? productPage.products : allOffers)
  // Sin filtros, el catálogo incluye todas las ofertas para que el filtro
  // «Ofertas» no cuente solo las que entraron en la primera página.
  const products = hasFilters ? productPage.products : mergeOffersIntoCatalog(productPage.products, offerProducts)
  const bestDiscount = offerProducts.length > 0 ? getOfferPricing(offerProducts[0]).percent : 0
  const offersHref = (() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (categoria) params.set('categoria', categoria)
    if (subcategoria) params.set('subcategoria', subcategoria)
    if (marca) params.set('marca', marca)
    params.set('ofertas', '1')
    return `/marketplace/productos?${params.toString()}#catalogo`
  })()

  const explicitFeatured = products.filter((p) => p.featured)
  const nonFeatured = products.filter((p) => !p.featured)
  const featuredProducts = explicitFeatured.length >= 6
    ? explicitFeatured
    : [...explicitFeatured, ...nonFeatured].slice(0, Math.min(12, products.length))

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
                  {productPage.total} producto{productPage.total !== 1 ? 's' : ''} encontrado{productPage.total !== 1 ? 's' : ''}
                </span>
                {productPage.total > products.length && (
                  <span className="text-xs text-muted-foreground">
                    Mostrando {products.length}
                  </span>
                )}
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
              <Link href="/marketplace/empresas">
                <Store className="h-4 w-4" />
                Ver todas las tiendas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Carrusel ofertas ─────────────────────────────────────────────────── */}
      {/* También con categoría o marca elegida: antes se ocultaba justo cuando
          alguien buscaba algo concreto. */}
      {offerProducts.length > 0 && (
        <section aria-labelledby="ofertas-titulo" className="border-b border-border/80 bg-muted/30 py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white">
                  <Flame className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="ofertas-titulo" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                    {hasFilters ? 'Ofertas en esta búsqueda' : 'Ofertas del marketplace'}
                  </h2>
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    {offerProducts.length} producto{offerProducts.length !== 1 ? 's' : ''} con descuento, de mayor a menor
                    {bestDiscount > 0 && (
                      <span className="ml-1.5 font-semibold text-rose-600 dark:text-rose-400">· hasta -{bestDiscount}%</span>
                    )}
                  </p>
                </div>
              </div>

              <Button asChild size="sm" variant="outline" className="gap-1.5 rounded-xl bg-card">
                <Link href={offersHref}>
                  Ver todas las ofertas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
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



      {/* ── Catálogo completo con Filtros por Categoría, Subcategoría y Marca ── */}
      <section id="catalogo" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-8 sm:px-6 lg:px-8">
        <ProductsClient
          products={products}
          initialOnlyOffers={ofertas === '1'}
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
