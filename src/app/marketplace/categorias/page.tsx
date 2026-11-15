import type { Metadata } from 'next'
import { getMarketplaceCategories, getMarketplaceBrands } from '@/lib/public/marketplace'
import { MarketplaceBrandsSection } from '@/components/public/MarketplaceBrandsSection'
import { CategoriesClient } from '@/components/public/CategoriesClient'
import { MarketplaceCategoriesShowcase } from '@/components/public/MarketplaceCategoriesShowcase'
import { getLocationCatalog } from '@/lib/public/marketplace-location-catalog'
import { buildCategoryShowcase } from '@/lib/public/category-showcase'
import Link from 'next/link'
import { ChevronRight, LayoutGrid, Store } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Categorías | Marketplace MiTiendaPy',
  description: 'Explora todos los productos del marketplace por categoría y rubro comercial.',
}

// Query the live catalog only at request time; CI builds do not have admin credentials.
// Catalog helpers retain their own shared data cache.
export const dynamic = 'force-dynamic'

export default async function MarketplaceCategoriesPage() {
  const [categories, brands, catalogProducts] = await Promise.all([
    getMarketplaceCategories(),
    getMarketplaceBrands(48),
    // Si el catálogo no responde, el carrusel muestra los rubros con búsqueda por texto.
    getLocationCatalog().then((catalog) => catalog.products).catch(() => null),
  ])
  const showcase = catalogProducts ? buildCategoryShowcase(catalogProducts) : null
  const totalProducts = showcase ? Object.values(showcase).reduce((sum, rubro) => sum + (rubro?.count ?? 0), 0) : 0

  return (
    <div className="min-h-screen">
      {/* ── Título de la página ── */}
      <section className="border-b border-border/80 bg-gradient-to-b from-primary/[0.04] via-card to-background py-5 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground sm:mb-5">
            <Link href="/marketplace" className="flex items-center gap-1 font-medium transition-colors hover:text-foreground">
              <Store className="h-3.5 w-3.5" />
              Marketplace
            </Link>
            <ChevronRight className="h-3 w-3 opacity-60" />
            <span className="rounded-md bg-muted px-2 py-0.5 font-semibold text-foreground">Categorías</span>
          </nav>
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md sm:h-12 sm:w-12">
              <LayoutGrid className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">Categorías</h1>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:mt-1.5 sm:text-sm">
                {totalProducts > 0
                  ? `${totalProducts.toLocaleString('es-PY')} productos de las tiendas del marketplace, ordenados por rubro.`
                  : 'Productos de las tiendas del marketplace, ordenados por rubro.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Rubros con productos reales (el mismo carrusel de la portada) ── */}
      <MarketplaceCategoriesShowcase stats={showcase} exploreAllHref="#todas" exploreAllLabel="Ver todas" title="Rubros destacados" />

      {/* ── Todas las categorías ── */}
      <section id="todas" className="mx-auto max-w-7xl scroll-mt-16 px-4 py-8 sm:px-6 lg:px-8">
        <CategoriesClient categories={categories} rubroStats={showcase} />
      </section>

      {/* ── Sección de Marcas Relacionadas ── */}
      {brands.length > 0 && (
        <section id="marcas" className="mx-auto max-w-7xl scroll-mt-16 px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mb-10 border-t border-border/80 pt-10" />
          <MarketplaceBrandsSection
            brands={brands}
            variant="grid"
            title="Explorar por Marca"
            subtitle="Encontrá productos de las principales marcas del catálogo"
            showViewAll={false}
          />
        </section>
      )}
    </div>
  )
}
