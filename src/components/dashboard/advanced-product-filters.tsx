'use client'

import { useState } from 'react'
import { 
  Filter, 
  X, 
  Search, 
  Calendar, 
  Package, 
  Tag,
  Building2,
  Star,
  AlertTriangle
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { DateRange } from 'react-day-picker'

interface FilterState {
  search: string
  category: string
  supplier: string
  priceRange: [number, number]
  marginRange?: [number, number]
  stockStatus: string[]
  featured: boolean | null
  dateRange: DateRange | undefined
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

interface AdvancedProductFiltersProps {
  onFiltersChange: (filters: FilterState) => void
  categories: string[]
  suppliers: string[]
  priceRange: [number, number]
  marginRange?: [number, number]
  inline?: boolean
  showSearch?: boolean
}

const initialFilters: FilterState = {
  search: '',
  category: '',
  supplier: '',
  priceRange: [0, 1000],
  stockStatus: [],
  featured: null,
  dateRange: undefined,
  sortBy: 'name',
  sortOrder: 'asc'
}

export function AdvancedProductFilters({ 
  onFiltersChange, 
  categories, 
  suppliers, 
  priceRange,
  marginRange,
  inline = false,
  showSearch = true,
}: AdvancedProductFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    ...initialFilters,
    priceRange,
    marginRange
  })
  const [isOpen, setIsOpen] = useState(false)

  const updateFilters = (newFilters: Partial<FilterState>) => {
    const updatedFilters = { ...filters, ...newFilters }
    setFilters(updatedFilters)
    onFiltersChange(updatedFilters)
  }

  const clearFilters = () => {
    const clearedFilters = { ...initialFilters, priceRange, marginRange }
    setFilters(clearedFilters)
    onFiltersChange(clearedFilters)
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.search) count++
    if (filters.category) count++
    if (filters.supplier) count++
    if (filters.priceRange[0] !== priceRange[0] || filters.priceRange[1] !== priceRange[1]) count++
    if (filters.marginRange && marginRange && (filters.marginRange[0] !== marginRange[0] || filters.marginRange[1] !== marginRange[1])) count++
    if (filters.stockStatus.length > 0) count++
    if (filters.featured !== null) count++
    if (filters.dateRange) count++
    return count
  }

  const stockStatusOptions = [
    { value: 'in_stock', label: 'En Stock', color: 'bg-green-100 text-green-800' },
    { value: 'low_stock', label: 'Stock Bajo', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'out_of_stock', label: 'Agotado', color: 'bg-red-100 text-red-800' },
    { value: 'overstocked', label: 'Sobrestock', color: 'bg-blue-100 text-blue-800' }
  ]

  const sortOptions = [
    { value: 'name', label: 'Nombre' },
    { value: 'price', label: 'Precio' },
    { value: 'stock', label: 'Stock' },
    { value: 'created_at', label: 'Fecha de Creación' },
    { value: 'category', label: 'Categoría' },
    { value: 'supplier', label: 'Proveedor' },
    // Ordenar por margen (%) cuando esté disponible; el hook tiene fallback
    { value: 'margin_percent', label: 'Margen (%)' }
  ]

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda principal (oculta si showSearch es false) */}
      {showSearch && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar productos por nombre, SKU o proveedor..."
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>
      )}

      {/* Contenedor de filtros: inline o Popover */}
      {!inline ? (
        <div className="flex items-center gap-2">
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="relative">
                <Filter className="h-4 w-4 mr-2" />
                Filtros Avanzados
                {getActiveFiltersCount() > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    {getActiveFiltersCount()}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="end">
              <Card className="border-0 shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Filtros Avanzados</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-muted-foreground"
                    >
                      Limpiar Todo
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                {/* Categoría y Proveedor */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Categoría
                    </Label>
                    <Select value={filters.category} onValueChange={(value) => updateFilters({ category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas las categorías" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Proveedor
                    </Label>
                    <Select value={filters.supplier} onValueChange={(value) => updateFilters({ supplier: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los proveedores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los proveedores</SelectItem>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier} value={supplier}>
                            {supplier}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Rango de precios */}
                <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <GSIcon className="h-4 w-4" />
                  Rango de Precios
                </Label>
                  <div className="px-2">
                    <Slider
                      value={filters.priceRange}
                      onValueChange={(value) => updateFilters({ priceRange: value as [number, number] })}
                      max={priceRange[1]}
                      min={priceRange[0]}
                      step={10}
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>${filters.priceRange[0]}</span>
                    <span>${filters.priceRange[1]}</span>
                  </div>
                </div>

                {/* Rango de margen */}
                {marginRange && (
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Rango de Margen (%)
                    </Label>
                    <div className="px-2">
                      <Slider
                        value={filters.marginRange || marginRange}
                        onValueChange={(value) => updateFilters({ marginRange: value as [number, number] })}
                        max={marginRange[1]}
                        min={marginRange[0]}
                        step={5}
                        className="w-full"
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{(filters.marginRange || marginRange)[0].toFixed(1)}%</span>
                      <span>{(filters.marginRange || marginRange)[1].toFixed(1)}%</span>
                    </div>
                  </div>
                )}

                {/* Estado del stock */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Estado del Stock
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {stockStatusOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={option.value}
                          checked={filters.stockStatus.includes(option.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              updateFilters({ 
                                stockStatus: [...filters.stockStatus, option.value] 
                              })
                            } else {
                              updateFilters({ 
                                stockStatus: filters.stockStatus.filter(s => s !== option.value) 
                              })
                            }
                          }}
                        />
                        <Label 
                          htmlFor={option.value} 
                          className="text-sm font-normal cursor-pointer"
                        >
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Productos destacados */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Productos Destacados
                  </Label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="featured-yes"
                        checked={filters.featured === true}
                        onCheckedChange={(checked) => 
                          updateFilters({ featured: checked ? true : null })
                        }
                      />
                      <Label htmlFor="featured-yes" className="text-sm">Solo destacados</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="featured-no"
                        checked={filters.featured === false}
                        onCheckedChange={(checked) => 
                          updateFilters({ featured: checked ? false : null })
                        }
                      />
                      <Label htmlFor="featured-no" className="text-sm">No destacados</Label>
                    </div>
                  </div>
                </div>

                {/* Rango de fechas */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Fecha de Creación
                  </Label>
                  <DatePickerWithRange
                    date={filters.dateRange}
                    onDateChange={(dateRange) => updateFilters({ dateRange })}
                  />
                </div>

                {/* Ordenamiento */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ordenar por</Label>
                    <Select value={filters.sortBy} onValueChange={(value) => updateFilters({ sortBy: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sortOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Orden</Label>
                    <Select 
                      value={filters.sortOrder} 
                      onValueChange={(value) => updateFilters({ sortOrder: value as 'asc' | 'desc' })}
                    >
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
                </CardContent>
              </Card>
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filtros Avanzados</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                Limpiar Todo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Categoría y Proveedor */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Categoría
                </Label>
                <Select value={filters.category} onValueChange={(value) => updateFilters({ category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Proveedor
                </Label>
                <Select value={filters.supplier} onValueChange={(value) => updateFilters({ supplier: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los proveedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los proveedores</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier} value={supplier}>
                        {supplier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Rango de precios */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <GSIcon className="h-4 w-4" />
                Rango de Precios
              </Label>
              <div className="px-2">
                <Slider
                  value={filters.priceRange}
                  onValueChange={(value) => updateFilters({ priceRange: value as [number, number] })}
                  max={priceRange[1]}
                  min={priceRange[0]}
                  step={10}
                  className="w-full"
                />
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>${filters.priceRange[0]}</span>
                <span>${filters.priceRange[1]}</span>
              </div>
            </div>

            {/* Rango de margen */}
            {marginRange && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Rango de Margen (%)
                </Label>
                <div className="px-2">
                  <Slider
                    value={filters.marginRange || marginRange}
                    onValueChange={(value) => updateFilters({ marginRange: value as [number, number] })}
                    max={marginRange[1]}
                    min={marginRange[0]}
                    step={5}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{(filters.marginRange || marginRange)[0].toFixed(1)}%</span>
                  <span>{(filters.marginRange || marginRange)[1].toFixed(1)}%</span>
                </div>
              </div>
            )}

            {/* Estado del stock */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Estado del Stock
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {stockStatusOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={option.value}
                      checked={filters.stockStatus.includes(option.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          updateFilters({ 
                            stockStatus: [...filters.stockStatus, option.value] 
                          })
                        } else {
                          updateFilters({ 
                            stockStatus: filters.stockStatus.filter(s => s !== option.value) 
                          })
                        }
                      }}
                    />
                    <Label 
                      htmlFor={option.value} 
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Productos destacados */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Productos Destacados
              </Label>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="featured-yes"
                    checked={filters.featured === true}
                    onCheckedChange={(checked) => 
                      updateFilters({ featured: checked ? true : null })
                    }
                  />
                  <Label htmlFor="featured-yes" className="text-sm">Solo destacados</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="featured-no"
                    checked={filters.featured === false}
                    onCheckedChange={(checked) => 
                      updateFilters({ featured: checked ? false : null })
                    }
                  />
                  <Label htmlFor="featured-no" className="text-sm">No destacados</Label>
                </div>
              </div>
            </div>

            {/* Rango de fechas */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fecha de Creación
              </Label>
              <DatePickerWithRange
                date={filters.dateRange}
                onDateChange={(dateRange) => updateFilters({ dateRange })}
              />
            </div>

            {/* Ordenamiento */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ordenar por</Label>
                <Select value={filters.sortBy} onValueChange={(value) => updateFilters({ sortBy: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Orden</Label>
                <Select 
                  value={filters.sortOrder} 
                  onValueChange={(value) => updateFilters({ sortOrder: value as 'asc' | 'desc' })}
                >
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
          </CardContent>
        </Card>
      )}

      {/* Filtros activos */}
      {getActiveFiltersCount() > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Filtros activos:</span>
          
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Búsqueda: {filters.search}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilters({ search: '' })}
              />
            </Badge>
          )}
          
          {filters.category && (
            <Badge variant="secondary" className="gap-1">
              {filters.category}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilters({ category: '' })}
              />
            </Badge>
          )}
          
          {filters.supplier && (
            <Badge variant="secondary" className="gap-1">
              {filters.supplier}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilters({ supplier: '' })}
              />
            </Badge>
          )}
          
          {(filters.priceRange[0] !== priceRange[0] || filters.priceRange[1] !== priceRange[1]) && (
            <Badge variant="secondary" className="gap-1">
              ${filters.priceRange[0]} - ${filters.priceRange[1]}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilters({ priceRange })}
              />
            </Badge>
          )}
          
          {filters.stockStatus.map((status) => {
            const option = stockStatusOptions.find(opt => opt.value === status)
            return option ? (
              <Badge key={status} variant="secondary" className="gap-1">
                {option.label}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => updateFilters({ 
                    stockStatus: filters.stockStatus.filter(s => s !== status) 
                  })}
                />
              </Badge>
            ) : null
          })}
          
          {filters.featured !== null && (
            <Badge variant="secondary" className="gap-1">
              {filters.featured ? 'Destacados' : 'No destacados'}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilters({ featured: null })}
              />
            </Badge>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            Limpiar todos
          </Button>
        </div>
      )}
    </div>
  )
}
