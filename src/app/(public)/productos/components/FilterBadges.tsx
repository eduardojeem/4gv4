'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { PRODUCTS_MAX_PRICE } from '@/lib/constants/products'
import { readActiveProductFilters, clearAllProductFilters } from '@/lib/utils/product-filters'

export function FilterBadges({ categories }: { categories: any[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const { query, categoryId, brand, inStock, minPrice, maxPrice } = readActiveProductFilters(
    new URLSearchParams(searchParams.toString())
  )

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
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  const hasActiveFilters =
    !!query || !!categoryId || !!brand || inStock || minPrice > 0 || maxPrice < PRODUCTS_MAX_PRICE

  if (!hasActiveFilters) return null

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
      {query && (
        <Badge variant="secondary" className="gap-1 text-xs font-normal rounded-full">
          Busqueda: {query}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => removeFilter('query')}
            aria-label="Quitar filtro de busqueda"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {categoryId && (
        <Badge variant="secondary" className="gap-1 text-xs font-normal rounded-full">
          {categories.find((c) => c.id === categoryId)?.name}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => removeFilter('category_id')}
            aria-label="Quitar filtro de categoria"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {brand && (
        <Badge variant="secondary" className="gap-1 text-xs font-normal rounded-full">
          {brand}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => removeFilter('brand')}
            aria-label="Quitar filtro de marca"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {inStock && (
        <Badge variant="secondary" className="gap-1 text-xs font-normal rounded-full">
          En stock
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => removeFilter('in_stock')}
            aria-label="Quitar filtro de stock"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {(minPrice > 0 || maxPrice < PRODUCTS_MAX_PRICE) && (
        <Badge variant="secondary" className="gap-1 text-xs font-normal rounded-full">
          {formatPrice(minPrice)} - {formatPrice(maxPrice)}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString())
              params.delete('min_price')
              params.delete('max_price')
              params.set('page', '1')
              startTransition(() => {
                router.push(`?${params.toString()}`, { scroll: false })
              })
            }}
            aria-label="Quitar filtro de precio"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      <button
        onClick={clearAll}
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
      >
        Limpiar
      </button>
    </div>
  )
}
