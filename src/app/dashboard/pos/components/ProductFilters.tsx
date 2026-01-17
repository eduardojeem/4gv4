/**
 * Componente de filtros de productos para el POS
 * Ejemplo de cómo usar el hook usePOSFilters
 */

'use client'

import React from 'react'
import { Search, Filter, X, Grid, List, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { formatCurrency } from '@/lib/currency'
import type { POSFiltersState, POSFiltersActions } from '../hooks/usePOSFilters'

interface ProductFiltersProps {
  state: POSFiltersState
  actions: POSFiltersActions
  categories: string[]
  priceRangeLimits: { min: number; max: number }
  totalResults: number
}

export function ProductFilters({
  state,
  actions,
  categories,
  priceRangeLimits,
  totalResults
}: ProductFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Búsqueda Principal */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar productos..."
          value={state.searchTerm}
          onChange={(e) => actions.setSearchTerm(e.target.value)}
          className="pl-10 pr-10"
        />
        {state.searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            onClick={() => actions.setSearchTerm('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filtros Rápidos */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={state.selectedCategory} onValueChange={actions.setSelectedCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>
                {cat === 'all' ? 'Todas las categorías' : cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={state.stockFilter} onValueChange={actions.setStockFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo el stock</SelectItem>
            <SelectItem value="in_stock">En stock</SelectItem>
            <SelectItem value="low_stock">Stock bajo</SelectItem>
            <SelectItem value="out_of_stock">Sin stock</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
          <Switch
            id="featured"
            checked={state.showFeatured}
            onCheckedChange={actions.setShowFeatured}
          />
          <Label htmlFor="featured" className="text-sm cursor-pointer">
            Destacados
          </Label>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={actions.toggleAdvancedFilters}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtros avanzados
        </Button>

        {/* Vista */}
        <div className="ml-auto flex items-center gap-1 border rounded-md p-1">
          <Button
            variant={state.viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => actions.setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={state.viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => actions.setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filtros Avanzados */}
      <Collapsible open={state.showAdvancedFilters}>
        <CollapsibleContent className="space-y-4 pt-4 border-t">
          {/* Rango de Precio */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Rango de precio: {formatCurrency(state.priceRange.min)} - {formatCurrency(state.priceRange.max)}
            </Label>
            <Slider
              min={priceRangeLimits.min}
              max={priceRangeLimits.max}
              step={1000}
              value={[state.priceRange.min, state.priceRange.max]}
              onValueChange={([min, max]) => actions.setPriceRange({ min, max })}
              className="w-full"
            />
          </div>

          {/* Ordenamiento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ordenar por</Label>
              <Select value={state.sortBy} onValueChange={actions.setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nombre</SelectItem>
                  <SelectItem value="price">Precio</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="category">Categoría</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Orden</Label>
              <Select value={state.sortOrder} onValueChange={actions.setSortOrder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascendente</SelectItem>
                  <SelectItem value="desc">Descendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botón de reset */}
          <Button
            variant="outline"
            size="sm"
            onClick={actions.resetFilters}
            className="w-full"
          >
            <X className="h-4 w-4 mr-2" />
            Limpiar filtros
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {/* Resultados */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{totalResults} productos encontrados</span>
        {state.searchTerm && (
          <Badge variant="secondary">
            Buscando: "{state.searchTerm}"
          </Badge>
        )}
      </div>
    </div>
  )
}
