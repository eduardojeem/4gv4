import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Building2, ChevronRight, Package, Search, Store } from 'lucide-react'
import { MarketplaceSearchBox } from '@/components/public/MarketplaceSearchBox'
import { OrganizationDirectoryCard } from '@/components/public/OrganizationDirectoryCard'
import { ProductsClient } from '@/components/public/ProductsClient'
import { getMarketplaceOrganizations, getMarketplaceProductsPage } from '@/lib/public/marketplace'
import { SiteSearchTracker } from '@/components/analytics/SiteSearchTracker'

export const metadata: Metadata = {
  title: 'Buscar | Marketplace MiPOS',
  description: 'Busqueda global de productos y empresas del marketplace MiPOS.',
}

export const dynamic = 'force-dynamic'

/** La búsqueda y la paginación se resuelven sobre el catálogo en el servidor. */
const PRODUCT_RESULTS = 28
const ORGANIZATION_RESULTS = 48

type PageProps = {
  searchParams: Promise<{ q?: string; marca?: string; categoria?: string; subcategoria?: string; ofertas?: string; pagina?: string; porPagina?: string; orden?: string }>
}

export default async function MarketplaceSearchPage({ searchParams }: PageProps) {
  const { q, marca, categoria, subcategoria, ofertas, pagina, porPagina, orden } = await searchParams
  const onlyOffers = ofertas === '1'
  const query = q?.trim() ?? ''
  const requestedPage = Number(pagina)
  const currentPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const requestedSize = Number(porPagina)
  const pageSize = [12, 28, 48, 100].includes(requestedSize) ? requestedSize : PRODUCT_RESULTS
  const sort = orden === 'price_asc' || orden === 'price_desc' || orden === 'newest' || orden === 'name_asc' ? orden : 'default'
  const offset = (currentPage - 1) * pageSize

  const [productPage, organizations] = await Promise.all([
    getMarketplaceProductsPage(pageSize, { q: query || undefined, categoria, subcategoria, marca, offset, orden: sort, onlyOffers }),
    getMarketplaceOrganizations(ORGANIZATION_RESULTS, { q: query || undefined }),
  ])
  const brands = productPage.brands ?? []

  const products = productPage.products
  const lastPage = Math.max(1, Math.ceil(productPage.total / pageSize))
  if (currentPage > lastPage) {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (marca) params.set('marca', marca)
    if (categoria) params.set('categoria', categoria)
    if (subcategoria) params.set('subcategoria', subcategoria)
    if (onlyOffers) params.set('ofertas', '1')
    if (sort !== 'default') params.set('orden', sort)
    if (pageSize !== PRODUCT_RESULTS) params.set('porPagina', String(pageSize))
    if (lastPage > 1) params.set('pagina', String(lastPage))
    redirect(`/marketplace/buscar?${params.toString()}#catalogo`)
  }

  return (
    <div>
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(6,182,212,0.08),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <nav className="mb-5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/marketplace" className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300">
              <Store className="h-3 w-3" />
              Marketplace
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-medium text-slate-700 dark:text-slate-200">Buscar</span>
          </nav>

          <div className="max-w-3xl">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white">
                <Search className="h-5 w-5" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Busqueda global
              </h1>
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Busca productos, empresas, categorias, marcas y codigos publicados en el marketplace.
            </p>
            <MarketplaceSearchBox className="mt-6 max-w-2xl" initialQuery={query} autoFocus />
            {query && (
              <SiteSearchTracker term={query} resultsCount={productPage.total + organizations.length} />
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {query ? (
          <div className="mb-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            Resultados para <strong className="text-slate-900 dark:text-slate-50">&quot;{query}&quot;</strong>: {productPage.total} producto{productPage.total !== 1 ? 's' : ''} y {organizations.length} empresa{organizations.length !== 1 ? 's' : ''}.
          </div>
        ) : (
          <div className="mb-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            Escribe una busqueda para filtrar el marketplace. Mientras tanto se muestran productos y empresas recientes.
          </div>
        )}

        {(
          <div>
            <div className="mb-5 flex items-center gap-2">
              <Package className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Productos encontrados</h2>
            </div>
            {/*
              `initialQuery` tiene que ser el termino real: ProductsClient sincroniza
              su buscador con la URL y, si lo recibe vacio mientras la URL trae `?q=`,
              a los 400 ms reescribe la URL sin el termino y borra la busqueda recien
              hecha. `hideSearch` deja un solo buscador en la pantalla: el de arriba.
            */}
            <ProductsClient products={products} initialQuery={query} initialBrand={marca ?? ''}
              initialCategory={categoria ?? ''} initialSubcategory={subcategoria ?? ''}
              categories={productPage.categories ?? []} initialOnlyOffers={onlyOffers}
              initialSort={sort} brands={brands} totalProducts={productPage.total}
              currentPage={currentPage} currentPageSize={pageSize} serverPaginated hideSearch />
          </div>
        )}

        {organizations.length > 0 && (
          <div className="mt-12">
            <div className="mb-5 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Empresas encontradas</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {organizations.map((organization) => (
                <OrganizationDirectoryCard key={organization.id} organization={organization} />
              ))}
            </div>
          </div>
        )}

        {products.length === 0 && organizations.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
            <Search className="mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="font-medium text-slate-700 dark:text-slate-300">Sin resultados para &quot;{query}&quot;</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Prueba buscar por producto, empresa, marca o categoria.</p>
          </div>
        )}
      </section>
    </div>
  )
}
