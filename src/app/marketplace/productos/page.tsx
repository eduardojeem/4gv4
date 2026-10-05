import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, ChevronRight, Package, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductsClient } from '@/components/public/ProductsClient'
import { getMarketplaceProductsPage, getMarketplaceCategories, getMarketplaceBrands } from '@/lib/public/marketplace'

export const metadata: Metadata = {
  title: 'Productos | Marketplace MiPOS',
  description: 'Catálogo global de productos publicados por empresas en el marketplace.',
}

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{
    q?: string
    categoria?: string
    subcategoria?: string
    marca?: string
    pagina?: string
    porPagina?: string
    orden?: string
  }>
}

const PAGE_SIZE_OPTIONS = [12, 28, 48, 100] as const
const SORT_OPTIONS = ['default', 'price_asc', 'price_desc', 'newest', 'name_asc'] as const

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export default async function MarketplaceProductsPage({ searchParams }: PageProps) {
  const { q, categoria, subcategoria, marca, pagina, porPagina, orden } = await searchParams
  const requestedPage = parsePositiveInteger(pagina, 1)
  const parsedPageSize = parsePositiveInteger(porPagina, 28)
  const pageSize = PAGE_SIZE_OPTIONS.includes(parsedPageSize as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsedPageSize : 28
  const sort = SORT_OPTIONS.includes(orden as (typeof SORT_OPTIONS)[number])
    ? orden as (typeof SORT_OPTIONS)[number]
    : 'default'
  const offset = (requestedPage - 1) * pageSize

  const [productPage, categories, categoryBrands, allBrands] = await Promise.all([
    getMarketplaceProductsPage(pageSize, { q, categoria, subcategoria, marca, offset, orden: sort }),
    getMarketplaceCategories(),
    categoria ? getMarketplaceBrands(30, { categoria }) : Promise.resolve([]),
    getMarketplaceBrands(60),
  ])

  const brands = categoria && categoryBrands.length > 0 ? categoryBrands : allBrands
  const totalPages = Math.max(1, Math.ceil(productPage.total / pageSize))
  if (productPage.total > 0 && requestedPage > totalPages) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (categoria) params.set('categoria', categoria)
    if (subcategoria) params.set('subcategoria', subcategoria)
    if (marca) params.set('marca', marca)
    if (pageSize !== 28) params.set('porPagina', String(pageSize))
    if (sort !== 'default') params.set('orden', sort)
    if (totalPages > 1) params.set('pagina', String(totalPages))
    redirect(`/marketplace/productos?${params.toString()}#catalogo`)
  }
  const currentPage = requestedPage

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
                {productPage.total > productPage.products.length && (
                  <span className="text-xs text-muted-foreground">
                    Mostrando {offset + 1}-{Math.min(offset + productPage.products.length, productPage.total)}
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

      {/* ── Catálogo completo con Filtros por Categoría, Subcategoría y Marca ── */}
      <section id="catalogo" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-8 sm:px-6 lg:px-8">
        <ProductsClient
          products={productPage.products}
          totalProducts={productPage.total}
          currentPage={currentPage}
          currentPageSize={pageSize}
          serverPaginated
          categories={categories}
          brands={brands}
          initialQuery={q ?? ''}
          initialCategory={categoria ?? ''}
          initialSubcategory={subcategoria ?? ''}
          initialBrand={marca ?? ''}
          initialSort={sort}
        />
      </section>
    </div>
  )
}
