'use client'

import { useState, memo } from 'react'
import { motion, AnimatePresence  } from '../ui/motion'
import { 
  Search, 
  Filter, 
  X, 
  Grid, 
  List,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { Separator } from '@/components/ui/separator'

interface FilterOption {
  value: string
  label: string
  count?: number
}

interface ModernFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedCategory: string
  onCategoryChange: (category: string) => void
  selectedStatus: string
  onStatusChange: (status: string) => void
  viewMode: "grid" | "table"
  onViewModeChange: (mode: "grid" | "table") => void
  categories: FilterOption[]
  statusOptions: FilterOption[]
  onClearFilters: () => void
  resultsCount: number
  totalCount: number
}

export const ModernFilters = memo(({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedStatus,
  onStatusChange,
  viewMode,
  onViewModeChange,
  categories,
  statusOptions,
  onClearFilters,
  resultsCount,
  totalCount
}: ModernFiltersProps) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [priceRange, setPriceRange] = useState({ min: "", max: "" })

  const activeFiltersCount = [
    selectedCategory,
    selectedStatus,
    priceRange.min,
    priceRange.max
  ].filter(Boolean).length

  const hasActiveFilters = searchQuery || activeFiltersCount > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Barra de búsqueda principal */}
      <Card className="border-0 shadow-sm bg-white">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            {/* Campo de búsqueda */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 border-0 bg-gray-50 focus:bg-white transition-all duration-200 text-sm sm:text-base h-10 sm:h-12"
              />
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-4 w-4 text-gray-400" />
                </motion.button>
              )}
            </div>
            
            {/* Filtros rápidos */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <Select value={selectedCategory} onValueChange={onCategoryChange}>
                  <SelectTrigger className="w-full sm:w-48 border-0 bg-gray-50 h-10 sm:h-12 text-sm">
                    <SelectValue placeholder="Categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        <div className="flex items-center justify-between w-full">
                          <span>{category.label}</span>
                          {category.count && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {category.count}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={onStatusChange}>
                  <SelectTrigger className="w-full sm:w-40 border-0 bg-gray-50 h-10 sm:h-12 text-sm">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center justify-between w-full">
                          <span>{status.label}</span>
                          {status.count && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {status.count}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtros avanzados - Solo en desktop */}
                <div className="hidden sm:block">
                  <Popover open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="border-0 bg-gray-50 h-12 relative"
                      >
                        <SlidersHorizontal className="h-4 w-4 mr-2" />
                        Filtros
                        {activeFiltersCount > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                          >
                            {activeFiltersCount}
                          </Badge>
                        )}
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="end">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="p-4 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-900">Filtros Avanzados</h4>
                          {activeFiltersCount > 0 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={onClearFilters}
                              className="text-red-600 hover:text-red-700"
                            >
                              Limpiar todo
                            </Button>
                          )}
                        </div>
                        
                        <Separator />
                        
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">
                              Rango de Precios
                            </label>
                            <div className="flex gap-2">
                              <Input
                                placeholder="Mín"
                                value={priceRange.min}
                                onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                                type="number"
                                className="flex-1"
                              />
                              <Input
                                placeholder="Máx"
                                value={priceRange.max}
                                onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                                type="number"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Selector de vista */}
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-gray-600 sm:hidden">
                  {resultsCount} productos
                </span>
                <div className="flex border border-gray-200 rounded-lg bg-gray-50 h-10 sm:h-12 relative overflow-hidden">
                  <motion.div
                    className="absolute inset-y-1 bg-white rounded-md shadow-sm"
                    initial={false}
                    animate={{
                      x: viewMode === "grid" ? 4 : "calc(50% - 4px)",
                      width: "calc(50% - 8px)"
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewModeChange("grid")}
                    className="rounded-r-none h-full px-2 sm:px-3 relative z-10 transition-colors"
                  >
                    <Grid className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewModeChange("table")}
                    className="rounded-l-none h-full px-2 sm:px-3 relative z-10 transition-colors"
                  >
                    <List className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros activos y resultados */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <p className="text-sm sm:text-base text-gray-600 hidden sm:block">
            Mostrando <span className="font-semibold">{resultsCount}</span> de{" "}
            <span className="font-semibold">{totalCount}</span> productos
          </p>
          
          {/* Filtros activos */}
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <span className="text-xs sm:text-sm text-gray-500 hidden sm:inline">Filtros activos:</span>
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  {searchQuery && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <span className="hidden sm:inline">Búsqueda: </span>"{searchQuery}"
                      <button
                        onClick={() => onSearchChange("")}
                        className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {selectedCategory && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <span className="hidden sm:inline">Categoría: </span>{categories.find(c => c.value === selectedCategory)?.label}
                      <button
                        onClick={() => onCategoryChange("")}
                        className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {selectedStatus && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <span className="hidden sm:inline">Estado: </span>{statusOptions.find(s => s.value === selectedStatus)?.label}
                      <button
                        onClick={() => onStatusChange("")}
                        className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-gray-500 hover:text-gray-700 text-xs sm:text-sm self-start sm:self-auto"
          >
            Limpiar filtros
          </Button>
        )}
      </div>
    </motion.div>
  )
})