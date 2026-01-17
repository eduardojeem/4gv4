/**
 * Hook para gestionar todos los filtros y búsqueda del POS
 * Centraliza el estado de filtros para reducir complejidad en el componente principal
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { Product } from '@/types/product-unified'

export interface POSFiltersState {
  // Búsqueda
  searchTerm: string
  debouncedSearchTerm: string
  
  // Filtros
  selectedCategory: string
  showFeatured: boolean
  stockFilter: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  priceRange: { min: number; max: number }
  
  // Ordenamiento
  sortBy: 'name' | 'price' | 'stock' | 'category'
  sortOrder: 'asc' | 'desc'
  
  // Vista
  viewMode: 'grid' | 'list'
  showAdvancedFilters: boolean
  
  // Paginación
  currentPage: number
  itemsPerPage: number
}

export interface POSFiltersActions {
  setSearchTerm: (term: string) => void
  setSelectedCategory: (category: string) => void
  setShowFeatured: (show: boolean) => void
  setStockFilter: (filter: POSFiltersState['stockFilter']) => void
  setPriceRange: (range: { min: number; max: number }) => void
  setSortBy: (sort: POSFiltersState['sortBy']) => void
  setSortOrder: (order: POSFiltersState['sortOrder']) => void
  setViewMode: (mode: POSFiltersState['viewMode']) => void
  setShowAdvancedFilters: (show: boolean) => void
  setCurrentPage: (page: number) => void
  setItemsPerPage: (items: number) => void
  resetFilters: () => void
}

export interface POSFiltersResult {
  state: POSFiltersState
  actions: POSFiltersActions
  filteredProducts: Product[]
  paginatedProducts: Product[]
  totalPages: number
  categories: string[]
  priceRangeLimits: { min: number; max: number }
}

const DEFAULT_STATE: POSFiltersState = {
  searchTerm: '',
  debouncedSearchTerm: '',
  selectedCategory: 'all',
  showFeatured: false,
  stockFilter: 'all',
  priceRange: { min: 0, max: 1000000 },
  sortBy: 'name',
  sortOrder: 'asc',
  viewMode: 'grid',
  showAdvancedFilters: false,
  currentPage: 1,
  itemsPerPage: 24
}

export function usePOSFilters(products: Product[]): POSFiltersResult {
  // Estados
  const [searchTerm, setSearchTerm] = useState(DEFAULT_STATE.searchTerm)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(DEFAULT_STATE.debouncedSearchTerm)
  const [selectedCategory, setSelectedCategory] = useState(DEFAULT_STATE.selectedCategory)
  const [showFeatured, setShowFeatured] = useState(DEFAULT_STATE.showFeatured)
  const [stockFilter, setStockFilter] = useState(DEFAULT_STATE.stockFilter)
  const [priceRange, setPriceRange] = useState(DEFAULT_STATE.priceRange)
  const [sortBy, setSortBy] = useState(DEFAULT_STATE.sortBy)
  const [sortOrder, setSortOrder] = useState(DEFAULT_STATE.sortOrder)
  const [viewMode, setViewMode] = useState(DEFAULT_STATE.viewMode)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(DEFAULT_STATE.showAdvancedFilters)
  const [currentPage, setCurrentPage] = useState(DEFAULT_STATE.currentPage)
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_STATE.itemsPerPage)

  // Debouncing para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Resetear página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, selectedCategory, stockFilter, priceRange, showFeatured, sortOrder, sortBy])

  // Cargar preferencias guardadas
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedPrefs = localStorage.getItem('pos.filters')
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs)
        if (prefs.selectedCategory) setSelectedCategory(prefs.selectedCategory)
        if (typeof prefs.showFeatured === 'boolean') setShowFeatured(prefs.showFeatured)
        if (prefs.viewMode) setViewMode(prefs.viewMode)
        if (prefs.sortBy) setSortBy(prefs.sortBy)
        if (prefs.sortOrder) setSortOrder(prefs.sortOrder)
        if (prefs.priceRange) setPriceRange(prefs.priceRange)
        if (prefs.stockFilter) setStockFilter(prefs.stockFilter)
        if (prefs.itemsPerPage) setItemsPerPage(prefs.itemsPerPage)
      }
    } catch (e) {
      console.warn('Error loading filter preferences:', e)
    }
  }, [])

  // Guardar preferencias
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const prefs = {
        selectedCategory,
        showFeatured,
        viewMode,
        sortBy,
        sortOrder,
        priceRange,
        stockFilter,
        itemsPerPage
      }
      localStorage.setItem('pos.filters', JSON.stringify(prefs))
    } catch (e) {
      console.error('Error saving filter preferences:', e)
    }
  }, [selectedCategory, showFeatured, viewMode, sortBy, sortOrder, priceRange, stockFilter, itemsPerPage])

  // Categorías únicas
  const categories = useMemo(() => {
    const names = products
      .map(p => (typeof p.category === 'object' ? p.category?.name : p.category))
      .filter((name): name is string => !!name && typeof name === 'string')
    const uniqueNames = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
    return ['all', ...uniqueNames]
  }, [products])

  // Rango de precios dinámico
  const priceRangeLimits = useMemo(() => {
    if (products.length === 0) return { min: 0, max: 1000000 }
    const prices = products.map(p => p.sale_price)
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    }
  }, [products])

  // Productos filtrados
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const searchLower = debouncedSearchTerm.toLowerCase()
      const categoryName = (typeof product.category === 'object' ? product.category?.name : product.category) || ''
      
      // Búsqueda
      const matchesSearch = !debouncedSearchTerm ||
        product.name.toLowerCase().includes(searchLower) ||
        categoryName.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        (product.barcode && product.barcode.includes(debouncedSearchTerm))

      // Categoría
      const matchesCategory = selectedCategory === 'all' || categoryName === selectedCategory
      
      // Destacados
      const matchesFeatured = !showFeatured || (product as any).featured === true
      
      // Precio
      const matchesPrice = product.sale_price >= priceRange.min && product.sale_price <= priceRange.max

      // Stock
      let matchesStock = true
      switch (stockFilter) {
        case 'in_stock':
          matchesStock = product.stock_quantity > 0
          break
        case 'low_stock':
          matchesStock = product.stock_quantity <= 5 && product.stock_quantity > 0
          break
        case 'out_of_stock':
          matchesStock = product.stock_quantity === 0
          break
      }

      return matchesSearch && matchesCategory && matchesFeatured && matchesPrice && matchesStock
    }).sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'price':
          comparison = a.sale_price - b.sale_price
          break
        case 'stock':
          comparison = a.stock_quantity - b.stock_quantity
          break
        case 'category': {
          const aName = (typeof a.category === 'object' ? a.category?.name : a.category) || ''
          const bName = (typeof b.category === 'object' ? b.category?.name : b.category) || ''
          comparison = aName.localeCompare(bName)
          break
        }
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [products, debouncedSearchTerm, selectedCategory, showFeatured, priceRange, stockFilter, sortBy, sortOrder])

  // Productos paginados
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredProducts, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

  // Resetear filtros
  const resetFilters = useCallback(() => {
    setSearchTerm(DEFAULT_STATE.searchTerm)
    setSelectedCategory(DEFAULT_STATE.selectedCategory)
    setShowFeatured(DEFAULT_STATE.showFeatured)
    setStockFilter(DEFAULT_STATE.stockFilter)
    setPriceRange(DEFAULT_STATE.priceRange)
    setSortBy(DEFAULT_STATE.sortBy)
    setSortOrder(DEFAULT_STATE.sortOrder)
    setCurrentPage(DEFAULT_STATE.currentPage)
  }, [])

  return {
    state: {
      searchTerm,
      debouncedSearchTerm,
      selectedCategory,
      showFeatured,
      stockFilter,
      priceRange,
      sortBy,
      sortOrder,
      viewMode,
      showAdvancedFilters,
      currentPage,
      itemsPerPage
    },
    actions: {
      setSearchTerm,
      setSelectedCategory,
      setShowFeatured,
      setStockFilter,
      setPriceRange,
      setSortBy,
      setSortOrder,
      setViewMode,
      setShowAdvancedFilters,
      setCurrentPage,
      setItemsPerPage,
      resetFilters
    },
    filteredProducts,
    paginatedProducts,
    totalPages,
    categories,
    priceRangeLimits
  }
}
