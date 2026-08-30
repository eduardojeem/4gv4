import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ChevronRight, Grid3X3, Package, Sparkles, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMarketplaceCategories, getMarketplaceBrands } from '@/lib/public/marketplace'
import { MarketplaceBrandsSection } from '@/components/public/MarketplaceBrandsSection'
import { CategoriesClient } from '@/components/public/CategoriesClient'

export const metadata: Metadata = {
  title: 'Categorías | Marketplace MiPOS',
  description: 'Explora todos los productos del marketplace por categoría comercial.',
}

// Configurar ISR (Incremental Static Regeneration) con revalidación de 10 minutos (600 segundos)
export const revalidate = 600

export default async function MarketplaceCategoriesPage() {
  const [categories, brands] = await Promise.all([
    getMarketplaceCategories(),
    getMarketplaceBrands(48),
  ])

  const totalProducts = categories.reduce((sum, c) => sum + c.product_count, 0)
  const totalOrganizations = new Set(categories.map((c) => c.organization_count)).size

  return (
    <div className="min-h-screen">
      {/* ── Hero Header Limpio y Moderno ── */}
      <section className="relative overflow-hidden border-b border-border/80 bg-gradient-to-b from-primary/[0.04] via-card to-background py-10 sm:py-14">
        {/* Glow sutil */}
        <div className="pointer-events-none absolute -left-12 -top-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute right-4 top-0 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href="/marketplace"
              className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
            >
              <Store className="h-3.5 w-3.5" />
              Marketplace
            </Link>
            <ChevronRight className="h-3 w-3 opacity-60" />
            <span className="font-semibold text-foreground bg-muted px-2 py-0.5 rounded-md">
              Categorías
            </span>
          </nav>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                <Grid3X3 className="h-6 w-6" />
              </div>

              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                  Categorías de productos
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  Explorá los rubros de todas las tiendas y encontrá rápidamente lo que necesitás.
                </p>

                {/* Badges de estadísticas */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {categories.length} categorías activas
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-xs">
                    <Package className="h-3 w-3 text-primary" />
                    {totalProducts} productos catalogados
                  </span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-fit shrink-0 gap-2 rounded-xl border-border/80 bg-card shadow-xs hover:bg-muted"
            >
              <Link href="/marketplace/productos">
                Ver todos los productos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Contenido Principal de Categorías con Búsqueda ── */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <CategoriesClient categories={categories} />
      </section>

      {/* ── Sección de Marcas Relacionadas ── */}
      {brands.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
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
