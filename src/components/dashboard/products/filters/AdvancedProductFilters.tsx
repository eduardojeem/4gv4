'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Filter,
  Search,
  X,
  ChevronDown,
  Calendar,
  Package,
  Tag,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Settings
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'
import { useProductFiltering } from '@/hooks/products'

interface AdvancedProductFiltersProps {
  className?: string
  onFiltersChange?: (filters: any) => void
  showPresets?: boolean
  collapsible?: boolean
}

const stockStatusOptions = [
  { value: 'in_stock', label: 'En Stock', color: 'bg-green-100 text-green-800' },
  { value: 'low_stock', label: 'Stock Bajo', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'out_of_stock', label: 'Agotado', color: 'bg-red-100 text-red-800' },
  { value: 'overstock', label: 'Sobrestock', color: 'bg-blue-100 text-blue-800' }
]

const marginStatusOptions = [
  { value: 'low', label: 'Margen Bajo (<10%)', color: 'bg-red-100 text-red-800' },
  { value: 'medium', label: 'Margen Medio (10-20%)', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'good', label: 'Margen Bueno (20-50%)', color: 'bg-green-100 text-green-800' },
  { value: 'high', label: 'Margen Alto (>50%)', color: 'bg-blue-100 text-blue-800' }
]

const filterPresets = [
  {
    id: 'low_stock',
    name: 'Stock Bajo',
    icon: AlertTriangle,
    filters: { stockStatus: ['low_stock', 'out_of_stock'] }
  },
  {
    id: 'high_margin',
    name: 'Alto Margen',
    icon: TrendingUp,
    filters: { marginStatus: ['good', 'high'] }
  },
  {
    id: 'recent',
    name: 'Recientes',
    icon: Calendar,
    filters: { dateRange: { days: 30 } }
  },
  {
    id: 'expensive',
    name: 'Productos Caros',
    icon: GSIcon,
    filters: { priceRange: { min: 100 } }
  }
]

