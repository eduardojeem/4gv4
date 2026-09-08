'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { formatCurrency } from '@/lib/currency'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown, 
  ChevronUp,
  Save,
  Bookmark,
  History,
  SlidersHorizontal,
  Tag,
  Calendar,
  Package,
  Building,
  Users,
  Star,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Download,
  Share2
} from 'lucide-react'

// Interfaces
interface SearchFilter {
  id: string
  name: string
  type: 'text' | 'select' | 'range' | 'date' | 'checkbox' | 'multiselect'
  value: any
  options?: { label: string; value: string }[]
  min?: number
  max?: number
  step?: number
  placeholder?: string
}

interface SavedSearch {
  id: string
  name: string
  filters: SearchFilter[]
  createdAt: Date
  isDefault?: boolean
  category: string
}

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilter[]) => void
  onClearFilters: () => void
  isLoading?: boolean
  categoryOptions?: { label: string; value: string }[]
  supplierOptions?: { label: string; value: string }[]
  /** Techos reales del catalogo. Sin ellos los rangos inventan uno. */
  priceCeiling?: number
  stockCeiling?: number
}

const SAVED_SEARCHES_KEY = 'mipos:inventory:saved-searches'

/**
 * Se guardan en el navegador de quien las creo. No es sincronizacion entre
 * usuarios, pero es la diferencia entre que sobrevivan a cambiar de pestaña y
 * que no.
 */
function readSavedSearches(): SavedSearch[] {
  try {
    const raw = window.localStorage.getItem(SAVED_SEARCHES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => ({ ...item, createdAt: new Date(item.createdAt) }))
  } catch {
    return []
  }
}

function writeSavedSearches(searches: SavedSearch[]) {
  try {
    window.localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(searches))
  } catch {
    // Ventana privada o almacenamiento bloqueado: se pierden al recargar, que
    // es exactamente como estaba antes. No hay nada que avisar.
  }
}

/** El rango de precio se lee en guaranies; el de stock, en unidades. */
function formatRangeBound(filter: SearchFilter, value: number | undefined) {
  const numero = Number(value ?? 0)
  return filter.id === 'priceRange' ? formatCurrency(numero) : numero.toLocaleString('es-PY')
}

