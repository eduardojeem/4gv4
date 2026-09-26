'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, ChevronRight, Dumbbell } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useStorefrontStyle } from './storefront-style-context'

type CatalogCategory = { id: string; name: string; parent_id?: string | null }

export function StorefrontCatalogHero({
  homeHref,
  productsHref,
  storeName,
  total,
  query,
  children,
}: {
  homeHref: string
  productsHref: string
  storeName: string
  total: number
  query: string
  children: ReactNode
}) {
  const style = useStorefrontStyle()
  const resultCopy = query
    ? `${total} ${total === 1 ? 'resultado' : 'resultados'} para “${query}”`
    : `${total} ${total === 1 ? 'producto disponible' : 'productos disponibles'}`

  if (style === 'classic') {
    return (
      <div className="border-b border-border/60 bg-gradient-to-b from-primary/[0.04] via-card to-background py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <CatalogBreadcrumb homeHref={homeHref} />
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-balance text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Catálogo de Productos
              </h1>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{resultCopy}</p>
            </div>
            {children}
          </div>
        </div>
      </div>
    )
  }

  if (style === 'fashion') {
    return (
      <section className="border-b border-stone-300/70 bg-[#f3efe8] text-stone-950 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-50">
        <div className="container mx-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <CatalogBreadcrumb homeHref={homeHref} />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm">
              <span className="text-stone-600 dark:text-stone-300">{resultCopy}</span>
              <Link
                href={`${productsHref}?ofertas=true`}
                className="inline-flex items-center gap-1 font-bold text-stone-950 underline-offset-4 hover:underline dark:text-white"
              >
                Ver ofertas <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="w-full sm:max-w-sm [&_input]:rounded-none [&_input]:border-stone-400 [&_input]:bg-transparent">
              {children}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="border-b border-slate-700 bg-slate-950 text-white">
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-9 lg:px-8 lg:py-12">
        <CatalogBreadcrumb homeHref={homeHref} inverted />
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-end">
          <div className="max-w-3xl">
            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-lime-300 sm:text-xs">
              <Dumbbell className="h-3.5 w-3.5" />
              {storeName}
            </p>
            <h1 className="text-balance text-4xl font-black uppercase italic leading-[0.95] tracking-tighter sm:text-6xl lg:text-7xl">
              Equipate para rendir
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm">
              <span className="text-slate-300">{resultCopy}</span>
              <Link
                href={`${productsHref}?ofertas=true`}
                className="inline-flex items-center gap-1 font-bold text-lime-300 underline-offset-4 hover:underline"
              >
                Ver ofertas <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <div className="w-full lg:justify-self-end [&_input]:rounded-sm [&_input]:border-slate-600 [&_input]:bg-white [&_input]:text-slate-950">
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}

export function StorefrontCollections({
  categories,
  productsHref,
}: {
  categories: CatalogCategory[]
  productsHref: string
}) {
  const style = useStorefrontStyle()
  if (style === 'classic') return null

  const visible = categories.filter((category) => !category.parent_id).slice(0, 8)
  if (visible.length === 0) return null
  const fashion = style === 'fashion'

  return (
    <section className={cn('border-b', fashion ? 'border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950' : 'border-slate-800 bg-slate-900 text-white')}>
      <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className={cn('text-xs font-bold uppercase tracking-[0.18em]', fashion ? 'text-stone-700 dark:text-stone-200' : 'italic text-lime-300')}>
            {fashion ? 'Explorar por colección' : 'Explorar disciplinas'}
          </h2>
          <Link href={productsHref} className="hidden items-center gap-1 text-xs font-semibold opacity-70 hover:opacity-100 sm:inline-flex">
            Ver todo <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <nav aria-label={fashion ? 'Colecciones de productos' : 'Disciplinas deportivas'} className="flex snap-x gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {visible.map((category) => (
            <Link
              key={category.id}
              href={`${productsHref}?category_id=${encodeURIComponent(category.id)}`}
              className={cn(
                'shrink-0 snap-start px-4 py-2 text-xs font-bold transition-colors',
                fashion
                  ? 'border border-stone-300 bg-[#f8f6f2] text-stone-900 hover:border-stone-950 hover:bg-stone-950 hover:text-white dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-white dark:hover:text-stone-950'
                  : 'skew-x-[-4deg] rounded-sm border border-slate-600 bg-slate-950 uppercase italic tracking-wide text-white hover:border-lime-300 hover:text-lime-300',
              )}
            >
              <span className={style === 'sport' ? 'inline-block skew-x-[4deg]' : undefined}>{category.name}</span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  )
}

export function StorefrontCatalogToolbar({ children }: { children: ReactNode }) {
  const style = useStorefrontStyle()
  return (
    <div className={cn(
      'sticky top-16 z-30 mb-5 space-y-2 p-2.5 backdrop-blur-xl transition-shadow sm:p-3',
      style === 'classic' && 'rounded-2xl border border-border/80 bg-background/95 shadow-md',
      style === 'fashion' && 'border-y border-stone-300 bg-background/95 shadow-sm dark:border-stone-700',
      style === 'sport' && 'rounded-sm border-2 border-slate-900 bg-background/95 shadow-[4px_4px_0_0_hsl(var(--primary))] dark:border-slate-100',
    )}>
      {children}
    </div>
  )
}

function CatalogBreadcrumb({ homeHref, inverted = false }: { homeHref: string; inverted?: boolean }) {
  return (
    <nav aria-label="Ruta de navegación" className={cn('flex items-center gap-1.5 text-xs', inverted ? 'text-slate-400' : 'text-muted-foreground')}>
      <Link href={homeHref} className="transition-colors hover:text-current">Inicio</Link>
      <ChevronRight className="h-3 w-3" />
      <span className={inverted ? 'text-white' : 'text-foreground'}>Productos</span>
    </nav>
  )
}
