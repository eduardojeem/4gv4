import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, ChevronRight, Package, Search, Store } from 'lucide-react'
import { MarketplaceSearchBox } from '@/components/public/MarketplaceSearchBox'
import { OrganizationDirectoryCard } from '@/components/public/OrganizationDirectoryCard'
import { ProductsClient } from '@/components/public/ProductsClient'
import { getMarketplaceOrganizations, getMarketplaceProducts } from '@/lib/public/marketplace'

export const metadata: Metadata = {
  title: 'Buscar | Marketplace MiPOS',
  description: 'Busqueda global de productos y empresas del marketplace MiPOS.',
}

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ q?: string }>
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export default async function MarketplaceSearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''
  const normalizedQuery = normalizeSearch(query)

  const [products, organizations] = await Promise.all([
    getMarketplaceProducts(160),
    getMarketplaceOrganizations(160),
  ])

  const matchedProducts = normalizedQuery
    ? products.filter((product) => {
        const haystack = normalizeSearch([
          product.name,
          product.sku,
          product.brand,
          product.category?.name,
          product.organization_name,
        ].filter(Boolean).join(' '))

        return haystack.includes(normalizedQuery)
      })
    : products

  const matchedOrganizations = normalizedQuery
    ? organizations.filter((organization) => {
        const productNames = organization.featured_products.map((product) => product.name).join(' ')
        const haystack = normalizeSearch(`${organization.name} ${organization.slug} ${organization.plan ?? ''} ${productNames}`)

        return haystack.includes(normalizedQuery)
      })
    : organizations

  return (
    <main>
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
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {query ? (
          <div className="mb-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            Resultados para <strong className="text-slate-900 dark:text-slate-50">&quot;{query}&quot;</strong>: {matchedProducts.length} producto{matchedProducts.length !== 1 ? 's' : ''} y {matchedOrganizations.length} empresa{matchedOrganizations.length !== 1 ? 's' : ''}.
          </div>
        ) : (
          <div className="mb-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
            Escribe una busqueda para filtrar el marketplace. Mientras tanto se muestran productos y empresas recientes.
          </div>
        )}

        {matchedProducts.length > 0 && (
          <div>
            <div className="mb-5 flex items-center gap-2">
              <Package className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Productos encontrados</h2>
            </div>
            <ProductsClient products={matchedProducts} initialQuery="" />
          </div>
        )}

        {matchedOrganizations.length > 0 && (
          <div className="mt-12">
            <div className="mb-5 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Empresas encontradas</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {matchedOrganizations.map((organization) => (
                <OrganizationDirectoryCard key={organization.id} organization={organization} />
              ))}
            </div>
          </div>
        )}

        {matchedProducts.length === 0 && matchedOrganizations.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
            <Search className="mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="font-medium text-slate-700 dark:text-slate-300">Sin resultados para &quot;{query}&quot;</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Prueba buscar por producto, empresa, marca o categoria.</p>
          </div>
        )}
      </section>
    </main>
  )
}
