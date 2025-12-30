'use client'

import { useState, useEffect, useMemo, memo } from 'react'
import { 
  Filter, 
  X, 
  ChevronDown, 
  Search,
  Package,
  AlertTriangle,
  Calendar,
  Tag,
  Users,
  BarChart3,
  Sliders,
  RefreshCw
} from 'lucide-react'
import { GSIcon } from '@/components/ui/standardized-components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
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
import { Checkbox } from '@/components/ui/checkbox'

export interface ProductFiltersProps {
  products: any[] | undefined | null
  onFiltersChange: (filteredProducts: any[]) => void
}

interface FilterState {
  search: string
  categories: string[]
  suppliers: string[]
  stockStatus: string[]
  priceRange: [number, number]
  marginRange: [number, number]
  stockRange: [number, number]
  dateRange: {
    from: string
    to: string
  }
  sortBy: string
  sortOrder: 'asc' | 'desc'
  showOutOfStock: boolean
  showLowStock: boolean
  showDiscontinued: boolean
}

const defaultFilters: FilterState = {
  search: '',
  categories: [],
  suppliers: [],
  stockStatus: [],
  priceRange: [0, 1000],
  marginRange: [0, 100],
  stockRange: [0, 1000],
  dateRange: {
    from: '',
    to: ''
  },
  sortBy: 'name',
  sortOrder: 'asc',
  showOutOfStock: true,
  showLowStock: true,
  showDiscontinued: false
}

