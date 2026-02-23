'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { X, Loader2, Package, Tag, DollarSign, Layers, ChevronDown, ChevronRight } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

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
}

export function ProductFilters({
  priceRange = { min: 0, max: 50000000 },
  categories = [],
  brands = [],
}: ProductFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Get current filter values from URL
  const categoryId = searchParams.get('category_id') || ''
  const brand = searchParams.get('brand') || ''
  const minPrice = Number(searchParams.get('min_price')) || 0
  const maxPrice = Number(searchParams.get('max_price')) || 50000000
  const inStock = searchParams.get('in_stock') === 'true'

  // Local state for slider dragging
  const [localPriceRange, setLocalPriceRange] = useState([minPrice, maxPrice])
  
  // State for expanded categories (subcategories visibility)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    // Auto-expand category if a subcategory is selected
    const selectedCategory = categories.find(cat => 
      cat.subcategories?.some(sub => sub.id === categoryId)
    )
    return selectedCategory ? new Set([selectedCategory.id]) : new Set()
  })

  useEffect(() => {
    setLocalPriceRange([
      Number(searchParams.get('min_price')) || 0,
      Number(searchParams.get('max_price')) || 50000000
    ])
    
    // Auto-expand category if a subcategory is selected
    const selectedCategory = categories.find(cat => 
      cat.subcategories?.some(sub => sub.id === categoryId)
    )
    if (selectedCategory && categoryId) {
      setExpandedCategories(prev => new Set(prev).add(selectedCategory.id))
    }
  }, [searchParams, categoryId, categories])

  // Helper to update URL params
  const updateFilters = (updates: Record<string, string | number | boolean | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    // Reset page on filter change
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

  const handlePriceChange = (values: number[]) => {
    setLocalPriceRange(values)
  }

  const handlePriceCommit = (values: number[]) => {
    updateFilters({
      min_price: values[0] > 0 ? values[0] : null,
      max_price: values[1] < 50000000 ? values[1] : null, // Assuming 50M is effectively infinite/max
    })
  }

  const clearFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('category_id')
    params.delete('brand')
    params.delete('min_price')
    params.delete('max_price')
    params.delete('in_stock')
    params.set('page', '1')
    
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
    setLocalPriceRange([0, 50000000])
  }
  
  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  const activeFiltersCount = [
    categoryId !== '',
    brand !== '',
    inStock,
    minPrice > 0 || maxPrice < 50000000,
  ].filter(Boolean).length

  return (
    <div className={`space-y-6 ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          Filtros
          {activeFiltersCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {activeFiltersCount}
            </span>
          )}
          {isPending && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
        </h3>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            Limpiar
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-1.5 p-3 rounded-lg bg-muted/30 border border-border/50">
          {categoryId && (
            <Badge
              variant="secondary"
              className="gap-1.5 text-xs font-normal rounded-full bg-background hover:bg-background shadow-sm"
            >
              {(() => {
                // Buscar en categorías principales
                const mainCategory = categories.find((c) => c.id === categoryId)
                if (mainCategory) return mainCategory.name
                
                // Buscar en subcategorías
                for (const category of categories) {
                  const subcategory = category.subcategories?.find((s) => s.id === categoryId)
                  if (subcategory) return subcategory.name
                }
                
                return 'Categoria'
              })()}
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                onClick={() => updateFilters({ category_id: null })}
                aria-label="Quitar filtro de categoria"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {brand && (
            <Badge
              variant="secondary"
              className="gap-1.5 text-xs font-normal rounded-full bg-background hover:bg-background shadow-sm"
            >
              {brand}
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                onClick={() => updateFilters({ brand: null })}
                aria-label="Quitar filtro de marca"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {inStock && (
            <Badge
              variant="secondary"
              className="gap-1.5 text-xs font-normal rounded-full bg-background hover:bg-background shadow-sm"
            >
              En stock
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                onClick={() => updateFilters({ in_stock: false })}
                aria-label="Quitar filtro de stock"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {(minPrice > 0 || maxPrice < 50000000) && (
            <Badge
              variant="secondary"
              className="gap-1.5 text-xs font-normal rounded-full bg-background hover:bg-background shadow-sm"
            >
              {formatPrice(minPrice)} - {formatPrice(maxPrice)}
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                onClick={() => updateFilters({ min_price: null, max_price: null })}
                aria-label="Quitar filtro de precio"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      <Accordion
        type="multiple"
        defaultValue={['category', 'brand', 'stock', 'price']}
        className="w-full rounded-xl border border-border/60 bg-card shadow-sm"
      >
        {/* Categorias */}
        {categories.length > 0 && (
          <AccordionItem value="category" className="border-b border-border/50 px-3">
            <AccordionTrigger className="hover:no-underline py-4 text-sm font-medium">
              <span className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                Categorias
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-1">
                {categories.map((category) => {
                  const hasSubcategories = category.subcategories && category.subcategories.length > 0
                  const isMainCategorySelected = categoryId === category.id
                  const hasSelectedSubcategory = hasSubcategories && category.subcategories.some(sub => sub.id === categoryId)
                  const isExpanded = expandedCategories.has(category.id)
                  
                  return (
                    <div key={category.id} className="space-y-1">
                      {/* Categoría principal */}
                      <div className="flex items-center gap-1">
                        {/* Botón de expandir/contraer */}
                        {hasSubcategories && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleCategoryExpansion(category.id)
                            }}
                            className="p-1 hover:bg-muted rounded transition-colors"
                            aria-label={isExpanded ? 'Contraer subcategorías' : 'Expandir subcategorías'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        )}
                        
                        {/* Categoría principal */}
                        <button
                          className={`flex-1 flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all text-left group ${
                            isMainCategorySelected
                              ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                              : hasSelectedSubcategory
                              ? 'bg-primary/5 text-foreground font-medium'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          } ${!hasSubcategories ? 'ml-6' : ''}`}
                          onClick={() => updateFilters({ category_id: category.id === categoryId ? null : category.id })}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
                              isMainCategorySelected 
                                ? 'bg-primary-foreground' 
                                : hasSelectedSubcategory
                                ? 'bg-primary'
                                : 'bg-muted-foreground/40 group-hover:bg-muted-foreground'
                            }`} />
                            {category.name}
                          </span>
                          {hasSubcategories && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full transition-colors ${
                              isMainCategorySelected
                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                : hasSelectedSubcategory
                                ? 'bg-primary/20 text-primary'
                                : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/20'
                            }`}>
                              {category.subcategories.length}
                            </span>
                          )}
                        </button>
                      </div>
                      
                      {/* Subcategorías (colapsables) */}
                      {hasSubcategories && isExpanded && (
                        <div className="ml-9 pl-3 space-y-0.5 border-l-2 border-border/40 animate-in slide-in-from-top-2 duration-200">
                          {category.subcategories.map((subcategory) => {
                            const isSelected = categoryId === subcategory.id
                            return (
                              <button
                                key={subcategory.id}
                                className={`w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-all text-left group ${
                                  isSelected
                                    ? 'bg-primary/10 text-primary font-medium border border-primary/20'
                                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground hover:translate-x-0.5'
                                }`}
                                onClick={() => updateFilters({ category_id: subcategory.id === categoryId ? null : subcategory.id })}
                              >
                                <span className={`w-1 h-1 rounded-full transition-all ${
                                  isSelected 
                                    ? 'bg-primary scale-125' 
                                    : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/60'
                                }`} />
                                {subcategory.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Marcas */}
        {brands.length > 0 && (
          <AccordionItem value="brand" className="border-b border-border/50 px-3">
            <AccordionTrigger className="hover:no-underline py-4 text-sm font-medium">
              <span className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Marcas
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                {brands.map((brandName) => {
                  const isSelected = brand === brandName
                  return (
                    <button
                      key={brandName}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all text-left group ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                      onClick={() => updateFilters({ brand: brand === brandName ? null : brandName })}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        isSelected 
                          ? 'bg-primary-foreground' 
                          : 'bg-muted-foreground/40 group-hover:bg-muted-foreground'
                      }`} />
                      {brandName}
                    </button>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Disponibilidad */}
        <AccordionItem value="stock" className="border-b border-border/50 px-3">
          <AccordionTrigger className="hover:no-underline py-4 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Disponibilidad
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex items-center justify-between rounded-lg p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
              <Label
                htmlFor="in-stock"
                className="cursor-pointer text-sm font-medium flex items-center gap-2"
              >
                <span className={`w-2 h-2 rounded-full ${inStock ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                Solo productos en stock
              </Label>
              <Switch
                id="in-stock"
                checked={inStock}
                onCheckedChange={(checked) => updateFilters({ in_stock: checked })}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Precio */}
        <AccordionItem value="price" className="border-0 px-3">
          <AccordionTrigger className="hover:no-underline py-4 text-sm font-medium">
            <span className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Rango de Precio
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-4 px-2">
              <Slider
                min={priceRange.min}
                max={priceRange.max}
                step={5000}
                value={localPriceRange}
                onValueChange={handlePriceChange}
                onValueCommit={handlePriceCommit}
                className="w-full"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 rounded-lg bg-muted/30 px-3 py-2 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Mínimo</div>
                  <div className="text-sm font-semibold">{formatPrice(localPriceRange[0]!)}</div>
                </div>
                <div className="text-muted-foreground">—</div>
                <div className="flex-1 rounded-lg bg-muted/30 px-3 py-2 text-center">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Máximo</div>
                  <div className="text-sm font-semibold">{formatPrice(localPriceRange[1]!)}</div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
