'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Loader2, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { PRODUCTS_MAX_PRICE } from '@/lib/constants/products'
import { clearAllProductFilters } from '@/lib/utils/product-filters'
import { Accordion } from '@/components/ui/accordion'
import { CategoryFilter } from './filters/CategoryFilter'
import { BrandFilter } from './filters/BrandFilter'
import { StockFilter } from './filters/StockFilter'
import { PriceFilter } from './filters/PriceFilter'

interface Category {
  id: string
  name: string
  parent_id?: string | null
  subcategories?: Category[]
}

interface ProductFiltersProps {
  priceRange: { min: number; max: number }
  categories?: Category[]
  brands?: string[]
  branches?: Array<{ id: string; name: string; city: string | null }>
  onCollapseChange?: (collapsed: boolean) => void
  hideHeader?: boolean
}

export function ProductFilters({
  priceRange = { min: 0, max: PRODUCTS_MAX_PRICE },
  categories = [],
  brands = [],
  branches = [],
  onCollapseChange,
  hideHeader = false,
}: ProductFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const categoryId = searchParams.get('category_id') || ''
  const brand = searchParams.get('brand') || ''
  const branchId = searchParams.get('branch_id') || ''
  const inStock = searchParams.get('in_stock') === 'true'

  // El slider opera dentro del rango real del catálogo (priceRange), no del
  // tope teórico PRODUCTS_MAX_PRICE: si el estado local usara el tope teórico,
  // el filtro quedaría activo para siempre al primer toque del slider.
  const hasPriceFilter = searchParams.has('min_price') || searchParams.has('max_price')
  const clampToRange = (value: number) =>
    Math.min(Math.max(value, priceRange.min), priceRange.max)
  const minPrice = clampToRange(Number(searchParams.get('min_price')) || priceRange.min)
  const maxPrice = clampToRange(Number(searchParams.get('max_price')) || priceRange.max)

  // Mientras el usuario arrastra el slider se usa el borrador; al soltar
  // (commit) o cuando cambia la URL, vuelve a derivarse de los searchParams.
  const [draftPriceRange, setDraftPriceRange] = useState<number[] | null>(null)
  const localPriceRange = draftPriceRange ?? [minPrice, maxPrice]
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const updateFilters = (updates: Record<string, string | number | boolean | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', '1')
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === false) {
        params.delete(key)
      } else {
        params.set(key, String(value))
      }
    })
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  const clearFilters = () => {
    const params = clearAllProductFilters(new URLSearchParams(searchParams.toString()))
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
    setDraftPriceRange(null)
  }

  const toggleCollapse = () => setIsFiltersCollapsed((p) => !p)
  const toggleSidebar = () => {
    const next = !isSidebarCollapsed
    setIsSidebarCollapsed(next)
    onCollapseChange?.(next)
  }

  const activeFiltersCount = [
    categoryId !== '',
    brand !== '',
    branchId !== '',
    inStock,
    hasPriceFilter,
  ].filter(Boolean).length

  /* Collapsed sidebar — minimal strip */
  if (isSidebarCollapsed) {
    return (
      <div className="flex flex-col items-center py-4 space-y-4">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Expandir filtros">
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
        <div className="h-px w-8 bg-border/50" />
        {activeFiltersCount > 0 && (
          <div className="h-2 w-2 rounded-full bg-primary" title={`${activeFiltersCount} filtros activos`} />
        )}
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Header */}
      {!hideHeader && <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8 -ml-2 text-muted-foreground hover:text-foreground lg:flex hidden" title="Contraer panel lateral">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
          <button onClick={toggleCollapse} className="flex items-center gap-2 hover:opacity-80 transition-opacity group">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              Filtros
              {activeFiltersCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {activeFiltersCount}
                </span>
              )}
              {isPending && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </h3>
            <div className={`transition-transform duration-200 ${isFiltersCollapsed ? '-rotate-90' : 'rotate-0'}`}>
              <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            </div>
          </button>
        </div>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); clearFilters() }} className="h-7 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive ml-2">
            Limpiar
          </Button>
        )}
      </div>}

      {/* Collapsible content */}
      <div className={`space-y-6 transition-all duration-300 ease-in-out ${isFiltersCollapsed ? 'hidden opacity-0 h-0' : 'block opacity-100 h-auto'}`}>
        {/* Active filter chips */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-muted/30 border border-border/50">
            {categoryId && (
              <Badge variant="secondary" className="gap-1.5 text-xs font-normal rounded-full bg-background hover:bg-background shadow-sm">
                {(() => {
                  const main = categories.find((c) => c.id === categoryId)
                  if (main) return main.name
                  for (const cat of categories) {
                    const sub = cat.subcategories?.find((s) => s.id === categoryId)
                    if (sub) return sub.name
                  }
                  return 'Categoria'
                })()}
                <button type="button" className="inline-flex items-center justify-center rounded-full hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors" onClick={() => updateFilters({ category_id: null })} aria-label="Quitar filtro de categoria">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {brand && (
              <Badge variant="secondary" className="gap-1.5 text-xs font-normal rounded-full bg-background hover:bg-background shadow-sm">
                {brand}
                <button type="button" className="inline-flex items-center justify-center rounded-full hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors" onClick={() => updateFilters({ brand: null })} aria-label="Quitar filtro de marca">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {branchId && (
              <Badge variant="secondary" className="gap-1.5 text-xs font-normal rounded-full bg-background hover:bg-background shadow-sm">
                📍 {branches.find(b => b.id === branchId)?.name || 'Sucursal'}
                <button type="button" className="inline-flex items-center justify-center rounded-full hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors" onClick={() => updateFilters({ branch_id: null })} aria-label="Quitar filtro de sucursal">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {inStock && (
              <Badge variant="secondary" className="gap-1.5 text-xs font-normal rounded-full bg-background hover:bg-background shadow-sm">
                En stock
                <button type="button" className="inline-flex items-center justify-center rounded-full hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors" onClick={() => updateFilters({ in_stock: false })} aria-label="Quitar filtro de stock">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {hasPriceFilter && (
              <Badge variant="secondary" className="gap-1.5 text-xs font-normal rounded-full bg-background hover:bg-background shadow-sm">
                {formatPrice(minPrice)} - {formatPrice(maxPrice)}
                <button type="button" className="inline-flex items-center justify-center rounded-full hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors" onClick={() => updateFilters({ min_price: null, max_price: null })} aria-label="Quitar filtro de precio">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}

        <Accordion type="multiple" defaultValue={['category', 'brand', 'stock', 'price']} className="w-full rounded-xl border border-border/60 bg-card shadow-sm">
          <CategoryFilter categories={categories} selectedCategoryId={categoryId} onSelect={(id) => updateFilters({ category_id: id })} />
          <BrandFilter brands={brands} selectedBrand={brand} onSelect={(b) => updateFilters({ brand: b })} />
          <StockFilter inStock={inStock} onChange={(checked) => updateFilters({ in_stock: checked })} />
          <PriceFilter priceRange={priceRange} localRange={localPriceRange} onChange={setDraftPriceRange} onCommit={(values) => { setDraftPriceRange(null); updateFilters({ min_price: values[0] > priceRange.min ? values[0] : null, max_price: values[1] < priceRange.max ? values[1] : null }) }} />
        </Accordion>
      </div>
    </div>
  )
}
