/**
 * Custom hook for managing products dashboard state and operations
 */

import { useState, useMemo, useCallback } from 'react'
import { useHydrated } from '@/hooks/use-hydrated'
import { Product, ProductAlert, Category, Supplier } from '@/types/product-unified'
import { DashboardFilters, DashboardMetrics, SortConfig, ViewMode } from '@/types/products-dashboard'
import {
  searchProducts,
  applyFilters,
  calculateMetrics,
  sortProducts,
  debounce
} from '@/lib/products-dashboard-utils'

interface UseProductsDashboardProps {
  products: Product[]
  categories: Category[]
  suppliers: Supplier[]
  alerts: ProductAlert[]
  serverPaginated?: boolean
  serverTotalItems?: number
  /** Con qué filtro abre la pantalla. Sin esto, abría con todo mezclado. */
  initialFilters?: DashboardFilters
}

interface UseProductsDashboardReturn {
  // Filtered and processed data
  displayedProducts: Product[] // All filtered products (for export, metrics)
  paginatedProducts: Product[] // Current page products
  metrics: DashboardMetrics
  
  // UI State
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  currentPage: number
  setCurrentPage: (page: number) => void
  itemsPerPage: number
  setItemsPerPage: (items: number) => void
  totalPages: number
  totalItems: number
  searchQuery: string
  setSearchQuery: (query: string) => void
  filters: DashboardFilters
  setFilters: (filters: DashboardFilters) => void
  sortConfig: SortConfig
  setSortConfig: (config: SortConfig) => void
  selectedProductIds: string[]
  setSelectedProductIds: (ids: string[]) => void
  isFilterPanelOpen: boolean
  setIsFilterPanelOpen: (open: boolean) => void
  
  // Actions
  handleSearch: (query: string) => void
  handleFilterChange: (newFilters: Partial<DashboardFilters>) => void
  handleQuickFilter: (filter: 'all' | 'low_stock' | 'out_of_stock' | 'active' | 'inactive' | 'products' | 'services' | 'variants') => void
  handleSort: (field: SortConfig['field']) => void
  handleSelectProduct: (id: string) => void
  handleSelectAll: (selected: boolean) => void
  clearFilters: () => void
  clearSelection: () => void
}

