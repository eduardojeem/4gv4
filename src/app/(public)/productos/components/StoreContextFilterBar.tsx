'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Flame, FolderTree, Package, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Category } from '@/types/public'

interface StoreContextFilterBarProps {
  categories: Category[]
  brands: string[]
}

export function StoreContextFilterBar({
  categories,
  brands,
}: StoreContextFilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const scrollRef = useMemoRef()
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const currentCategoryId = searchParams.get('category_id') || ''
  const currentBrand = searchParams.get('brand') || ''
  const isOnlyOffers = searchParams.get('offers') === 'true'
  const isOnlyInStock = searchParams.get('in_stock') === 'true'

  const activeCategory = categories.find((c) => c.id === currentCategoryId)
  const subcategories = activeCategory?.subcategories ?? []

  function useMemoRef() {
    return useRef<HTMLDivElement>(null)
  }

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 4)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [brands, subcategories])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = direction === 'left' ? -220 : 220
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }

  const updateParam = (key: string, value: string | boolean | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === '' || value === false) {
      params.delete(key)
    } else {
      params.set(key, String(value))
    }
    params.set('page', '1')

    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  const hasBrandsOrSubs = brands.length > 0 || subcategories.length > 0

  if (!hasBrandsOrSubs && !isOnlyOffers && !isOnlyInStock) return null

  return (
    <div className="w-full max-w-full space-y-1.5">
      
      {/* ── 1. Subcategorías (si la categoría seleccionada tiene hijas) ── */}
      {subcategories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide text-xs max-w-full">
          <span className="shrink-0 flex items-center gap-1 font-bold text-muted-foreground mr-1">
            <FolderTree className="h-3.5 w-3.5 text-primary" />
            <span>Ramas:</span>
          </span>

          <button
            type="button"
            onClick={() => updateParam('category_id', activeCategory?.id || '')}
            className={cn(
              'shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs',
              currentCategoryId === activeCategory?.id
                ? 'bg-primary text-primary-foreground'
                : 'border border-border/80 bg-card text-muted-foreground hover:text-foreground'
            )}
          >
            Todas
          </button>

          {subcategories.map((sub) => {
            const isSubActive = currentCategoryId === sub.id
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => updateParam('category_id', isSubActive ? activeCategory?.id || '' : sub.id)}
                className={cn(
                  'shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs',
                  isSubActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/80 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {sub.name}
              </button>
            )
          })}
        </div>
      )}

      {/* ── 2. Franja Deslizable de Marcas & Filtros con Flechas de Navegación ── */}
      <div className="relative group w-full max-w-full">
        
        {/* Flecha Scroll Izquierda */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className="absolute -left-1 top-1/2 -translate-y-1/2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border/80 bg-background/95 shadow-md hover:bg-muted text-foreground transition-all"
            aria-label="Desplazar marcas a la izquierda"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Contenedor Deslizable de Marcas */}
        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide text-xs max-w-full scroll-smooth select-none px-0.5"
        >
          {/* Toggle Ofertas */}
          <button
            type="button"
            onClick={() => updateParam('offers', !isOnlyOffers)}
            className={cn(
              'shrink-0 flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all shadow-2xs',
              isOnlyOffers
                ? 'border-rose-400 bg-rose-600 text-white'
                : 'border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'
            )}
          >
            <Flame className="h-3 w-3" />
            <span>Ofertas</span>
          </button>

          {/* Toggle Stock */}
          <button
            type="button"
            onClick={() => updateParam('in_stock', !isOnlyInStock)}
            className={cn(
              'shrink-0 flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs',
              isOnlyInStock
                ? 'border-emerald-400 bg-emerald-600 text-white'
                : 'border-border/80 bg-card text-muted-foreground hover:border-emerald-300 hover:text-foreground'
            )}
          >
            <Package className="h-3 w-3" />
            <span>En Stock</span>
          </button>

          <div className="h-4 w-px bg-border/80 shrink-0 mx-0.5" />

          {/* Todas las marcas */}
          {brands.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => updateParam('brand', '')}
                className={cn(
                  'shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs',
                  !currentBrand
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border/80 bg-card text-muted-foreground hover:text-foreground'
                )}
              >
                Todas las marcas
              </button>

              {/* Lista Completa de Marcas con Desplazamiento Lateral */}
              {brands.map((b) => {
                const isBrandActive = currentBrand.toLowerCase() === b.toLowerCase()
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => updateParam('brand', isBrandActive ? '' : b)}
                    className={cn(
                      'shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all shadow-2xs whitespace-nowrap',
                      isBrandActive
                        ? 'border-violet-500 bg-violet-600 text-white ring-1 ring-violet-400/40'
                        : 'border-border/80 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    {b}
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* Flecha Scroll Derecha */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className="absolute -right-1 top-1/2 -translate-y-1/2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border/80 bg-background/95 shadow-md hover:bg-muted text-foreground transition-all"
            aria-label="Desplazar marcas a la derecha"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}

      </div>
    </div>
  )
}
