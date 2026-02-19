'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
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
  filters: {
    category_id: string
    brand: string
    min_price: number
    max_price: number
    in_stock: boolean
  }
  setFilters: (filters: ProductFiltersProps['filters']) => void
  priceRange?: { min: number; max: number }
  categories?: Category[]
  brands?: string[]
}

export function ProductFilters({
  filters,
  setFilters,
  priceRange = { min: 0, max: 1000000 },
  categories = [],
  brands = [],
}: ProductFiltersProps) {
  const [localPriceRange, setLocalPriceRange] = useState([
    filters.min_price,
    filters.max_price,
  ])

  useEffect(() => {
    setLocalPriceRange([filters.min_price, filters.max_price])
  }, [filters.min_price, filters.max_price])

  const handlePriceChange = (values: number[]) => {
    setLocalPriceRange(values)
  }

  const handlePriceCommit = (values: number[]) => {
    setFilters({ ...filters, min_price: values[0]!, max_price: values[1]! })
  }

  const handleCategoryChange = (categoryId: string) => {
    setFilters({
      ...filters,
      category_id: filters.category_id === categoryId ? '' : categoryId,
    })
  }

  const handleBrandChange = (brandName: string) => {
    setFilters({
      ...filters,
      brand: filters.brand === brandName ? '' : brandName,
    })
  }

  const clearFilters = () => {
    setFilters({
      category_id: '',
      brand: '',
      min_price: 0,
      max_price: 50000000,
      in_stock: false,
    })
    setLocalPriceRange([0, 50000000])
  }

  const activeFiltersCount = [
    filters.category_id !== '',
    filters.brand !== '',
    filters.in_stock,
    filters.min_price > 0 || filters.max_price < 50000000,
  ].filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Filtros
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
          {filters.category_id && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs font-normal rounded-full"
            >
              {categories.find((c) => c.id === filters.category_id)?.name}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setFilters({ ...filters, category_id: '' })}
              />
            </Badge>
          )}
          {filters.brand && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs font-normal rounded-full"
            >
              {filters.brand}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setFilters({ ...filters, brand: '' })}
              />
            </Badge>
          )}
          {filters.in_stock && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs font-normal rounded-full"
            >
              En stock
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setFilters({ ...filters, in_stock: false })}
              />
            </Badge>
          )}
          {(filters.min_price > 0 || filters.max_price < 999999) && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs font-normal rounded-full"
            >
              {formatPrice(filters.min_price)} - {formatPrice(filters.max_price)}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  setFilters({ ...filters, min_price: 0, max_price: 50000000 })
                }
              />
            </Badge>
          )}
        </div>
      )}

      <Accordion
        type="multiple"
        defaultValue={['stock', 'category', 'price', 'brand']}
        className="w-full"
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
                checked={filters.in_stock}
                onCheckedChange={(checked) =>
                  setFilters({ ...filters, in_stock: checked })
                }
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
                      filters.category_id === category.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                    onClick={() => handleCategoryChange(category.id)}
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
                {brands.map((brand) => (
                  <button
                    key={brand}
                    className={`w-full flex items-center rounded-lg px-2 py-2 text-sm transition-colors text-left ${
                      filters.brand === brand
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                    onClick={() => handleBrandChange(brand)}
                  >
                    {brand}
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