export function useProductsDashboard({
  products,
  categories,
  suppliers,
  alerts,
  serverPaginated = false,
  serverTotalItems = 0,
  initialFilters,
}: UseProductsDashboardProps): UseProductsDashboardReturn {
  // UI State
  const hydrated = useHydrated()
  const [preferredViewMode, setViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table')
  const viewMode = hydrated ? preferredViewMode : 'table'
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters ?? {})
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'name',
    direction: 'asc'
  })
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)

  // Debounced search handler
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      setDebouncedSearchQuery(query)
    }, 300),
    []
  )

  // Handle search input
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    debouncedSearch(query)
  }, [debouncedSearch])

  // In server mode the server already resolves search/filter/sort/pagination, so
  // re-processing on the client (which only sees the current page) is skipped.
  // Apply search
  const searchedProducts = useMemo(() => {
    if (serverPaginated) return products
    return searchProducts(products, debouncedSearchQuery)
  }, [products, debouncedSearchQuery, serverPaginated])

  // Apply filters
  const filteredProducts = useMemo(() => {
    if (serverPaginated) return searchedProducts
    return applyFilters(searchedProducts, filters)
  }, [searchedProducts, filters, serverPaginated])

  // Apply sorting
  const displayedProducts = useMemo(() => {
    if (serverPaginated) return filteredProducts
    return sortProducts(filteredProducts, sortConfig)
  }, [filteredProducts, sortConfig, serverPaginated])

  // Reset before children render, rather than briefly showing the old page.
  const [pageCriteria, setPageCriteria] = useState({ filters, searchQuery, sortConfig, debouncedSearchQuery, itemsPerPage })
  if (pageCriteria.filters !== filters || pageCriteria.searchQuery !== searchQuery ||
      pageCriteria.sortConfig !== sortConfig || pageCriteria.debouncedSearchQuery !== debouncedSearchQuery ||
      pageCriteria.itemsPerPage !== itemsPerPage) {
    setPageCriteria({ filters, searchQuery, sortConfig, debouncedSearchQuery, itemsPerPage })
    setCurrentPage(1)
  }

  // Apply pagination
  const paginatedProducts = useMemo(() => {
    if (serverPaginated) return displayedProducts
    const startIndex = (currentPage - 1) * itemsPerPage
    return displayedProducts.slice(startIndex, startIndex + itemsPerPage)
  }, [displayedProducts, currentPage, itemsPerPage, serverPaginated])

  const totalPages = serverPaginated
    ? Math.max(1, Math.ceil((serverTotalItems || 0) / Math.max(1, itemsPerPage)))
    : Math.max(1, Math.ceil(displayedProducts.length / Math.max(1, itemsPerPage)))

  // Calculate metrics from filtered products to keep numbers aligned with current view
  const metrics = useMemo(() => {
    return calculateMetrics(displayedProducts)
  }, [displayedProducts])

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  /**
   * Los filtros rapidos no borran el alcance de la seccion.
   *
   * Antes cada filtro reemplazaba todo el estado: la pantalla abria en «solo
   * productos» y al tocar «bajo stock» volvian a aparecer los servicios y los
   * productos desactivados, sin que nada lo dijera. Ahora el tipo y el estado
   * son dos ejes propios, y el filtro rapido solo cambia el suyo.
   *
   * «Todos» es la unica salida al catalogo completo: ahi si se limpia todo.
   */
  const handleQuickFilter = useCallback((filter: 'all' | 'low_stock' | 'out_of_stock' | 'active' | 'inactive' | 'products' | 'services' | 'variants') => {
    const base = initialFilters ?? {}

    setFilters(prev => {
      // «Todos» es la unica salida al catalogo completo.
      if (filter === 'all') return {}

      // Un eje apagado a mano queda apagado: `prev` manda aunque valga
      // undefined, y el alcance de la seccion solo se usa si nadie lo toco.
      const actual = <K extends keyof DashboardFilters>(clave: K) =>
        (clave in prev ? prev[clave] : base[clave])

      if (filter === 'products' || filter === 'services') {
        const tipo = filter === 'products' ? ('part' as const) : ('service' as const)
        // Volver a tocar el tipo puesto lo saca, y quedan los dos.
        return { ...base, ...prev, quick_filter: null, catalog_kind: actual('catalog_kind') === tipo ? undefined : tipo }
      }

      if (filter === 'active' || filter === 'inactive') {
        const quiere = filter === 'active'
        return { ...base, ...prev, quick_filter: null, is_active: actual('is_active') === quiere ? undefined : quiere }
      }

      // Bajo stock, agotados y variantes: se apagan al volver a tocarlos y no
      // tocan el tipo ni el estado.
      return { ...base, ...prev, quick_filter: prev.quick_filter === filter ? null : filter }
    })
  }, [initialFilters])

  // Handle sorting
  const handleSort = useCallback((field: SortConfig['field']) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }, [])

  // Handle product selection
  const handleSelectProduct = useCallback((id: string) => {
    setSelectedProductIds(prev =>
      prev.includes(id)
        ? prev.filter(productId => productId !== id)
        : [...prev, id]
    )
  }, [])

  // Handle select all
  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedProductIds(displayedProducts.map(p => p.id))
    } else {
      setSelectedProductIds([])
    }
  }, [displayedProducts])

  // Clear filters
  const clearFilters = useCallback(() => {
    // Vuelve al filtro con el que abre la pantalla: si el listado arranca en
    // «solo productos», limpiar no tiene por qué mezclar los servicios.
    setFilters(initialFilters ?? {})
    setSearchQuery('')
    setDebouncedSearchQuery('')
  }, [initialFilters])

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedProductIds([])
  }, [])

  return {
    // Data
    displayedProducts,
    paginatedProducts,
    metrics,
    
    // UI State
    viewMode,
    setViewMode,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    totalItems: serverPaginated ? serverTotalItems : displayedProducts.length,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    sortConfig,
    setSortConfig,
    selectedProductIds,
    setSelectedProductIds,
    isFilterPanelOpen,
    setIsFilterPanelOpen,
    
    // Actions
    handleSearch,
    handleFilterChange,
    handleQuickFilter,
    handleSort,
    handleSelectProduct,
    handleSelectAll,
    clearFilters,
    clearSelection
  }
}
