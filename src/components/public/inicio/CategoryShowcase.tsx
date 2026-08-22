'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Smartphone, Headphones, Laptop, Battery, Cpu, Shield, Package, Camera, Watch, Tablet, Cable, HardDrive } from 'lucide-react'
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
  { keywords: ['cable', 'adaptador', 'hub', 'usb'],                                    icon: Cable,        gradient: 'from-indigo-500 to-blue-600',    text: 'text-indigo-600 dark:text-indigo-400' },
  { keywords: ['bateria', 'carga', 'cargador'],                                        icon: Battery,      gradient: 'from-emerald-500 to-teal-600',   text: 'text-emerald-600 dark:text-emerald-400' },
  { keywords: ['almacenamiento', 'memoria', 'pendrive', 'disco'],                       icon: HardDrive,    gradient: 'from-cyan-600 to-sky-700',       text: 'text-cyan-700 dark:text-cyan-300' },
  { keywords: ['repuesto', 'pantalla', 'display', 'vidrio', 'modulo'],                  icon: Cpu,          gradient: 'from-orange-500 to-amber-600',   text: 'text-orange-600 dark:text-orange-400' },
  { keywords: ['funda', 'case', 'protector', 'cover', 'estuche'],                       icon: Shield,       gradient: 'from-rose-500 to-pink-600',      text: 'text-rose-600 dark:text-rose-400' },
  { keywords: ['camara', 'foto', 'camera', 'lente'],                                    icon: Camera,       gradient: 'from-amber-500 to-yellow-500',   text: 'text-amber-600 dark:text-amber-400' },
  { keywords: ['smartwatch', 'reloj', 'watch', 'wearable'],                             icon: Watch,        gradient: 'from-cyan-500 to-sky-600',       text: 'text-cyan-600 dark:text-cyan-400' },
  { keywords: ['tablet', 'ipad'],                                                        icon: Tablet,       gradient: 'from-teal-500 to-emerald-600',   text: 'text-teal-600 dark:text-teal-400' },
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
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  )
  const pathname = usePathname()
  const tenantSlug = getTenantSlugFromPathname(pathname)
  const tenantPrefix = tenantSlug ? `/${tenantSlug}` : ''
  const { categories, isLoading } = usePublicCategories()

  if (!mounted || isLoading) {
    return (
      <section className="border-t bg-background py-10 md:py-14">
        <div className="container">
          <div className="mb-6 h-9 w-56 animate-pulse rounded-md bg-muted" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  // Solo categorías con productos publicados: una vitrina que lleva a "no hay
  // productos" es peor que no mostrar la categoría. Si el backend todavía no
  // envía productCount (respuesta cacheada vieja), no se filtra nada.
  const hasCounts = categories.some((c) => typeof c.productCount === 'number')
  const withProducts = hasCounts
    ? categories.filter((c) => (c.productCount ?? 0) > 0)
    : categories

  if (withProducts.length === 0) return null

  // Se priorizan las categorías con más productos en vez del orden alfabético,
  // que dejaba fuera del top 8 al catálogo principal.
  const items = [...withProducts]
    .sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 8)
  const hasMore = withProducts.length > items.length

  return (
    <section className="border-t bg-background py-10 md:py-14">
      <div className="container">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
          <div>
            {/* Se evita `text-primary` para textos sobre fondo neutro: el color
                de marca lo define cada tienda (esta usa #08080d) y en modo
                oscuro queda ilegible. `foreground` sigue siempre al tema. */}
            <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              Categorías
            </span>
            <h2 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">
              Encontrá lo que necesitás
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Accedé directamente a los productos de cada categoría.
            </p>
          </div>
          <Link
            href={`${tenantPrefix}/productos`}
            className="hidden shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-card-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground sm:inline-flex"
          >
            Ver todo el catálogo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
          {items.map((category) => {
            const preset = getCategoryPreset(category.name)
            const Icon = preset.icon
            const count = category.productCount ?? 0
            return (
              <Link
                key={category.id}
                href={`${tenantPrefix}/productos?category_id=${encodeURIComponent(category.id)}`}
                aria-label={`Ver productos de ${category.name}${count ? ` (${count})` : ''}`}
                className="group relative flex min-h-40 flex-col overflow-hidden rounded-lg border border-border/70 bg-card p-4 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:min-h-44 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={cn('flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-sm sm:h-12 sm:w-12', preset.gradient)}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  {count > 0 && (
                    <span className="rounded-full border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                      {count}
                    </span>
                  )}
                </div>

                <div className="mt-5 min-w-0">
                  <span className="line-clamp-2 text-sm font-bold leading-snug text-foreground sm:text-base">
                    {category.name}
                  </span>
                  {count > 0 && (
                    <span className="mt-1 block text-xs text-muted-foreground sm:hidden">
                      {count} {count === 1 ? 'producto' : 'productos'}
                    </span>
                  )}
                </div>

                <span className={cn('mt-auto flex items-center gap-1.5 pt-4 text-xs font-semibold', preset.text)}>
                  Explorar
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            )
          })}
        </div>

        {/* Ver todo — mobile, y en desktop solo si quedaron categorías fuera */}
        <div className={cn('mt-6 text-center', !hasMore && 'sm:hidden')}>
          <Link
            href={`${tenantPrefix}/productos`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-semibold text-card-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {hasMore
              ? `Ver las ${withProducts.length} categorías`
              : 'Ver todo el catálogo'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