const ProductFilters = memo(({ products, onFiltersChange }: ProductFiltersProps) => {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [isOpen, setIsOpen] = useState(false)
  const [activeFiltersCount, setActiveFiltersCount] = useState(0)

  // Extraer datos únicos de los productos para los filtros
  const filterOptions = useMemo(() => {
    if (!products || !Array.isArray(products)) {
      return {
        categories: [],
        suppliers: [],
        maxPrice: 1000,
        maxMargin: 100,
        maxStock: 1000
      }
    }

    const categories = [...new Set(products.map(p => p.category).filter(Boolean))]
    const suppliers = [...new Set(products.map(p => p.supplier).filter(Boolean))]
    const prices = products.map(p => p.sale_price || 0).filter(p => p > 0)
    const margins = products.map(p => {
      if (p.purchase_price > 0 && p.sale_price > 0) {
        return ((p.sale_price - p.purchase_price) / p.purchase_price) * 100
      }
      return 0
    }).filter(m => m > 0)
    const stocks = products.map(p => p.stock_quantity || 0)

    return {
      categories: categories.sort(),
      suppliers: suppliers.sort(),
      maxPrice: Math.max(...prices, 1000),
      maxMargin: Math.max(...margins, 100),
      maxStock: Math.max(...stocks, 1000)
    }
  }, [products])

  // Aplicar filtros a los productos
  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) {
      return []
    }

    let filtered = [...products]

    // Filtro de búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchLower) ||
        product.sku?.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower) ||
        product.category?.toLowerCase().includes(searchLower) ||
        product.supplier?.toLowerCase().includes(searchLower)
      )
    }

    // Filtro de categorías
    if (filters.categories.length > 0) {
      filtered = filtered.filter(product =>
        filters.categories.includes(product.category)
      )
    }

    // Filtro de proveedores
    if (filters.suppliers.length > 0) {
      filtered = filtered.filter(product =>
        filters.suppliers.includes(product.supplier)
      )
    }

    // Filtro de estado de stock
    if (filters.stockStatus.length > 0) {
      filtered = filtered.filter(product => {
        const stockStatus = getStockStatus(product.stock_quantity, product.min_stock)
        return filters.stockStatus.includes(stockStatus)
      })
    }

    // Filtro de rango de precios
    filtered = filtered.filter(product =>
      product.sale_price >= filters.priceRange[0] &&
      product.sale_price <= filters.priceRange[1]
    )

    // Filtro de rango de margen
    filtered = filtered.filter(product => {
      if (product.purchase_price > 0 && product.sale_price > 0) {
        const margin = ((product.sale_price - product.purchase_price) / product.purchase_price) * 100
        return margin >= filters.marginRange[0] && margin <= filters.marginRange[1]
      }
      return true
    })

    // Filtro de rango de stock
    filtered = filtered.filter(product =>
      product.stock_quantity >= filters.stockRange[0] &&
      product.stock_quantity <= filters.stockRange[1]
    )

    // Filtros de estado
    if (!filters.showOutOfStock) {
      filtered = filtered.filter(product => product.stock_quantity > 0)
    }

    if (!filters.showLowStock) {
      filtered = filtered.filter(product => 
        product.stock_quantity > product.min_stock
      )
    }

    if (!filters.showDiscontinued) {
      filtered = filtered.filter(product => product.status !== 'discontinued')
    }

    // Filtro de fecha
    if (filters.dateRange.from) {
      filtered = filtered.filter(product => {
        const productDate = new Date(product.created_at)
        const fromDate = new Date(filters.dateRange.from)
        return productDate >= fromDate
      })
    }

    if (filters.dateRange.to) {
      filtered = filtered.filter(product => {
        const productDate = new Date(product.created_at)
        const toDate = new Date(filters.dateRange.to)
        return productDate <= toDate
      })
    }

    // Ordenamiento
    filtered.sort((a, b) => {
      let aValue, bValue

      switch (filters.sortBy) {
        case 'name':
          aValue = a.name?.toLowerCase() || ''
          bValue = b.name?.toLowerCase() || ''
          break
        case 'price':
          aValue = a.sale_price || 0
          bValue = b.sale_price || 0
          break
        case 'stock':
          aValue = a.stock_quantity || 0
          bValue = b.stock_quantity || 0
          break
        case 'margin':
          aValue = a.purchase_price > 0 ? ((a.sale_price - a.purchase_price) / a.purchase_price) * 100 : 0
          bValue = b.purchase_price > 0 ? ((b.sale_price - b.purchase_price) / b.purchase_price) * 100 : 0
          break
        case 'created':
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        default:
          aValue = a.name?.toLowerCase() || ''
          bValue = b.name?.toLowerCase() || ''
      }

      if (typeof aValue === 'string') {
        return filters.sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      } else {
        return filters.sortOrder === 'asc' 
          ? aValue - bValue
          : bValue - aValue
      }
    })

    return filtered
  }, [products, filters])

  // Función helper para obtener estado de stock
  const getStockStatus = (current: number, min: number) => {
    if (current === 0) return 'out_of_stock'
    if (current <= min) return 'low_stock'
    return 'in_stock'
  }

  // Contar filtros activos
  useEffect(() => {
    let count = 0
    if (filters.search) count++
    if (filters.categories.length > 0) count++
    if (filters.suppliers.length > 0) count++
    if (filters.stockStatus.length > 0) count++
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < filterOptions.maxPrice) count++
    if (filters.marginRange[0] > 0 || filters.marginRange[1] < 100) count++
    if (filters.stockRange[0] > 0 || filters.stockRange[1] < filterOptions.maxStock) count++
    if (filters.dateRange.from || filters.dateRange.to) count++
    if (!filters.showOutOfStock || !filters.showLowStock || filters.showDiscontinued) count++

    setActiveFiltersCount(count)
  }, [filters, filterOptions])

  // Aplicar filtros cuando cambien
  useEffect(() => {
    onFiltersChange(filteredProducts)
  }, [filteredProducts, onFiltersChange])

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleArrayFilterToggle = (key: 'categories' | 'suppliers' | 'stockStatus', value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(item => item !== value)
        : [...prev[key], value]
    }))
  }

  const clearAllFilters = () => {
    setFilters(defaultFilters)
  }

  const clearFilter = (filterType: string, value?: string) => {
    switch (filterType) {
      case 'search':
        handleFilterChange('search', '')
        break
      case 'categories':
        if (value) {
          handleArrayFilterToggle('categories', value)
        } else {
          handleFilterChange('categories', [])
        }
        break
      case 'suppliers':
        if (value) {
          handleArrayFilterToggle('suppliers', value)
        } else {
          handleFilterChange('suppliers', [])
        }
        break
      case 'stockStatus':
        if (value) {
          handleArrayFilterToggle('stockStatus', value)
        } else {
          handleFilterChange('stockStatus', [])
        }
        break
      case 'priceRange':
        handleFilterChange('priceRange', [0, filterOptions.maxPrice])
        break
      case 'marginRange':
        handleFilterChange('marginRange', [0, 100])
        break
      case 'stockRange':
        handleFilterChange('stockRange', [0, filterOptions.maxStock])
        break
      case 'dateRange':
        handleFilterChange('dateRange', { from: '', to: '' })
        break
    }
  }

  return (
    <div className="space-y-4">
      {/* Botón principal de filtros */}
      <div className="flex items-center justify-between">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              Filtros Avanzados
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 p-0" align="start">
            <Card className="border-0 shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Filtros Avanzados</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      disabled={activeFiltersCount === 0}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Limpiar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 max-h-96 overflow-y-auto">
                {/* Búsqueda */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Búsqueda
                  </Label>
                  <Input
                    placeholder="Buscar por nombre, SKU, descripción..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                  />
                </div>

                <Separator />

                {/* Categorías */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Categorías
                        {filters.categories.length > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {filters.categories.length}
                          </Badge>
                        )}
                      </Label>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
                    {filterOptions.categories.map((category) => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${category}`}
                          checked={filters.categories.includes(category)}
                          onCheckedChange={() => handleArrayFilterToggle('categories', category)}
                        />
                        <Label htmlFor={`category-${category}`} className="text-sm">
                          {category}
                        </Label>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Proveedores */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Proveedores
                        {filters.suppliers.length > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {filters.suppliers.length}
                          </Badge>
                        )}
                      </Label>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
                    {filterOptions.suppliers.map((supplier) => (
                      <div key={supplier} className="flex items-center space-x-2">
                        <Checkbox
                          id={`supplier-${supplier}`}
                          checked={filters.suppliers.includes(supplier)}
                          onCheckedChange={() => handleArrayFilterToggle('suppliers', supplier)}
                        />
                        <Label htmlFor={`supplier-${supplier}`} className="text-sm">
                          {supplier}
                        </Label>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Estado de Stock */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Estado de Stock
                  </Label>
                  <div className="space-y-2">
                    {[
                      { value: 'in_stock', label: 'En Stock', color: 'bg-green-500' },
                      { value: 'low_stock', label: 'Stock Bajo', color: 'bg-yellow-500' },
                      { value: 'out_of_stock', label: 'Sin Stock', color: 'bg-red-500' }
                    ].map((status) => (
                      <div key={status.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${status.value}`}
                          checked={filters.stockStatus.includes(status.value)}
                          onCheckedChange={() => handleArrayFilterToggle('stockStatus', status.value)}
                        />
                        <div className={`w-3 h-3 rounded-full ${status.color}`} />
                        <Label htmlFor={`status-${status.value}`} className="text-sm">
                          {status.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Rango de Precios */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <GSIcon className="h-4 w-4" />
                    Rango de Precios
                  </Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <span>€{filters.priceRange[0]}</span>
                      <span>-</span>
                      <span>€{filters.priceRange[1]}</span>
                    </div>
                    <Slider
                      value={filters.priceRange}
                      onValueChange={(value) => handleFilterChange('priceRange', value)}
                      max={filterOptions.maxPrice}
                      step={10}
                      className="w-full"
                    />
                  </div>
                </div>

                <Separator />

                {/* Rango de Stock */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Rango de Stock
                  </Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <span>{filters.stockRange[0]}</span>
                      <span>-</span>
                      <span>{filters.stockRange[1]} unidades</span>
                    </div>
                    <Slider
                      value={filters.stockRange}
                      onValueChange={(value) => handleFilterChange('stockRange', value)}
                      max={filterOptions.maxStock}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>

                <Separator />

                {/* Ordenamiento */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Sliders className="h-4 w-4" />
                    Ordenar por
                  </Label>
                  <div className="flex space-x-2">
                    <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Nombre</SelectItem>
                        <SelectItem value="price">Precio</SelectItem>
                        <SelectItem value="stock">Stock</SelectItem>
                        <SelectItem value="margin">Margen</SelectItem>
                        <SelectItem value="created">Fecha creación</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filters.sortOrder} onValueChange={(value: 'asc' | 'desc') => handleFilterChange('sortOrder', value)}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">↑ Asc</SelectItem>
                        <SelectItem value="desc">↓ Desc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Opciones adicionales */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Opciones de visualización</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-out-of-stock" className="text-sm">
                        Mostrar productos sin stock
                      </Label>
                      <Switch
                        id="show-out-of-stock"
                        checked={filters.showOutOfStock}
                        onCheckedChange={(checked) => handleFilterChange('showOutOfStock', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-low-stock" className="text-sm">
                        Mostrar productos con stock bajo
                      </Label>
                      <Switch
                        id="show-low-stock"
                        checked={filters.showLowStock}
                        onCheckedChange={(checked) => handleFilterChange('showLowStock', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-discontinued" className="text-sm">
                        Mostrar productos descontinuados
                      </Label>
                      <Switch
                        id="show-discontinued"
                        checked={filters.showDiscontinued}
                        onCheckedChange={(checked) => handleFilterChange('showDiscontinued', checked)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PopoverContent>
        </Popover>

        {/* Mostrar resultados */}
        <div className="text-sm text-muted-foreground">
          {filteredProducts.length} de {products?.length || 0} productos
        </div>
      </div>

      {/* Filtros activos */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Búsqueda: "{filters.search}"
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => clearFilter('search')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          
          {filters.categories.map((category) => (
            <Badge key={category} variant="secondary" className="flex items-center gap-1">
              Categoría: {category}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => clearFilter('categories', category)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          
          {filters.suppliers.map((supplier) => (
            <Badge key={supplier} variant="secondary" className="flex items-center gap-1">
              Proveedor: {supplier}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => clearFilter('suppliers', supplier)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          
          {filters.stockStatus.map((status) => (
            <Badge key={status} variant="secondary" className="flex items-center gap-1">
              Estado: {status === 'in_stock' ? 'En Stock' : status === 'low_stock' ? 'Stock Bajo' : 'Sin Stock'}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => clearFilter('stockStatus', status)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
})

ProductFilters.displayName = 'ProductFilters'

export { ProductFilters }