export const AdvancedProductFilters = ({
  className,
  onFiltersChange,
  showPresets = true,
  collapsible = false
}: AdvancedProductFiltersProps) => {
  const [isOpen, setIsOpen] = useState(!collapsible)
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const {
    searchTerm,
    setSearchTerm,
    filters,
    updateFilters,
    clearFilters,
    activeFiltersCount,
    priceRange,
    stockRange,
    marginRange,
    categories,
    suppliers
  } = useProductFiltering({
    onFiltersChange
  })

  const handlePresetClick = (preset: typeof filterPresets[0]) => {
    if (activePreset === preset.id) {
      clearFilters()
      setActivePreset(null)
    } else {
      updateFilters(preset.filters)
      setActivePreset(preset.id)
    }
  }

  const handleFilterChange = (key: string, value: any) => {
    updateFilters({ [key]: value })
    setActivePreset(null) // Desactivar preset al cambiar filtros manualmente
  }

  const FilterSection = ({ title, icon: Icon, children }: {
    title: string
    icon: any
    children: React.ReactNode
  }) => (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">{title}</Label>
      </div>
      {children}
    </div>
  )

  const content = (
    <div className="space-y-6">
      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar productos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Presets de filtros */}
      {showPresets && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Filtros Rápidos</Label>
          <div className="flex flex-wrap gap-2">
            {filterPresets.map((preset) => {
              const Icon = preset.icon
              return (
                <Button
                  key={preset.id}
                  variant={activePreset === preset.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetClick(preset)}
                  className="h-8"
                >
                  <Icon className="h-3 w-3 mr-2" />
                  {preset.name}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      <Separator />

      {/* Filtros por categoría */}
      <FilterSection title="Categoría" icon={Tag}>
        <Select
          value={filters.categoryId || ''}
          onValueChange={(value) => handleFilterChange('categoryId', value || null)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      {/* Filtros por proveedor */}
      <FilterSection title="Proveedor" icon={Package}>
        <Select
          value={filters.supplierId || ''}
          onValueChange={(value) => handleFilterChange('supplierId', value || null)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos los proveedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proveedores</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      {/* Filtros por estado de stock */}
      <FilterSection title="Estado de Stock" icon={AlertTriangle}>
        <div className="space-y-2">
          {stockStatusOptions.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`stock-${option.value}`}
                checked={filters.stockStatus?.includes(option.value) || false}
                onCheckedChange={(checked) => {
                  const current = filters.stockStatus || []
                  const updated = checked
                    ? [...current, option.value]
                    : current.filter(s => s !== option.value)
                  handleFilterChange('stockStatus', updated.length > 0 ? updated : null)
                }}
              />
              <Label
                htmlFor={`stock-${option.value}`}
                className="text-sm cursor-pointer"
              >
                <Badge variant="outline" className={option.color}>
                  {option.label}
                </Badge>
              </Label>
            </div>
          ))}
        </div>
      </FilterSection>

      {/* Filtros por rango de precio */}
      <FilterSection title="Rango de Precio" icon={GSIcon}>
        <div className="space-y-4">
          <div className="px-2">
            <Slider
              value={[filters.priceMin || priceRange.min, filters.priceMax || priceRange.max]}
              onValueChange={([min, max]) => {
                handleFilterChange('priceMin', min === priceRange.min ? null : min)
                handleFilterChange('priceMax', max === priceRange.max ? null : max)
              }}
              min={priceRange.min}
              max={priceRange.max}
              step={1}
              className="w-full"
            />
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>€{filters.priceMin || priceRange.min}</span>
            <span>-</span>
            <span>€{filters.priceMax || priceRange.max}</span>
          </div>
        </div>
      </FilterSection>

      {/* Filtros por rango de stock */}
      <FilterSection title="Rango de Stock" icon={Package}>
        <div className="space-y-4">
          <div className="px-2">
            <Slider
              value={[filters.stockMin || stockRange.min, filters.stockMax || stockRange.max]}
              onValueChange={([min, max]) => {
                handleFilterChange('stockMin', min === stockRange.min ? null : min)
                handleFilterChange('stockMax', max === stockRange.max ? null : max)
              }}
              min={stockRange.min}
              max={stockRange.max}
              step={1}
              className="w-full"
            />
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>{filters.stockMin || stockRange.min}</span>
            <span>-</span>
            <span>{filters.stockMax || stockRange.max}</span>
          </div>
        </div>
      </FilterSection>

      {/* Filtros por margen */}
      <FilterSection title="Margen de Beneficio" icon={TrendingUp}>
        <div className="space-y-2">
          {marginStatusOptions.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`margin-${option.value}`}
                checked={filters.marginStatus?.includes(option.value) || false}
                onCheckedChange={(checked) => {
                  const current = filters.marginStatus || []
                  const updated = checked
                    ? [...current, option.value]
                    : current.filter(s => s !== option.value)
                  handleFilterChange('marginStatus', updated.length > 0 ? updated : null)
                }}
              />
              <Label
                htmlFor={`margin-${option.value}`}
                className="text-sm cursor-pointer"
              >
                <Badge variant="outline" className={option.color}>
                  {option.label}
                </Badge>
              </Label>
            </div>
          ))}
        </div>
      </FilterSection>

      {/* Filtros por fecha */}
      <FilterSection title="Fecha de Creación" icon={Calendar}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <DatePicker
              date={filters.dateFrom}
              onDateChange={(date) => handleFilterChange('dateFrom', date)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <DatePicker
              date={filters.dateTo}
              onDateChange={(date) => handleFilterChange('dateTo', date)}
            />
          </div>
        </div>
      </FilterSection>

      {/* Botón para limpiar filtros */}
      {activeFiltersCount > 0 && (
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={clearFilters}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Limpiar Filtros ({activeFiltersCount})
          </Button>
        </div>
      )}
    </div>
  )

  if (collapsible) {
    return (
      <Card className={className}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Filter className="h-5 w-5" />
                  <span>Filtros Avanzados</span>
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary">{activeFiltersCount}</Badge>
                  )}
                </CardTitle>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  isOpen && "transform rotate-180"
                )} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {content}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Filter className="h-5 w-5" />
          <span>Filtros Avanzados</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary">{activeFiltersCount}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  )
}

export default AdvancedProductFilters
