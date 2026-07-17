'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { getCategoryIcon } from './CategoryCarousel'
import type { MarketplaceCategory } from '@/lib/public/marketplace'

type Props = {
  categories: MarketplaceCategory[]
  activeId?: string
  showViewAll?: boolean
  showCount?: boolean
  className?: string
}

// ─── Compact pill-based filter bar ───────────────────────────────────────────
export function CompactCategoryBar({
  categories,
  activeId,
  showViewAll = true,
  showCount = true,
  className,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const [{ canLeft, canRight }, dispatch] = useReducer(
    (_: { canLeft: boolean; canRight: boolean }, el: HTMLDivElement) => ({
      canLeft: el.scrollLeft > 8,
      canRight: el.scrollLeft < el.scrollWidth - el.clientWidth - 8,
    }),
    { canLeft: false, canRight: true }
  )

  const updateArrows = useCallback(() => {
    if (scrollRef.current) dispatch(scrollRef.current)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows, { passive: true })
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      ro.disconnect()
    }
  }, [updateArrows, categories.length])

  function scrollBy(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 280 : -280, behavior: 'smooth' })
  }

  return (
    <div className={['mx-auto max-w-7xl px-4 sm:px-6 lg:px-8', className].filter(Boolean).join(' ')}>
      <div className="relative flex items-center gap-2">

        {/* ← arrow button */}
        <button
          onClick={() => scrollBy('left')}
          disabled={!canLeft}
          aria-label="Categorías anteriores"
          className="hidden shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 sm:flex"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {/* Scroll track */}
        <div className="relative min-w-0 flex-1">
          {/* Left edge fade */}
          <div
            className="pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-white to-transparent transition-opacity dark:from-slate-950"
            style={{ opacity: canLeft ? 1 : 0 }}
          />
          {/* Right edge fade */}
          <div
            className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-white to-transparent transition-opacity dark:from-slate-950"
            style={{ opacity: canRight ? 1 : 0 }}
          />

          <div
            ref={scrollRef}
            role="list"
            aria-label="Filtrar por categoría"
            className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {/* "Todas" pill */}
            <div role="listitem" style={{ scrollSnapAlign: 'start' }}>
              <Link
                href="/marketplace/productos"
                className={[
                  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1',
                  !activeId
                    ? 'border-cyan-500 bg-cyan-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800',
                ].join(' ')}
              >
                Todas
              </Link>
            </div>

            {/* Category pills */}
            {categories.map((cat) => {
              const isActive = activeId === cat.id
              const Icon = getCategoryIcon(cat.name)
              return (
                <div key={cat.id} role="listitem" style={{ scrollSnapAlign: 'start' }}>
                  <Link
                    href={`/marketplace/productos?categoria=${cat.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={[
                      'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1',
                      isActive
                        ? 'border-cyan-500 bg-cyan-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800',
                    ].join(' ')}
                  >
                    {/* Ícono pequeño */}
                    <Icon
                      className={[
                        'h-3 w-3 shrink-0',
                        isActive ? 'opacity-90' : 'opacity-60',
                      ].join(' ')}
                    />

                    {/* Nombre */}
                    <span className="max-w-[110px] truncate">{cat.name}</span>

                    {/* Conteo */}
                    {showCount && cat.product_count > 0 && (
                      <span
                        className={[
                          'rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums leading-none',
                          isActive
                            ? 'bg-white/25 text-white'
                            : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
                        ].join(' ')}
                      >
                        {cat.product_count}
                      </span>
                    )}
                  </Link>
                </div>
              )
            })}

            {/* "Ver todas" pill — solo si showViewAll */}
            {showViewAll && (
              <div role="listitem" style={{ scrollSnapAlign: 'start' }}>
                <Link
                  href="/marketplace/categorias"
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-slate-300 bg-transparent px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-600 dark:text-slate-500 dark:hover:border-cyan-600 dark:hover:text-cyan-400"
                >
                  Ver todas
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* → arrow button */}
        <button
          onClick={() => scrollBy('right')}
          disabled={!canRight}
          aria-label="Más categorías"
          className="hidden shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 sm:flex"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
