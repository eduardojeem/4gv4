'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Flame, Package, X } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { PRODUCTS_MAX_PRICE } from '@/lib/constants/products'
import { readActiveProductFilters, clearAllProductFilters } from '@/lib/utils/product-filters'
import type { Category } from '@/types/public'

interface Branch {
  id: string
  name: string
  city: string | null
}

export function FilterBadges({
  categories,
  branches = [],
}: {
  categories: Category[]
  branches?: Branch[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const { query, categoryId, brand, branchId, inStock, minPrice, maxPrice } = readActiveProductFilters(
    new URLSearchParams(searchParams.toString())
  )
  const isOnlyOffers = searchParams.get('offers') === 'true'

  const removeFilter = (key: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(key)
    params.set('page', '1')
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  const clearAll = () => {
    const params = clearAllProductFilters(new URLSearchParams(searchParams.toString()))
    params.delete('offers')
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  const hasActiveFilters =
    !!query ||
    !!categoryId ||
    !!brand ||
    !!branchId ||
    inStock ||
    isOnlyOffers ||
    minPrice > 0 ||
    maxPrice < PRODUCTS_MAX_PRICE

  if (!hasActiveFilters) return null

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
      <span className="text-[11px] font-semibold text-muted-foreground">Filtros activos:</span>

      {/* Búsqueda */}
      {query && (
        <button
          type="button"
          onClick={() => removeFilter('query')}
          className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-muted/80"
        >
          <span>Texto: &ldquo;{query}&rdquo;</span>
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Categoría */}
      {categoryId && (
        <button
          type="button"
          onClick={() => removeFilter('category_id')}
          className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
        >
          <span>
            Categoría:{' '}
            {(() => {
              for (const c of categories) {
                if (c.id === categoryId) return c.name
                const sub = c.subcategories?.find((s) => s.id === categoryId)
                if (sub) return sub.name
              }
              return 'Seleccionada'
            })()}
          </span>
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Marca */}
      {brand && (
        <button
          type="button"
          onClick={() => removeFilter('brand')}
          className="flex items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300"
        >
          <span>Marca: {brand}</span>
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Sucursal activa */}
      {branchId && (
        <button
          type="button"
          onClick={() => removeFilter('branch_id')}
          className="flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-800/40 dark:bg-sky-950/40 dark:text-sky-300"
        >
          <span>📍 {branches.find((b) => b.id === branchId)?.name ?? 'Sucursal'}</span>
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Solo Ofertas */}
      {isOnlyOffers && (
        <button
          type="button"
          onClick={() => removeFilter('offers')}
          className="flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300"
        >
          <Flame className="h-3 w-3" />
          <span>Solo ofertas</span>
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Stock */}
      {inStock && (
        <button
          type="button"
          onClick={() => removeFilter('in_stock')}
          className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <Package className="h-3 w-3" />
          <span>En stock</span>
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Rango de precio */}
      {(minPrice > 0 || maxPrice < PRODUCTS_MAX_PRICE) && (
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString())
            params.delete('min_price')
            params.delete('max_price')
            params.set('page', '1')
            startTransition(() => {
              router.push(`?${params.toString()}`, { scroll: false })
            })
          }}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-muted"
        >
          <span>{formatPrice(minPrice)} - {formatPrice(maxPrice)}</span>
          <X className="h-3 w-3" />
        </button>
      )}

      <button
        onClick={clearAll}
        type="button"
        className="text-xs font-semibold text-primary hover:underline ml-1"
      >
        Limpiar todos
      </button>
    </div>
  )
}
