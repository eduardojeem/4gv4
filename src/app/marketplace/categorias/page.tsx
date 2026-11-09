import type { Metadata } from 'next'
import { getMarketplaceCategories, getMarketplaceBrands } from '@/lib/public/marketplace'
import { MarketplaceBrandsSection } from '@/components/public/MarketplaceBrandsSection'
import { CategoriesClient } from '@/components/public/CategoriesClient'

export const metadata: Metadata = {
  title: 'Categorías | Marketplace MiPOS',
  description: 'Explora todos los productos del marketplace por categoría y rubro comercial.',
}

// Query the live catalog only at request time; CI builds do not have admin credentials.
// Catalog helpers retain their own shared data cache.
export const dynamic = 'force-dynamic'

export default async function MarketplaceCategoriesPage() {
  const [categories, brands] = await Promise.all([
    getMarketplaceCategories(),
    getMarketplaceBrands(48),
  ])

  return (
    <div className="min-h-screen">
      {/* ── Showcase de Categorías con Hero Dinámico, Carrusel y Rubros ── */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <CategoriesClient categories={categories} />
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
