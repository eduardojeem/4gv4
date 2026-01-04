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
  className
}: FilterPanelProps) {
  // Get unique brands from products
  const brands = useMemo(() => getUniqueBrands(products), [products])

  // Calculate filtered product count in real-time
  const filteredCount = useMemo(() => {
    return applyFilters(products, filters).length
  }, [products, filters])

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
      className={cn('space-y-6', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filtros Avanzados</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1" role="status" aria-live="polite">
            {filteredCount} {filteredCount === 1 ? 'producto' : 'productos'} encontrados
          </p>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Limpiar todos los filtros"
            onClick={onClearFilters}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4 mr-2" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Filters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Category Filter */}
        <div className="space-y-2">
          <Label htmlFor="category-filter">Categoría</Label>
          <Select
            value={filters.category_id || ''}
            onValueChange={(value) => handleFilterChange('category_id', value || undefined)}
          >
            <SelectTrigger id="category-filter">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas las categorías</SelectItem>
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
            value={filters.supplier_id || ''}
            onValueChange={(value) => handleFilterChange('supplier_id', value || undefined)}
          >
            <SelectTrigger id="supplier-filter">
              <SelectValue placeholder="Todos los proveedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los proveedores</SelectItem>
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
            value={filters.brand || ''}
            onValueChange={(value) => handleFilterChange('brand', value || undefined)}
          >
            <SelectTrigger id="brand-filter">
              <SelectValue placeholder="Todas las marcas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas las marcas</SelectItem>
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
            value={filters.stock_status || ''}
            onValueChange={(value) => handleFilterChange('stock_status', value || undefined)}
          >
            <SelectTrigger id="stock-status-filter">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los estados</SelectItem>
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
