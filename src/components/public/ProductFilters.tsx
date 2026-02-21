'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { X, Loader2 } from 'lucide-react'
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

  useEffect(() => {
    setLocalPriceRange([
      Number(searchParams.get('min_price')) || 0,
      Number(searchParams.get('max_price')) || 50000000
    ])
  }, [searchParams])

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
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
              {activeFiltersCount}
            </span>
          )}
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        </h3>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpiar todo
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categoryId && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs font-normal rounded-full"
            >
              {categories.find((c) => c.id === categoryId)?.name || 'Categoria'}
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="gap-1 text-xs font-normal rounded-full"
            >
              {brand}
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="gap-1 text-xs font-normal rounded-full"
            >
              En stock
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="gap-1 text-xs font-normal rounded-full"
            >
              {formatPrice(minPrice)} - {formatPrice(maxPrice)}
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        defaultValue={['stock', 'category', 'price', 'brand']}
        className="w-full rounded-xl border border-border/60 bg-background/70 px-3"
      >
        {/* Disponibilidad */}
        <AccordionItem value="stock" className="border-b border-border/50">
          <AccordionTrigger className="hover:no-underline py-3 text-sm font-medium">
            Disponibilidad
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex items-center justify-between rounded-lg p-2 hover:bg-muted/50 transition-colors">
              <Label
                htmlFor="in-stock"
                className="cursor-pointer text-sm text-muted-foreground"
              >
                Solo en stock
              </Label>
              <Switch
                id="in-stock"
                checked={inStock}
                onCheckedChange={(checked) => updateFilters({ in_stock: checked })}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Categorias */}
        {categories.length > 0 && (
          <AccordionItem value="category" className="border-b border-border/50">
            <AccordionTrigger className="hover:no-underline py-3 text-sm font-medium">
              Categorias
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-0.5">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    className={`w-full flex items-center rounded-lg px-2 py-2 text-sm transition-colors text-left ${
                      categoryId === category.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                    onClick={() => updateFilters({ category_id: category.id === categoryId ? null : category.id })}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Precio */}
        <AccordionItem value="price" className="border-b border-border/50">
          <AccordionTrigger className="hover:no-underline py-3 text-sm font-medium">
            Precio
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-4 px-1">
              <Slider
                min={priceRange.min}
                max={priceRange.max}
                step={5000}
                value={localPriceRange}
                onValueChange={handlePriceChange}
                onValueCommit={handlePriceCommit}
                className="w-full"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatPrice(localPriceRange[0]!)}</span>
                <span>{formatPrice(localPriceRange[1]!)}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Marcas */}
        {brands.length > 0 && (
          <AccordionItem value="brand" className="border-0">
            <AccordionTrigger className="hover:no-underline py-3 text-sm font-medium">
              Marcas
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {brands.map((brandName) => (
                  <button
                    key={brandName}
                    className={`w-full flex items-center rounded-lg px-2 py-2 text-sm transition-colors text-left ${
                      brand === brandName
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                    onClick={() => updateFilters({ brand: brand === brandName ? null : brandName })}
                  >
                    {brandName}
                  </button>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  )
}
