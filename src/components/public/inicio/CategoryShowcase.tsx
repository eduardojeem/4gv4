'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Smartphone, Headphones, Laptop, Battery, Cpu, Shield, Package, Camera, Watch, Tablet, Cable } from 'lucide-react'
import { usePublicCategories } from '@/hooks/usePublicCategories'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

// ── Category icon + color mapping by keyword ───────────────────────────────
const CATEGORY_PRESETS: Array<{
  keywords: string[]
  icon: LucideIcon
  gradient: string
  text: string
}> = [
  { keywords: ['celular', 'telefono', 'phone', 'movil', 'iphone', 'samsung', 'android'], icon: Smartphone,   gradient: 'from-blue-500 to-indigo-600',    text: 'text-blue-600 dark:text-blue-400' },
  { keywords: ['accesorio', 'auricular', 'audifono', 'headphone', 'casco'],              icon: Headphones,   gradient: 'from-violet-500 to-purple-600',  text: 'text-violet-600 dark:text-violet-400' },
  { keywords: ['laptop', 'notebook', 'computadora', 'pc', 'computacion'],               icon: Laptop,       gradient: 'from-slate-500 to-gray-700',     text: 'text-slate-600 dark:text-slate-400' },
  { keywords: ['bateria', 'carga', 'cargador', 'cable', 'usb'],                         icon: Battery,      gradient: 'from-emerald-500 to-teal-600',   text: 'text-emerald-600 dark:text-emerald-400' },
  { keywords: ['repuesto', 'pantalla', 'display', 'vidrio', 'modulo'],                  icon: Cpu,          gradient: 'from-orange-500 to-amber-600',   text: 'text-orange-600 dark:text-orange-400' },
  { keywords: ['funda', 'case', 'protector', 'cover', 'estuche'],                       icon: Shield,       gradient: 'from-rose-500 to-pink-600',      text: 'text-rose-600 dark:text-rose-400' },
  { keywords: ['camara', 'foto', 'camera', 'lente'],                                    icon: Camera,       gradient: 'from-amber-500 to-yellow-500',   text: 'text-amber-600 dark:text-amber-400' },
  { keywords: ['smartwatch', 'reloj', 'watch', 'wearable'],                             icon: Watch,        gradient: 'from-cyan-500 to-sky-600',       text: 'text-cyan-600 dark:text-cyan-400' },
  { keywords: ['tablet', 'ipad'],                                                        icon: Tablet,       gradient: 'from-teal-500 to-emerald-600',   text: 'text-teal-600 dark:text-teal-400' },
  { keywords: ['cable', 'adaptador', 'hub'],                                             icon: Cable,        gradient: 'from-indigo-500 to-blue-600',    text: 'text-indigo-600 dark:text-indigo-400' },
]

const FALLBACK_PRESET = { icon: Package, gradient: 'from-gray-400 to-slate-500', text: 'text-gray-600 dark:text-gray-400' }

function getCategoryPreset(name: string) {
  const lower = name.toLowerCase()
  return CATEGORY_PRESETS.find(p => p.keywords.some(k => lower.includes(k))) ?? FALLBACK_PRESET
}

/**
 * "Shop by category" grid for the public home. Lets visitors jump straight into
 * the catalog filtered by a category. Hidden when the store has no categories.
 */
export function CategoryShowcase() {
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const { categories, isLoading } = usePublicCategories()

  if (isLoading) {
    return (
      <section className="bg-muted/30 py-16 md:py-20">
        <div className="container">
          <div className="mb-8 h-10 w-56 animate-pulse rounded-xl bg-muted" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (categories.length === 0) return null

  const items = categories.slice(0, 8)

  return (
    <section className="bg-muted/30 py-16 md:py-20">
      <div className="container">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
              <Package className="h-3.5 w-3.5" />
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

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((category, index) => {
            const preset = getCategoryPreset(category.name)
            const Icon = preset.icon
            return (
              <Link
                key={category.id}
                href={`${tenantPrefix}/productos?category_id=${encodeURIComponent(category.id)}`}
                className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-lg"
              >
                {/* Gradient bg on hover */}
                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-5', preset.gradient)} />

                {/* Icon */}
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md', preset.gradient)}>
                  <Icon className="h-6 w-6" />
                </div>

                {/* Name */}
                <div>
                  <span className="line-clamp-2 text-sm font-bold text-foreground transition-colors group-hover:text-primary leading-tight">
                    {category.name}
                  </span>
                </div>

                {/* Arrow */}
                <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            )
          })}
        </div>

        {/* Mobile see all */}
        <div className="mt-5 text-center sm:hidden">
          <Link
            href={`${tenantPrefix}/productos`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            Ver todas las categorías <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
