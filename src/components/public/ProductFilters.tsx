'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { X, SlidersHorizontal } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'

interface Category {
  id: string
  name: string
}

interface ProductFiltersProps {
  filters: {
    category_id: string
    min_price: number
    max_price: number
    in_stock: boolean
  }
  setFilters: (filters: any) => void
  totalProducts?: number
  priceRange?: { min: number; max: number }
  categories?: Category[]
  brands?: string[]
}

export function ProductFilters({ 
  filters, 
  setFilters, 
  totalProducts = 0,
  priceRange = { min: 0, max: 1000000 },
  categories = [],
  brands = []
}: ProductFiltersProps) {
  const [localPriceRange, setLocalPriceRange] = useState([filters.min_price, filters.max_price])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])

  // Sincronizar precio local con filtros
  useEffect(() => {
    setLocalPriceRange([filters.min_price, filters.max_price])
  }, [filters.min_price, filters.max_price])

  const handlePriceChange = (values: number[]) => {
    setLocalPriceRange(values)
  }

  const handlePriceCommit = (values: number[]) => {
    setFilters({ ...filters, min_price: values[0], max_price: values[1] })
  }

  const handleCategoryChange = (categoryId: string) => {
    setFilters({ 
      ...filters, 
      category_id: filters.category_id === categoryId ? '' : categoryId 
    })
  }

  const handleBrandToggle = (brand: string) => {
    const newBrands = selectedBrands.includes(brand)
      ? selectedBrands.filter(b => b !== brand)
      : [...selectedBrands, brand]
    setSelectedBrands(newBrands)
    // Aquí podrías agregar la lógica para filtrar por marca en el backend
  }

  const clearFilters = () => {
    setFilters({
      category_id: '',
      min_price: priceRange.min,
      max_price: priceRange.max,
      in_stock: false
    })
    setSelectedBrands([])
    setLocalPriceRange([priceRange.min, priceRange.max])
  }

  const activeFiltersCount = [
    filters.category_id !== '',
    filters.in_stock,
    filters.min_price !== priceRange.min || filters.max_price !== priceRange.max,
    selectedBrands.length > 0
  ].filter(Boolean).length

  return (
    <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Filtros</h3>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary">{activeFiltersCount}</Badge>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="h-8 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Results Count */}
      {totalProducts > 0 && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          Mostrando <span className="font-semibold text-foreground">{totalProducts}</span> productos
        </div>
      )}

      <Accordion type="multiple" defaultValue={['stock', 'category', 'price']} className="w-full">
        {/* Stock Filter */}
        <AccordionItem value="stock" className="border-b">
          <AccordionTrigger className="hover:no-underline py-3">
            <span className="font-medium">Disponibilidad</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <Label htmlFor="in-stock" className="cursor-pointer flex-1">
                Solo productos en stock
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

        {/* Category Filter */}
        {categories.length > 0 && (
          <AccordionItem value="category" className="border-b">
            <AccordionTrigger className="hover:no-underline py-3">
              <span className="font-medium">Categorías</span>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                      filters.category_id === category.id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleCategoryChange(category.id)}
                  >
                    <Checkbox
                      id={`category-${category.id}`}
                      checked={filters.category_id === category.id}
                      onCheckedChange={() => handleCategoryChange(category.id)}
                      className="mr-3"
                    />
                    <Label
                      htmlFor={`category-${category.id}`}
                      className="cursor-pointer flex-1 font-normal"
                    >
                      {category.name}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Price Range Filter */}
        <AccordionItem value="price" className="border-b">
          <AccordionTrigger className="hover:no-underline py-3">
            <span className="font-medium">Rango de precio</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-4 px-2">
              <Slider
                min={priceRange.min}
                max={priceRange.max}
                step={1000}
                value={localPriceRange}
                onValueChange={handlePriceChange}
                onValueCommit={handlePriceCommit}
                className="w-full"
              />
              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                  Desde: <span className="font-semibold text-foreground">{formatPrice(localPriceRange[0])}</span>
                </div>
                <div className="text-muted-foreground">
                  Hasta: <span className="font-semibold text-foreground">{formatPrice(localPriceRange[1])}</span>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Brand Filter */}
        {brands.length > 0 && (
          <AccordionItem value="brand" className="border-0">
            <AccordionTrigger className="hover:no-underline py-3">
              <span className="font-medium">Marcas</span>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {brands.map((brand) => (
                  <div
                    key={brand}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedBrands.includes(brand)
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleBrandToggle(brand)}
                  >
                    <Checkbox
                      id={`brand-${brand}`}
                      checked={selectedBrands.includes(brand)}
                      onCheckedChange={() => handleBrandToggle(brand)}
                      className="mr-3"
                    />
                    <Label
                      htmlFor={`brand-${brand}`}
                      className="cursor-pointer flex-1 font-normal"
                    >
                      {brand}
                    </Label>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="pt-4 border-t space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Filtros activos:</p>
          <div className="flex flex-wrap gap-2">
            {filters.category_id && (
              <Badge variant="secondary" className="gap-1">
                {categories.find(c => c.id === filters.category_id)?.name}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setFilters({ ...filters, category_id: '' })}
                />
              </Badge>
            )}
            {filters.in_stock && (
              <Badge variant="secondary" className="gap-1">
                En stock
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setFilters({ ...filters, in_stock: false })}
                />
              </Badge>
            )}
            {(filters.min_price !== priceRange.min || filters.max_price !== priceRange.max) && (
              <Badge variant="secondary" className="gap-1">
                {formatPrice(filters.min_price)} - {formatPrice(filters.max_price)}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setFilters({ 
                    ...filters, 
                    min_price: priceRange.min, 
                    max_price: priceRange.max 
                  })}
                />
              </Badge>
            )}
            {selectedBrands.map(brand => (
              <Badge key={brand} variant="secondary" className="gap-1">
                {brand}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => handleBrandToggle(brand)}
                />
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