const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearch,
  onClearFilters,
  isLoading = false,
  categoryOptions = [],
  supplierOptions = [],
  priceCeiling,
  stockCeiling
}) => {
  // Estados
  const [filters, setFilters] = useState<SearchFilter[]>([])
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState('')
  const [saveSearchCategory, setSaveSearchCategory] = useState('')
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [quickFilters, setQuickFilters] = useState<string[]>([])

  // Sin listas de respaldo. Cuando no llegaban categorias o proveedores —porque
  // la empresa no cargo ninguno, o porque la peticion fallo en silencio— este
  // componente ofrecia «Apple Inc.», «Samsung», «Smartphones». Elegir uno
  // filtraba por un identificador que no existe: cero resultados sin
  // explicacion, y el usuario concluia que no tenia stock de Samsung.
  const effectiveCategoryOptions = categoryOptions
  const effectiveSupplierOptions = supplierOptions

  // El tope sale del producto mas caro del catalogo, redondeado hacia arriba.
  // Estaba fijo en 5.000, heredado de un catalogo en dolares: en guaranies
  // cualquier producto real queda por encima y el filtro no filtra nada.
  const priceMax = useMemo(() => {
    const techo = Number(priceCeiling) || 0
    if (techo <= 0) return 10_000_000
    const escala = Math.pow(10, Math.max(0, String(Math.round(techo)).length - 2))
    return Math.ceil(techo / escala) * escala
  }, [priceCeiling])
  const priceStep = useMemo(() => Math.max(1, Math.round(priceMax / 200)), [priceMax])
  const stockMax = useMemo(() => Math.max(10, Number(stockCeiling) || 0), [stockCeiling])

  // Filtros disponibles
  const availableFilters: SearchFilter[] = useMemo(() => [
    {
      id: 'search',
      name: 'Búsqueda General',
      type: 'text',
      value: '',
      placeholder: 'Nombre, SKU, descripción...'
    },
    {
      id: 'category',
      name: 'Categoría',
      type: 'multiselect',
      value: [],
      options: effectiveCategoryOptions
    },
    {
      id: 'supplier',
      name: 'Proveedor',
      type: 'multiselect',
      value: [],
      options: effectiveSupplierOptions
    },
    {
      id: 'priceRange',
      name: 'Rango de precio',
      type: 'range',
      value: [0, priceMax],
      min: 0,
      max: priceMax,
      step: priceStep
    },
    {
      id: 'stockRange',
      name: 'Rango de stock',
      type: 'range',
      value: [0, stockMax],
      min: 0,
      max: stockMax,
      step: 1
    },
    {
      id: 'status',
      name: 'Estado',
      type: 'multiselect',
      value: [],
      options: [
        { label: 'Activo', value: 'active' },
        { label: 'Inactivo', value: 'inactive' },
        { label: 'Descontinuado', value: 'discontinued' },
        { label: 'Agotado', value: 'out_of_stock' },
        { label: 'Stock Bajo', value: 'low_stock' }
      ]
    },
    {
      id: 'dateAdded',
      name: 'Fecha de Agregado',
      type: 'date',
      value: ''
    },
    {
      id: 'lastMovement',
      name: 'Último Movimiento',
      type: 'date',
      value: ''
    },
    {
      id: 'hasImage',
      name: 'Tiene Imagen',
      type: 'checkbox',
      value: false
    }
  ], [effectiveCategoryOptions, effectiveSupplierOptions, priceMax, priceStep, stockMax])

  // Efectos
  useEffect(() => {
    setFilters(prev => {
      if (prev.length === 0) return availableFilters.map(f => ({ ...f }))

      return availableFilters.map(filter => {
        const current = prev.find(f => f.id === filter.id)
        return current ? { ...filter, value: current.value } : { ...filter }
      })
    })
  }, [availableFilters])

  // Las busquedas guardadas vivian solo en estado de React: Radix desmonta el
  // contenido de la pestaña inactiva, asi que se perdian al cambiar de pestaña.
  useEffect(() => {
    setSavedSearches(readSavedSearches())
  }, [])

  // Funciones
  const updateFilter = (filterId: string, value: any) => {
    setFilters(prev => prev.map(filter => 
      filter.id === filterId ? { ...filter, value } : filter
    ))
  }

  const getActiveFilters = () => {
    return filters.filter(filter => {
      switch (filter.type) {
        case 'text':
          return filter.value && filter.value.trim() !== ''
        case 'select':
          return filter.value && filter.value !== ''
        case 'multiselect':
          return Array.isArray(filter.value) && filter.value.length > 0
        case 'range':
          return Array.isArray(filter.value) && (filter.value[0] !== filter.min || filter.value[1] !== filter.max)
        case 'date':
          return filter.value && filter.value !== ''
        case 'checkbox':
          return filter.value === true
        default:
          return false
      }
    })
  }

  const handleSearch = () => {
    const activeFilters = getActiveFilters()
    onSearch(activeFilters)
    
    // Agregar a historial
    const searchTerm = filters.find(f => f.id === 'search')?.value
    if (searchTerm && searchTerm.trim() !== '') {
      setSearchHistory(prev => {
        const newHistory = [searchTerm, ...prev.filter(term => term !== searchTerm)]
        return newHistory.slice(0, 10) // Mantener solo los últimos 10
      })
    }
  }

  const handleClearFilters = () => {
    setFilters(availableFilters.map(f => ({ ...f })))
    onClearFilters()
  }

  const handleSaveSearch = () => {
    if (!saveSearchName.trim()) return

    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: saveSearchName,
      filters: getActiveFilters(),
      createdAt: new Date(),
      category: saveSearchCategory || 'Personalizado'
    }

    setSavedSearches(prev => {
      const next = [newSearch, ...prev]
      writeSavedSearches(next)
      return next
    })
    setSaveSearchName('')
    setSaveSearchCategory('')
    setIsSaveDialogOpen(false)
  }

  const loadSavedSearch = (savedSearch: SavedSearch) => {
    const newFilters = availableFilters.map(f => {
      const savedFilter = savedSearch.filters.find(sf => sf.id === f.id)
      return savedFilter ? { ...f, value: savedFilter.value } : f
    })
    setFilters(newFilters)
    onSearch(savedSearch.filters)
  }

  const deleteSavedSearch = (searchId: string) => {
    setSavedSearches(prev => {
      const next = prev.filter(s => s.id !== searchId)
      writeSavedSearches(next)
      return next
    })
  }

  const getFilterValueDisplay = (filter: SearchFilter) => {
    switch (filter.type) {
      case 'text':
        return filter.value || 'Sin valor'
      case 'select':
        const option = filter.options?.find(o => o.value === filter.value)
        return option?.label || 'Sin selección'
      case 'multiselect':
        if (!Array.isArray(filter.value) || filter.value.length === 0) return 'Sin selección'
        const selectedOptions = filter.options?.filter(o => filter.value.includes(o.value))
        return selectedOptions?.map(o => o.label).join(', ') || 'Sin selección'
      case 'range':
        return Array.isArray(filter.value) ? `${filter.value[0]} - ${filter.value[1]}` : 'Sin rango'
      case 'date':
        return filter.value || 'Sin fecha'
      case 'checkbox':
        return filter.value ? 'Sí' : 'No'
      default:
        return 'Sin valor'
    }
  }

  const renderFilterInput = (filter: SearchFilter) => {
    switch (filter.type) {
      case 'text':
        return (
          <Input
            placeholder={filter.placeholder}
            value={filter.value}
            onChange={(e) => updateFilter(filter.id, e.target.value)}
            className="w-full"
          />
        )

      case 'select':
        return (
          <Select value={filter.value} onValueChange={(value) => updateFilter(filter.id, value)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {filter.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'multiselect':
        return (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {filter.options?.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${filter.id}-${option.value}`}
                  checked={Array.isArray(filter.value) && filter.value.includes(option.value)}
                  onCheckedChange={(checked) => {
                    const currentValue = Array.isArray(filter.value) ? filter.value : []
                    if (checked) {
                      updateFilter(filter.id, [...currentValue, option.value])
                    } else {
                      updateFilter(filter.id, currentValue.filter(v => v !== option.value))
                    }
                  }}
                />
                <Label htmlFor={`${filter.id}-${option.value}`} className="text-sm">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        )

      case 'range':
        return (
          <div className="space-y-4">
            <Slider
              value={Array.isArray(filter.value) ? filter.value : [filter.min || 0, filter.max || 100]}
              onValueChange={(value) => updateFilter(filter.id, value)}
              min={filter.min || 0}
              max={filter.max || 100}
              step={filter.step || 1}
              className="w-full"
            />
            <div className="flex justify-between text-sm tabular-nums text-gray-600 dark:text-gray-400">
              <span>{formatRangeBound(filter, Array.isArray(filter.value) ? filter.value[0] : filter.min)}</span>
              <span>{formatRangeBound(filter, Array.isArray(filter.value) ? filter.value[1] : filter.max)}</span>
            </div>
          </div>
        )

      case 'date':
        return (
          <Input
            type="date"
            value={filter.value}
            onChange={(e) => updateFilter(filter.id, e.target.value)}
            className="w-full"
          />
        )

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={filter.id}
              checked={filter.value}
              onCheckedChange={(checked) => updateFilter(filter.id, checked)}
            />
            <Label htmlFor={filter.id}>Sí</Label>
          </div>
        )

      default:
        return null
    }
  }

  const activeFilters = getActiveFilters()

  return (
    <div className="space-y-6">
      {/* Barra de búsqueda principal */}
      <Card>
        <CardContent className="p-6">
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar productos por nombre, SKU, descripción..."
                value={filters.find(f => f.id === 'search')?.value || ''}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="pl-10"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filtros Avanzados
              {isFiltersOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
            </Button>
          </div>

          {/* Filtros activos */}
          {activeFilters.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-600">Filtros activos:</span>
              {activeFilters.map(filter => (
                <Badge key={filter.id} variant="secondary" className="flex items-center space-x-1">
                  <span>{filter.name}: {getFilterValueDisplay(filter)}</span>
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => updateFilter(filter.id, filter.type === 'multiselect' ? [] : filter.type === 'checkbox' ? false : '')}
                  />
                </Badge>
              ))}
              <Button size="sm" variant="ghost" onClick={handleClearFilters}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Limpiar todo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel de filtros avanzados */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <CollapsibleContent>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filtros */}
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Filter className="h-5 w-5 mr-2" />
                    Filtros Avanzados
                  </CardTitle>
                  <CardDescription>
                    Refina tu búsqueda con filtros específicos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filters.slice(1).map(filter => ( // Excluir el filtro de búsqueda general
                      <div key={filter.id} className="space-y-2">
                        <Label className="text-sm font-medium">{filter.name}</Label>
                        {renderFilterInput(filter)}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-6">
                    <div className="flex space-x-2">
                      <Button onClick={handleSearch} disabled={isLoading}>
                        <Search className="h-4 w-4 mr-2" />
                        Aplicar Filtros
                      </Button>
                      <Button variant="outline" onClick={handleClearFilters}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Limpiar
                      </Button>
                    </div>
                    <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" disabled={activeFilters.length === 0}>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar Búsqueda
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Guardar Búsqueda</DialogTitle>
                          <DialogDescription>
                            Guarda esta configuración de filtros para uso futuro
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Nombre de la búsqueda</Label>
                            <Input
                              placeholder="Ej: Productos con stock bajo"
                              value={saveSearchName}
                              onChange={(e) => setSaveSearchName(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Categoría</Label>
                            <Select value={saveSearchCategory} onValueChange={setSaveSearchCategory}>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar categoría" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Productos">Productos</SelectItem>
                                <SelectItem value="Alertas">Alertas</SelectItem>
                                <SelectItem value="Análisis">Análisis</SelectItem>
                                <SelectItem value="Personalizado">Personalizado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleSaveSearch} disabled={!saveSearchName.trim()}>
                            Guardar
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Búsquedas guardadas e historial */}
            <div className="space-y-6">
              {/* Búsquedas guardadas */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-sm">
                    <Bookmark className="h-4 w-4 mr-2" />
                    Búsquedas Guardadas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    {savedSearches.map(search => (
                      <div key={search.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => loadSavedSearch(search)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                              {search.name}
                            </button>
                            {search.isDefault && (
                              <Star className="h-3 w-3 text-yellow-500" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{search.category}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteSavedSearch(search.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Historial de búsquedas */}
              {searchHistory.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-sm">
                      <History className="h-4 w-4 mr-2" />
                      Historial
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-1">
                      {searchHistory.map((term, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            updateFilter('search', term)
                            handleSearch()
                          }}
                          className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 p-1 hover:bg-gray-50 rounded"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Los resultados se ven en «Catálogo»: este panel existia pero nunca se
          renderizaba —`results` siempre llegaba vacio—, asi que buscar te
          teletransportaba a otra pestaña sin decir nada. */}
      <p className="text-xs text-muted-foreground">
        Los filtros se aplican al catálogo: al buscar te llevamos a la pestaña
        <span className="font-medium text-foreground"> Catálogo</span> con los resultados.
      </p>
    </div>
  )
}

export default AdvancedSearch
