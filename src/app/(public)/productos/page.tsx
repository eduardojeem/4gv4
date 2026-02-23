
import { Suspense } from 'react'
import { Metadata } from 'next'
import { getPublicProducts, getPublicCategories, resolveWholesaleStatus } from '@/lib/api/products-server'
import { ProductCard } from '@/components/public/ProductCard'
import { ProductFilters } from '@/components/public/ProductFilters'
import { Breadcrumbs } from '@/components/public/Breadcrumbs'
import {
  ProductSearch,
  ProductSort,
  ProductPagination,
  MobileFilters,
  FilterBadges,
  ClearAllFiltersButton,
} from './components'
import { Search } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Catálogo de Productos | 4G Celulares',
  description: 'Explora nuestra amplia gama de celulares, repuestos y accesorios. Encuentra las mejores marcas y precios.',
}

const MAX_PRICE = 50_000_000

export default async function ProductsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const page = Number(searchParams.page) || 1
  const query = searchParams.query as string || ''
  const categoryId = searchParams.category_id as string || ''
  const brand = searchParams.brand as string || ''
  const minPrice = Number(searchParams.min_price) || 0
  const maxPrice = Number(searchParams.max_price) || MAX_PRICE
  const inStock = searchParams.in_stock === 'true'
  const sort = searchParams.sort as string || 'name'

  // Resolve wholesale status once — pass it down to avoid redundant DB queries
  const { isWholesale } = await resolveWholesaleStatus()

  // Fetch data in parallel (categories don't need session)
  const [productsData, categories] = await Promise.all([
    getPublicProducts({
      query,
      categoryId,
      brand,
      minPrice,
      maxPrice,
      inStock,
      sort,
      page,
      perPage: 16,
      isWholesale,
    }),
    getPublicCategories()
  ])

  const { products, total, totalPages, brands, priceRange } = productsData

  const hasActiveFilters = (
    categoryId !== '' ||
    brand !== '' ||
    inStock ||
    minPrice > 0 ||
    maxPrice < MAX_PRICE
  )

  const activeFiltersCount = [
    categoryId !== '',
    brand !== '',
    inStock,
    minPrice > 0 || maxPrice < MAX_PRICE,
  ].filter(Boolean).length

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb + title bar */}
      <div className="border-b border-border/40 bg-muted/20">
        <div className="container py-6">
          <Breadcrumbs items={[{ label: 'Productos' }]} />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl text-balance">
                Nuestros Productos
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {total} {total === 1 ? 'producto encontrado' : 'productos encontrados'}
                {query && (
                  <>
                    {' para '}
                    <span className="font-medium text-foreground">
                      &quot;{query}&quot;
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Search bar */}
            <Suspense fallback={<div className="h-10 w-full max-w-sm bg-muted animate-pulse rounded-lg" />}>
              <ProductSearch />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container py-6 lg:py-8">
        <div className="flex gap-6 xl:gap-8">
          {/* Sidebar filters - Desktop */}
          <aside className="hidden lg:block w-64 xl:w-72 shrink-0">
            <div className="sticky top-24">
              <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur-sm">
                <Suspense fallback={<div className="h-96 w-full bg-muted animate-pulse rounded-lg" />}>
                  <ProductFilters
                    priceRange={priceRange}
                    categories={categories}
                    brands={brands}
                  />
                </Suspense>
              </div>
            </div>
          </aside>

          {/* Products area */}
          <div className="flex-1 min-w-0">
            {/* Toolbar row */}
            <div className="sticky top-16 z-30 mb-5 border-y border-border/60 bg-background/90 px-3 py-3 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/75 sm:rounded-2xl sm:border sm:bg-card/70 sm:p-4 lg:static lg:bg-card/60">
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                {/* Mobile filter trigger */}
                <MobileFilters
                  activeFiltersCount={activeFiltersCount}
                  priceRange={priceRange}
                  categories={categories}
                  brands={brands}
                />
                <Suspense fallback={<div className="h-9 w-[150px] bg-muted animate-pulse rounded-lg" />}>
                  <ProductSort />
                </Suspense>
              </div>
              <div className="mt-3">
                <Suspense>
                  <FilterBadges categories={categories} />
                </Suspense>
              </div>
            </div>

            {/* Product grid */}
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Search className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  No se encontraron productos
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  {query
                    ? `Sin resultados para "${query}". Intenta con otros terminos.`
                    : 'No hay productos que coincidan con los filtros seleccionados.'}
                </p>
                {(query || hasActiveFilters) && (
                  <div className="mt-5">
                    <Suspense>
                      <ClearAllFiltersButton />
                    </Suspense>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    priority={index < 4}
                    isWholesale={isWholesale}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            <Suspense>
                <ProductPagination currentPage={page} totalPages={totalPages} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
