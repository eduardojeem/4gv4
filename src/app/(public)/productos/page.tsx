
import { Suspense } from 'react'
import { Metadata } from 'next'
import { getPublicProducts, getPublicCategories, resolveWholesaleStatus, getPublicBranches, getProductsBranchPresence } from '@/lib/api/products-server'
import { ProductCard } from '@/components/public/ProductCard'
import { ProductFilters } from '@/components/public/ProductFilters'
import { Breadcrumbs } from '@/components/public/Breadcrumbs'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import {
  ProductSearch,
  ProductSort,
  BranchSelect,
  ProductPagination,
  MobileFilters,
  FilterBadges,
  ClearAllFiltersButton,
  PaginationLinks,
} from './components'
import { Search } from 'lucide-react'
import { PRODUCTS_MAX_PRICE, PRODUCTS_PER_PAGE } from '@/lib/constants/products'
import { getPublicTenantPathPrefix, prefixPublicTenantPath } from '@/lib/public/tenant-path'

// La página es dinámica de facto: getPublicProducts llama headers() para
// resolver el tenant, así que un revalidate a nivel de ruta no aplicaría.
// El caché real (facetas de marcas/precio) vive en getProductFacets con
// unstable_cache. Los resultados dependen de los filtros y no se cachean.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const name = settings?.company_info?.name || 'Tienda'
  return {
    title: `Catálogo de Productos | ${name}`,
    description: `Explorá el catálogo de ${name}. Celulares, repuestos y accesorios con las mejores marcas y precios.`,
    openGraph: {
      title: `Catálogo de Productos | ${name}`,
      description: `Celulares, repuestos y accesorios en ${name}`,
      type: 'website',
    },
  }
}

const MAX_PRICE = PRODUCTS_MAX_PRICE

export default async function ProductsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const tenantPrefix = await getPublicTenantPathPrefix()
  // page/precios vienen de la URL: clamp para que valores negativos o basura
  // no lleguen al query (page=-1 producía un range inválido y un 500).
  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1)
  const query = searchParams.query as string || ''
  const categoryId = searchParams.category_id as string || ''
  const brand = searchParams.brand as string || ''
  const branchId = searchParams.branch_id as string || ''
  const minPrice = Math.max(0, Number(searchParams.min_price) || 0)
  // #4 — max_price negativo o cero produce un rango vacío. Se trata como "sin límite".
  const rawMaxPrice = Number(searchParams.max_price)
  const maxPrice = Number.isFinite(rawMaxPrice) && rawMaxPrice > 0 ? rawMaxPrice : MAX_PRICE
  const inStock = searchParams.in_stock === 'true'
  const sort = searchParams.sort as string || 'name'

  // Resolve wholesale status once — pass it down to avoid redundant DB queries
  const { isWholesale } = await resolveWholesaleStatus()

  // Fetch data in parallel (categories don't need session)
  const [productsData, categories, branches] = await Promise.all([
    getPublicProducts({
      query,
      categoryId,
      brand,
      branchId: branchId || undefined,
      minPrice,
      maxPrice,
      inStock,
      sort,
      page,
      perPage: PRODUCTS_PER_PAGE,
      isWholesale,
    }),
    getPublicCategories(isWholesale),
    getPublicBranches(),
  ])

  const { products, total, totalPages, brands, priceRange, branchFilterUnavailable } = productsData
  const selectedBranchName = branchId ? branches.find((b) => b.id === branchId)?.name : undefined

  // When browsing all branches, resolve which branches each product has stock in
  // so the cards can still identify their location.
  const productBranchMap =
    !branchId && branches.length > 1
      ? await getProductsBranchPresence(products.map((p) => p.id), branches)
      : {}

  const hasActiveFilters = (
    categoryId !== '' ||
    brand !== '' ||
    branchId !== '' ||
    inStock ||
    minPrice > 0 ||
    maxPrice < MAX_PRICE
  )

  const activeFiltersCount = [
    categoryId !== '',
    brand !== '',
    branchId !== '',
    inStock,
    minPrice > 0 || maxPrice < MAX_PRICE,
  ].filter(Boolean).length

  // State for sidebar collapse is managed by the client component, 
  // but we can pass a handler if we need to adjust layout
  
  return (
    <div className="min-h-screen bg-background">
      <PaginationLinks currentPage={page} totalPages={totalPages} baseUrl={prefixPublicTenantPath(tenantPrefix, '/productos')} />
      {/* Breadcrumb + title bar */}
      <div className="border-b border-border/40 bg-muted/20">
        <div className="container py-6">
          <Breadcrumbs homeHref={prefixPublicTenantPath(tenantPrefix, '/inicio')} items={[{ label: 'Productos' }]} />
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
          <aside className="hidden lg:block shrink-0 h-fit sticky top-[108px]">
             {/* The width is now controlled by the content within the ProductFilters component when it collapses/expands */}
             <div className="max-h-[calc(100vh-7.5rem)] overflow-hidden rounded-lg border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm transition-all duration-300">
               <div className="max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain p-4 pr-3 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                 <Suspense fallback={<div className="h-96 w-64 bg-muted animate-pulse rounded-lg" />}>
                   <ProductFilters
                     priceRange={priceRange}
                    categories={categories}
                    brands={brands}
                    branches={branches}
                  />
                </Suspense>
               </div>
              </div>
          </aside>

          {/* Products area */}
          <div className="flex-1 min-w-0">
            {/* Toolbar row */}
            <div className="sticky top-[74px] z-30 mb-5 border-y border-border/60 bg-background/95 px-3 py-3 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/80 sm:rounded-lg sm:border sm:bg-card/70 sm:p-4 lg:static lg:bg-card/60">
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                {/* Mobile filter trigger */}
                <MobileFilters
                  activeFiltersCount={activeFiltersCount}
                  priceRange={priceRange}
                  categories={categories}
                  brands={brands}
                  branches={branches}
                />
                <div className="flex items-center gap-2">
                  <Suspense fallback={<div className="h-9 w-[180px] bg-muted animate-pulse rounded-lg" />}>
                    <BranchSelect branches={branches} />
                  </Suspense>
                  <Suspense fallback={<div className="h-9 w-[150px] bg-muted animate-pulse rounded-lg" />}>
                    <ProductSort />
                  </Suspense>
                </div>
              </div>
              <div className="mt-3">
                <Suspense>
                  <FilterBadges categories={categories} branches={branches} />
                </Suspense>
              </div>
            </div>

            {/* Product grid */}
            {branchFilterUnavailable ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-8 text-center dark:border-amber-900/60 dark:bg-amber-950/30" role="alert">
                <h2 className="font-semibold text-amber-950 dark:text-amber-100">No pudimos consultar esta sucursal</h2>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200/80">
                  Quitá el filtro de sucursal o intentá nuevamente en unos minutos.
                </p>
              </div>
            ) : products.length === 0 ? (
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    priority={index < 2}
                    isWholesale={isWholesale}
                    branchName={selectedBranchName}
                    productBranches={productBranchMap[product.id]}
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
