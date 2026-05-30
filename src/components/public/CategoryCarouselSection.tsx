import Link from 'next/link'
import { ArrowRight, Grid3X3, Package, Store } from 'lucide-react'
import { CategoryCarousel } from './CategoryCarousel'
import { getMarketplaceCategories } from '@/lib/public/marketplace'

type Props = {
  activeId?: string
  title?: string
  subtitle?: string
  showViewAll?: boolean
  compact?: boolean
  showCount?: boolean
}

export async function CategoryCarouselSection({
  activeId,
  title = 'Explorar categorias',
  subtitle,
  showViewAll = true,
  compact = false,
  showCount = true,
}: Props) {
  const categories = await getMarketplaceCategories()

  if (!categories.length) return null

  const topCategories = categories.slice(0, 3)
  const totalProducts = categories.reduce((sum, category) => sum + category.product_count, 0)
  const totalOrganizations = categories.reduce((sum, category) => sum + category.organization_count, 0)

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-6 border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/40 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300">
              <Grid3X3 className="h-3.5 w-3.5" />
              Categorias globales
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              {subtitle ?? `${categories.length} categorias disponibles para explorar productos publicados por empresas del marketplace.`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Package className="h-3.5 w-3.5" />
                Productos
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">{totalProducts}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Store className="h-3.5 w-3.5" />
                Empresas
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">{totalOrganizations}</div>
            </div>
          </div>
        </div>

        {topCategories.length > 0 && (
          <div className="grid gap-3 border-b border-slate-200 p-5 dark:border-slate-800 md:grid-cols-3">
            {topCategories.map((category, index) => (
              <Link
                key={category.id}
                href={`/marketplace/productos?categoria=${category.id}`}
                className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 transition hover:border-cyan-300 hover:bg-cyan-50/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-cyan-800 dark:hover:bg-cyan-950/10"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase text-slate-400">Top {index + 1}</div>
                  <div className="mt-1 truncate font-semibold text-slate-900 dark:text-slate-50">{category.name}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {category.product_count} producto{category.product_count !== 1 ? 's' : ''}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-cyan-700 dark:group-hover:text-cyan-300" />
              </Link>
            ))}
          </div>
        )}

        <div className="p-5">
          <CategoryCarousel
            categories={categories}
            activeId={activeId}
            title=""
            subtitle=""
            showCount={showCount}
            compact={compact}
          />
        </div>

        {showViewAll && (
          <div className="flex items-center justify-center border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <Link
              href="/marketplace/categorias"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-950/30"
            >
              Ver todas las categorias
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
