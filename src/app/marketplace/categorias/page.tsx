import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Grid3X3, Store } from 'lucide-react'
import { getMarketplaceCategories, getMarketplaceBrands } from '@/lib/public/marketplace'
import { MarketplaceBrandsSection } from '@/components/public/MarketplaceBrandsSection'
import { CategoriesClient } from '@/components/public/CategoriesClient'

export const metadata: Metadata = {
  title: 'Categorías | Marketplace MiPOS',
  description: 'Explora todos los productos del marketplace por categoría.',
}

// Configurar ISR (Incremental Static Regeneration) con revalidación de 10 minutos (600 segundos)
export const revalidate = 600

export default async function MarketplaceCategoriesPage() {
  const [categories, brands] = await Promise.all([
    getMarketplaceCategories(),
    getMarketplaceBrands(48),
  ])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      
      {/* ── Header Hero Premium con Mesh Gradients ── */}
      <section className="relative overflow-hidden border-b border-slate-200/60 bg-white/70 backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/60 py-14 sm:py-16">
        
        {/* Orbes Decorativos Difuminados (Mesh Gradients) */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl dark:bg-cyan-500/5 animate-pulse duration-[6000ms]" />
        <div className="pointer-events-none absolute right-10 top-0 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-500/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(6,182,212,0.05),transparent)]" />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          {/* Breadcrumbs con diseño mejorado */}
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/marketplace" className="flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-medium">
              <Store className="h-3.5 w-3.5" />
              Marketplace
            </Link>
            <ChevronRight className="h-3 w-3 opacity-60" />
            <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
              Directorio de Categorías
            </span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-5">
              
              {/* Contenedor del ícono principal con brillo */}
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xl shadow-cyan-500/25 dark:shadow-cyan-900/30">
                <Grid3X3 className="h-7 w-7" />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
              </div>
              
              <div>
                {/* Título con degradado de texto moderno */}
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-700 bg-clip-text text-transparent dark:from-white dark:via-slate-200 dark:to-cyan-400">
                  Explorar Categorías
                </h1>
                <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Directorio comercial categorizado para búsquedas rápidas y efectivas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Grid Directory con Búsqueda e Interacciones ── */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <CategoriesClient categories={categories} />
      </section>

      {/* ── Sección de Marcas con Margen Refinado ── */}
      {brands.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mb-12 border-t border-slate-200/60 dark:border-slate-800/60 pt-12" />
          <MarketplaceBrandsSection
            brands={brands}
            variant="grid"
            title="Explorar por Marca"
            subtitle="Buscá productos de tus marcas favoritas"
            showViewAll={false}
          />
        </section>
      )}
    </div>
  )
}
