import { Suspense } from 'react'
import { Metadata } from 'next'
import {
  getPublicProducts,
  getPublicCategories,
  resolveWholesaleStatus,
  getPublicBranches,
  getProductsBranchPresence,
} from '@/lib/api/products-server'
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
  StoreContextFilterBar,
} from './components'
import { Search } from 'lucide-react'
import { PRODUCTS_MAX_PRICE, PRODUCTS_PER_PAGE } from '@/lib/constants/products'
import { getPublicTenantPathPrefix, prefixPublicTenantPath } from '@/lib/public/tenant-path'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const name = settings?.company_info?.name || 'Tienda'
  return {
    title: `Catálogo de Productos | ${name}`,
    description: `Explorá el catálogo de ${name}. Productos, ofertas y stock actualizado.`,
    openGraph: {
      title: `Catálogo de Productos | ${name}`,
      description: `Catálogo oficial de productos en ${name}`,
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

  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1)
  const query = (searchParams.query as string) || (searchParams.q as string) || ''
  const categoryId = (searchParams.category_id as string) || (searchParams.categoria as string) || ''
  const brand = (searchParams.brand as string) || (searchParams.marca as string) || ''
  const branchId = (searchParams.branch_id as string) || ''
  const minPrice = Math.max(0, Number(searchParams.min_price) || 0)
  const rawMaxPrice = Number(searchParams.max_price)
  const maxPrice = Number.isFinite(rawMaxPrice) && rawMaxPrice > 0 ? rawMaxPrice : MAX_PRICE
  const inStock = searchParams.in_stock === 'true'
  const offers = searchParams.offers === 'true' || searchParams.ofertas === 'true'
  const sort = (searchParams.sort as string) || 'default'

  const rawPerPage = Number(searchParams.per_page || searchParams.limit)
  const ALLOWED_PER_PAGE = [25, 50, 75, 100]
  const perPage = ALLOWED_PER_PAGE.includes(rawPerPage) ? rawPerPage : PRODUCTS_PER_PAGE

  // Resolve wholesale status once
  const { isWholesale } = await resolveWholesaleStatus()

  // Fetch data in parallel
  const [productsData, categories, branches] = await Promise.all([
    getPublicProducts({
      query,
      categoryId,
      brand,
      branchId: branchId || undefined,
      minPrice,
      maxPrice,
      inStock,
      offers,
      sort,
      page,
      perPage,
      isWholesale,
    }),
    getPublicCategories(isWholesale),
    getPublicBranches(),
  ])

  const { products, total, totalPages, brands, priceRange, branchFilterUnavailable } = productsData
  const selectedBranchName = branchId ? branches.find((b) => b.id === branchId)?.name : undefined

  const productBranchMap =
    !branchId && branches.length > 1
      ? await getProductsBranchPresence(
          products.map((p) => p.id),
          branches
        )
      : {}

  const hasActiveFilters =
    categoryId !== '' ||
    brand !== '' ||
    branchId !== '' ||
    inStock ||
    offers ||
    minPrice > 0 ||
    maxPrice < MAX_PRICE

  const activeFiltersCount = [
    categoryId !== '',
    brand !== '',
    branchId !== '',
    inStock,
    offers,
    minPrice > 0 || maxPrice < MAX_PRICE,
  ].filter(Boolean).length

  return (
    <div className="min-h-screen bg-background">
      <PaginationLinks
        currentPage={page}
        totalPages={totalPages}
        baseUrl={prefixPublicTenantPath(tenantPrefix, '/productos')}
      />

      {/* Breadcrumb + Header comercial */}
      <div className="border-b border-border/60 bg-gradient-to-b from-primary/[0.04] via-card to-background py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs
            homeHref={prefixPublicTenantPath(tenantPrefix, '/inicio')}
            items={[{ label: 'Productos' }]}
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mt-2">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl text-balance">
                Catálogo de Productos
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                {total} {total === 1 ? 'producto disponible' : 'productos disponibles'}
                {query && (
                  <>
                    {' para '}
                    <span className="font-bold text-foreground">
                      &quot;{query}&quot;
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Search bar */}
            <Suspense fallback={<div className="h-10 w-full max-w-sm bg-muted animate-pulse rounded-xl" />}>
              <ProductSearch />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex gap-6 xl:gap-8">
          
          {/* Sidebar filters - Desktop (Fino y Compacto) */}
          <aside className="hidden lg:block w-52 xl:w-56 shrink-0 h-fit sticky top-[80px]">
            <div className="max-h-[calc(100vh-6.5rem)] overflow-hidden rounded-2xl border border-border/80 bg-card p-2.5 shadow-xs">
              <div className="max-h-[calc(100vh-6rem)] overflow-y-auto overscroll-contain pr-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                <Suspense fallback={<div className="h-80 w-full bg-muted animate-pulse rounded-xl" />}>
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
            
            {/* ── Barra Flotante Sticky de Filtros y Ordenamiento al hacer Scroll ── */}
            <div className="sticky top-16 z-30 mb-5 rounded-2xl border border-border/80 bg-background/95 p-2.5 sm:p-3 shadow-md backdrop-blur-xl space-y-2 transition-shadow">
              
              {/* Fila 1 (Arriba): Controles Principales -> Filtros Móviles + Sucursal + Relevancia/Orden */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <MobileFilters
                  activeFiltersCount={activeFiltersCount}
                  priceRange={priceRange}
                  categories={categories}
                  brands={brands}
                  branches={branches}
                />

                <div className="flex items-center gap-2">
                  <Suspense fallback={<div className="h-9 w-[180px] bg-muted animate-pulse rounded-xl" />}>
                    <BranchSelect branches={branches} />
                  </Suspense>
                  <Suspense fallback={<div className="h-9 w-[160px] bg-muted animate-pulse rounded-xl" />}>
                    <ProductSort />
                  </Suspense>
                </div>
              </div>

              {/* Fila 2 (Abajo): Franja Deslizable de Subcategorías y Marcas */}
              <div className="pt-1 border-t border-border/60">
                <StoreContextFilterBar categories={categories} brands={brands} />
              </div>

              {/* Fila 3: Chips de Filtros Activos lado a lado */}
              <div>
                <Suspense>
                  <FilterBadges categories={categories} branches={branches} />
                </Suspense>
              </div>
            </div>

            {/* Product grid */}
            {branchFilterUnavailable ? (
              <div
                className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/30"
                role="alert"
              >
                <h2 className="font-bold text-amber-950 dark:text-amber-100">
                  No pudimos consultar esta sucursal
                </h2>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200/80">
                  Quitá el filtro de sucursal o intentá nuevamente en unos minutos.
                </p>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center bg-card">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3 text-muted-foreground">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  No se encontraron productos
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm leading-relaxed">
                  {query
                    ? `Sin resultados para "${query}". Probá con otros términos o remové filtros.`
                    : 'No hay productos que coincidan con los filtros seleccionados.'}
                </p>
                {(query || hasActiveFilters) && (
                  <div className="mt-4">
                    <Suspense>
                      <ClearAllFiltersButton />
                    </Suspense>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4">
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
              <ProductPagination
                currentPage={page}
                totalPages={totalPages}
                total={total}
                perPage={perPage}
              />
            </Suspense>
          </div>

        </div>
      </div>
    </div>
  )
}
