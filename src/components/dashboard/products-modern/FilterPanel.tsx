/**
 * FilterPanel Component
 * Advanced filtering options with real-time product count
 */

import React, { useMemo } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Category, Supplier, Product } from '@/types/products'
import { DashboardFilters } from '@/types/products-dashboard'
import { applyFilters, getUniqueBrands } from '@/lib/products-dashboard-utils'
import { cn } from '@/lib/utils'

export interface FilterPanelProps {
  isOpen: boolean
  products: Product[]
  categories: Category[]
  suppliers: Supplier[]
  filters: DashboardFilters
  onFiltersChange: (filters: DashboardFilters) => void
  onClearFilters: () => void
  onClose?: () => void
  /** Full brand list (e.g. from the brands table). Falls back to brands derived from `products`. */
  brandOptions?: string[]
  /** Global result count. When provided overrides the count derived from `products`. */
  resultCount?: number
  className?: string
}

export function FilterPanel({
  isOpen,
  products,
  categories,
  suppliers,
  filters,
  onFiltersChange,
  onClearFilters,
  onClose,
  brandOptions,
  resultCount,
  className
}: FilterPanelProps) {
  const ALL_OPTION_VALUE = '__all__'

  // Prefer the full brand list; otherwise derive from the products in view.
  const brands = useMemo(
    () => brandOptions ?? getUniqueBrands(products),
    [brandOptions, products]
  )

  // Calculate filtered product count: prefer the global count, else derive locally.
  const filteredCount = useMemo(() => {
    return resultCount ?? applyFilters(products, filters).length
  }, [resultCount, products, filters])

  if (!isOpen) return null

  const handleFilterChange = (key: keyof DashboardFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof DashboardFilters]
    return value !== undefined && value !== null && value !== ''
  })

  return (
    <div 
      id="filter-panel"
      role="region"
      aria-label="Panel de filtros avanzados"
      className={cn('space-y-4 text-xs', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Filtros Avanzados</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800" role="status">
            {filteredCount} {filteredCount === 1 ? 'producto' : 'productos'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Limpiar todos los filtros"
              onClick={onClearFilters}
              className="h-7 px-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Limpiar
            </Button>
          )}

          {onClose && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-7 px-2.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Cerrar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Filters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Category Filter */}
        <div className="space-y-2">
          <Label htmlFor="category-filter">Categoría</Label>
          <Select
            value={filters.category_id || ALL_OPTION_VALUE}
            onValueChange={(value) => handleFilterChange('category_id', value === ALL_OPTION_VALUE ? undefined : value)}
          >
            <SelectTrigger id="category-filter">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OPTION_VALUE}>Todas las categorías</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Supplier Filter */}
        <div className="space-y-2">
          <Label htmlFor="supplier-filter">Proveedor</Label>
          <Select
            value={filters.supplier_id || ALL_OPTION_VALUE}
            onValueChange={(value) => handleFilterChange('supplier_id', value === ALL_OPTION_VALUE ? undefined : value)}
          >
            <SelectTrigger id="supplier-filter">
              <SelectValue placeholder="Todos los proveedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OPTION_VALUE}>Todos los proveedores</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Brand Filter */}
        <div className="space-y-2">
          <Label htmlFor="brand-filter">Marca</Label>
          <Select
            value={filters.brand || ALL_OPTION_VALUE}
            onValueChange={(value) => handleFilterChange('brand', value === ALL_OPTION_VALUE ? undefined : value)}
          >
            <SelectTrigger id="brand-filter">
              <SelectValue placeholder="Todas las marcas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OPTION_VALUE}>Todas las marcas</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Price Range - Min */}
        <div className="space-y-2">
          <Label htmlFor="price-min">Precio Mínimo</Label>
          <Input
            id="price-min"
            type="number"
            placeholder="0"
            min="0"
            step="0.01"
            value={filters.price_min || ''}
            onChange={(e) => handleFilterChange('price_min', e.target.value ? parseFloat(e.target.value) : undefined)}
          />
        </div>

        {/* Price Range - Max */}
        <div className="space-y-2">
          <Label htmlFor="price-max">Precio Máximo</Label>
          <Input
            id="price-max"
            type="number"
            placeholder="Sin límite"
            min="0"
            step="0.01"
            value={filters.price_max || ''}
            onChange={(e) => handleFilterChange('price_max', e.target.value ? parseFloat(e.target.value) : undefined)}
          />
        </div>

        {/* Stock Status Filter */}
        <div className="space-y-2">
          <Label htmlFor="stock-status-filter">Estado de Stock</Label>
          <Select
            value={filters.stock_status || ALL_OPTION_VALUE}
            onValueChange={(value) => handleFilterChange('stock_status', value === ALL_OPTION_VALUE ? undefined : value)}
          >
            <SelectTrigger id="stock-status-filter">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OPTION_VALUE}>Todos los estados</SelectItem>
              <SelectItem value="in_stock">En Stock</SelectItem>
              <SelectItem value="low_stock">Bajo Stock</SelectItem>
              <SelectItem value="out_of_stock">Agotado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Status Checkbox */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="active-filter"
          checked={filters.is_active === true}
          onCheckedChange={(checked) => {
            handleFilterChange('is_active', checked === true ? true : undefined)
          }}
        />
        <Label
          htmlFor="active-filter"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          Solo productos activos
        </Label>
      </div>
    </div>
  )
}
