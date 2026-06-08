'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, ArrowRight } from 'lucide-react'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'

const TILE_TONES = [
  'from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400',
  'from-violet-500/10 to-purple-500/10 text-violet-600 dark:text-violet-400',
  'from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400',
  'from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400',
  'from-rose-500/10 to-pink-500/10 text-rose-600 dark:text-rose-400',
  'from-cyan-500/10 to-sky-500/10 text-cyan-600 dark:text-cyan-400',
]

/**
 * "Shop by category" grid for the public home. Lets visitors jump straight into
 * the catalog filtered by a category. Hidden when the store has no categories.
 */
export function CategoryShowcase() {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const { categories, isLoading } = usePublicCategories()

  if (isLoading || categories.length === 0) return null

  const items = categories.slice(0, 8)

  return (
    <section className="bg-muted/30 py-16 md:py-20">
      <div className="container">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
              <LayoutGrid className="h-3.5 w-3.5" />
              Categorías
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Comprá por categoría
            </h2>
          </div>
          <Link
            href={`${tenantPrefix}/productos`}
            className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:underline sm:inline-flex"
          >
            Ver todo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((category, index) => (
            <Link
              key={category.id}
              href={`${tenantPrefix}/productos?category_id=${encodeURIComponent(category.id)}`}
              className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${TILE_TONES[index % TILE_TONES.length]}`}>
                <LayoutGrid className="h-5 w-5" />
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground group-hover:text-primary">
                {category.name}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
