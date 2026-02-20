
import { Suspense } from 'react'
import { Metadata } from 'next'
import { getPublicProducts, getPublicCategories } from '@/lib/api/products-server'
import { ProductCard } from '@/components/public/ProductCard'
import { ProductFilters } from '@/components/public/ProductFilters'
import { Breadcrumbs } from '@/components/public/Breadcrumbs'
import { ProductSearch, ProductSort, ProductPagination, MobileFilters, FilterBadges } from './components'
import { Package, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Catálogo de Productos | 4G Celulares',
  description: 'Explora nuestra amplia gama de celulares, repuestos y accesorios. Encuentra las mejores marcas y precios.',
}

export default async function ProductsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const page = Number(searchParams.page) || 1
  const query = searchParams.query as string || ''
  const categoryId = searchParams.category_id as string || ''
  const brand = searchParams.brand as string || ''
  const minPrice = Number(searchParams.min_price) || 0
  const maxPrice = Number(searchParams.max_price) || 50000000
  const inStock = searchParams.in_stock === 'true'
  const sort = searchParams.sort as string || 'name'

  // Determine wholesale status for accurate SSR pricing
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  let isWholesale = false
  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
    const role = profile?.role || session.user.user_metadata?.role
    isWholesale = role === 'mayorista' || role === 'client_mayorista'
  }

  // Fetch data in parallel
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
    }),
    getPublicCategories()
  ])

  const { products, total, totalPages, brands, priceRange } = productsData

  const activeFiltersCount = [
    categoryId !== '',
    brand !== '',
    inStock,
    minPrice > 0 || maxPrice < 50000000,
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
        <div className="flex gap-8">
          {/* Sidebar filters - Desktop */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24">
              <Suspense fallback={<div className="h-96 w-full bg-muted animate-pulse rounded-lg" />}>
                <ProductFilters
                  priceRange={priceRange}
                  categories={categories}
                  brands={brands}
                />
              </Suspense>
            </div>
          </aside>

          {/* Products area */}
          <div className="flex-1 min-w-0">
            {/* Toolbar row */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2">
                {/* Mobile filter trigger */}
                <MobileFilters
                  activeFiltersCount={activeFiltersCount}
                  priceRange={priceRange}
                  categories={categories}
                  brands={brands}
                />

                {/* Active filters chips */}
                <Suspense>
                    <FilterBadges categories={categories} />
                </Suspense>
              </div>

              <Suspense fallback={<div className="h-9 w-[150px] bg-muted animate-pulse rounded-lg" />}>
                <ProductSort />
              </Suspense>
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
                {(query || activeFiltersCount > 0) && (
                   <Suspense>
                        {/* We reuse FilterBadges clear all logic or add a dedicated clear button here 
                            but for now let's just show a simple clear filters link using Next Link or just rely on the sidebar/top bar
                            Actually let's just put a clear button.
                        */}
                       <div className="mt-4">
                           {/* Simplified clear button logic handled by FilterBadges mostly, 
                               but here we might want a direct "Start Over" action. 
                               For now, the user can use the top bar chips.
                           */}
                       </div>
                   </Suspense>
                )}
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
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
