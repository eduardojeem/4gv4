/**
 * Custom hook for managing products dashboard state and operations
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
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
  handleQuickFilter: (filter: 'all' | 'low_stock' | 'out_of_stock' | 'active') => void
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
  alerts
}: UseProductsDashboardProps): UseProductsDashboardReturn {
  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(100) // Aumentado a 100 para mejor visibilidad inicial
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [filters, setFilters] = useState<DashboardFilters>({})
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

  // Apply search
  const searchedProducts = useMemo(() => {
    return searchProducts(products, debouncedSearchQuery)
  }, [products, debouncedSearchQuery])

  // Apply filters
  const filteredProducts = useMemo(() => {
    return applyFilters(searchedProducts, filters)
  }, [searchedProducts, filters])

  // Apply sorting
  const displayedProducts = useMemo(() => {
    return sortProducts(filteredProducts, sortConfig)
  }, [filteredProducts, sortConfig])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters, searchQuery, sortConfig])

  // Apply pagination
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return displayedProducts.slice(startIndex, startIndex + itemsPerPage)
  }, [displayedProducts, currentPage, itemsPerPage])

  const totalPages = Math.ceil(displayedProducts.length / itemsPerPage)

  // Calculate metrics from all products
  const metrics = useMemo(() => {
    return calculateMetrics(products)
  }, [products])

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<DashboardFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  // Handle quick filters
  const handleQuickFilter = useCallback((filter: 'all' | 'low_stock' | 'out_of_stock' | 'active') => {
    // Clear custom filters when applying quick filter
    setFilters({
      quick_filter: filter
    })
  }, [])

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
    setFilters({})
    setSearchQuery('')
    setDebouncedSearchQuery('')
  }, [])

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
    totalItems: displayedProducts.length,
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
