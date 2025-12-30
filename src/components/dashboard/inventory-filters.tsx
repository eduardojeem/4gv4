'use client'

import { useState } from 'react'
import {
  Search,
  Filter,
  Calendar,
  Package,
  Tag,
  Building2,
  Star,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { DateRange } from 'react-day-picker'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'

interface FilterState {
  search: string
  category: string
  supplier: string
  stockStatus: string[]
  featured: boolean | null
  dateRange: DateRange | undefined
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

interface InventoryFiltersProps {
  onFiltersChange: (filters: FilterState) => void
  categories: string[]
  suppliers: string[]
  showSearch?: boolean
}

const initialFilters: FilterState = {
  search: '',
  category: '',
  supplier: '',
  stockStatus: [],
  featured: null,
  dateRange: undefined,
  sortBy: 'name',
  sortOrder: 'asc',
}

export function InventoryFilters({
  onFiltersChange,
  categories,
  suppliers,
  showSearch = false,
}: InventoryFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    ...initialFilters,
  })
  const [showAdvanced, setShowAdvanced] = useState(false)

  const updateFilters = (updated: Partial<FilterState>) => {
    const next = { ...filters, ...updated }
    setFilters(next)
    onFiltersChange(next)
  }

  const clearFilters = () => {
    const reset: FilterState = {
      ...initialFilters,
    }
    setFilters(reset)
    onFiltersChange(reset)
  }

  const sortOptions = [
    { value: 'name', label: 'Nombre' },
    { value: 'stock', label: 'Stock' },
    { value: 'created_at', label: 'Fecha de Creación' },
    { value: 'category', label: 'Categoría' },
    { value: 'supplier', label: 'Proveedor' },
  ]

  const stockStatusOptions = [
    { value: 'in_stock', label: 'En Stock' },
    { value: 'low_stock', label: 'Stock Bajo' },
    { value: 'out_of_stock', label: 'Sin Stock' },
    { value: 'overstocked', label: 'Sobrestock' },
  ]

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.search) count++
    if (filters.category) count++
    if (filters.supplier) count++
    if (filters.stockStatus.length) count++
    if (filters.featured !== null) count++
    if (filters.dateRange) count++
    if (filters.sortBy !== 'name' || filters.sortOrder !== 'asc') count++
    return count
  }

  return (
    <div className="space-y-4">
      {showSearch && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar productos por nombre, SKU o proveedor..."
                  value={filters.search}
                  onChange={(e) => updateFilters({ search: e.target.value })}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => onFiltersChange(filters)}>
                <Filter className="h-4 w-4 mr-2" />
                Aplicar
              </Button>
              {getActiveFiltersCount() > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {getActiveFiltersCount()}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-5 w-5" />
                Filtros de Inventario
              </CardTitle>
              <CardDescription className="text-xs">
                Compacto, claro e intuitivo
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
                Avanzado
              </Button>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpiar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Categoría y Proveedor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs">
                <Tag className="h-4 w-4" />
                Categoría
              </Label>
              <Select
                value={filters.category}
                onValueChange={(value) => updateFilters({ category: value })}
              >
                <SelectTrigger className="h-8 text-sm">
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

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-xs">
                <Building2 className="h-4 w-4" />
                Proveedor
              </Label>
              <Select
                value={filters.supplier}
                onValueChange={(value) => updateFilters({ supplier: value })}
              >
                <SelectTrigger className="h-8 text-sm">
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


          {/* Estado del stock */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs">
              <Package className="h-4 w-4" />
              Estado del Stock
            </Label>
            <Select
              value={filters.stockStatus[0] ?? ''}
              onValueChange={(value) => updateFilters({ stockStatus: value ? [value] : [] })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {stockStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Productos destacados */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs">
              <Star className="h-4 w-4" />
              Destacados
            </Label>
            <Select
              value={filters.featured === null ? 'all' : filters.featured ? 'true' : 'false'}
              onValueChange={(value) =>
                updateFilters({ featured: value === 'all' ? null : value === 'true' })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Solo destacados</SelectItem>
                <SelectItem value="false">No destacados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Avanzado: fecha y ordenamiento */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs">
                    <Calendar className="h-4 w-4" />
                    Fecha de creación
                  </Label>
                  <DatePickerWithRange
                    date={filters.dateRange}
                    onDateChange={(dateRange) => updateFilters({ dateRange })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Ordenar por</Label>
                  <Select
                    value={filters.sortBy}
                    onValueChange={(value) => updateFilters({ sortBy: value })}
                  >
                    <SelectTrigger className="h-8 text-sm">
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
                  <Label className="text-xs">Orden</Label>
                  <Select
                    value={filters.sortOrder}
                    onValueChange={(value) =>
                      updateFilters({ sortOrder: value as 'asc' | 'desc' })
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascendente</SelectItem>
                      <SelectItem value="desc">Descendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

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

              {filters.stockStatus.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  Stock: {
                    stockStatusOptions.find((s) =>
                      filters.stockStatus.includes(s.value)
                    )?.label
                  }
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => updateFilters({ stockStatus: [] })}
                  />
                </Badge>
              )}

              {filters.featured !== null && (
                <Badge variant="secondary" className="gap-1">
                  Destacados: {filters.featured ? 'Solo' : 'No'}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => updateFilters({ featured: null })}
                  />
                </Badge>
              )}

              {filters.dateRange && (
                <Badge variant="secondary" className="gap-1">
                  Fecha: rango seleccionado
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => updateFilters({ dateRange: undefined })}
                  />
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}