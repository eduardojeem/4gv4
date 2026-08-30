'use client'

/**
 * usePOSSearch
 *
 * Encapsula toda la lógica de búsqueda y filtrado del POS:
 * - searchTerm con debounce de 300 ms
 * - Sugerencias de autocompletado (integra useSmartSearch)
 * - Filtros: categoría, precio, stock, destacados, crédito, cuotas
 * - Ordenamiento: nombre, precio, stock, categoría
 * - Paginación
 * - Persistencia de preferencias en localStorage
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { hasProductCredit } from '../lib/product-credit'
import { applyProductCreditFilter, type ProductCreditSort } from '../lib/product-credit-filter'
import { useSmartSearch } from './useSmartSearch'
import type { Product } from '@/types/product-unified'

const PREFS_KEY = 'pos.prefs'

export interface UsePOSSearchOptions {
  products: Product[]
}

export interface UsePOSSearchReturn {
  // Búsqueda
  searchTerm: string
  setSearchTerm: (v: string) => void
  handleSearchChange: (v: string) => void
  handleSearchKeyDown: (e: React.KeyboardEvent) => void
  debouncedSearchTerm: string

  // Sugerencias
  showSuggestions: boolean
  setShowSuggestions: (v: boolean) => void
  searchSuggestions: string[]
  selectedSuggestionIndex: number
  setSelectedSuggestionIndex: (v: number) => void
  selectSuggestion: (s: string) => void
  recentSearches: string[]

  // Filtros
  selectedCategory: string
  setSelectedCategory: (v: string) => void
  showFeatured: boolean
  setShowFeatured: (v: boolean) => void
  sortBy: 'name' | 'price' | 'stock' | 'category'
  setSortBy: (v: 'name' | 'price' | 'stock' | 'category') => void
  sortOrder: 'asc' | 'desc'
  setSortOrder: (v: 'asc' | 'desc') => void
  priceRange: { min: number; max: number }
  setPriceRange: (v: { min: number; max: number }) => void
  stockFilter: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  setStockFilter: (v: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock') => void
  creditOnly: boolean
  setCreditOnly: (v: boolean) => void
  minimumInstallments: number
  setMinimumInstallments: (v: number) => void
  creditSort: ProductCreditSort | null
  setCreditSort: (v: ProductCreditSort | null) => void
  activeFiltersCount: number
  handleResetFilters: () => void

  // Paginación
  currentPage: number
  setCurrentPage: (v: number) => void
  itemsPerPage: number
  setItemsPerPage: (v: number) => void
  totalPages: number

  // Resultados
  categories: string[]
  priceRangeLimits: { min: number; max: number }
  financedProductsCount: number
  filteredProducts: Product[]
  paginatedProducts: Product[]

  // Viewport (virtualización)
  viewportWidth: number
  viewportHeight: number
  virtualizationThreshold: number

  // Smart search passthrough
  smartSearchResults: any[]
  isSmartSearching: boolean
  addToRecentSearches: (v: string) => void
}

export function usePOSSearch({ products }: UsePOSSearchOptions): UsePOSSearchReturn {
  // --- Estado de búsqueda ---
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // --- Smart search ---
  const {
    setQuery: setSmartSearchQuery,
    searchResults: smartSearchResults,
    suggestions: smartSearchSuggestions,
    isSearching: isSmartSearching,
    addToRecentSearches,
  } = useSmartSearch({
    products: products as any[],
    maxResults: 20,
    enableFuzzySearch: true,
    enableSemanticSearch: true,
  })

  const searchSuggestions = useMemo(
    () => smartSearchSuggestions.map((s: any) => s.text),
    [smartSearchSuggestions]
  )

  // --- Filtros ---
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showFeatured, setShowFeatured] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'category'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({
    min: 0,
    max: Number.POSITIVE_INFINITY,
  })
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')
  const [creditOnly, setCreditOnly] = useState(false)
  const [minimumInstallments, setMinimumInstallments] = useState(1)
  const [creditSort, setCreditSort] = useState<ProductCreditSort | null>(null)

  // --- Paginación ---
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(24)

  // --- Viewport ---
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )
  const [viewportHeight, setViewportHeight] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 768
  )

  // --- Efectos ---

  // Debounce de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Viewport resize
  useEffect(() => {
    const update = () => {
      setViewportWidth(window.innerWidth)
      setViewportHeight(window.innerHeight)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Resetear página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, selectedCategory, stockFilter, priceRange, showFeatured, sortOrder, sortBy, creditOnly, minimumInstallments, creditSort])

  // Restaurar preferencias desde localStorage (solo al montar)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(PREFS_KEY)
      if (!saved) return
      const prefs = JSON.parse(saved)
      if (prefs.selectedCategory) setSelectedCategory(prefs.selectedCategory)
      if (typeof prefs.showFeatured === 'boolean') setShowFeatured(prefs.showFeatured)
      if (prefs.sortBy) setSortBy(prefs.sortBy)
      if (prefs.sortOrder) setSortOrder(prefs.sortOrder)
      if (prefs.priceRange && typeof prefs.priceRange.min === 'number') {
        const min = prefs.priceRange.min > 0 ? prefs.priceRange.min : 0
        const max =
          typeof prefs.priceRange.max === 'number' && prefs.priceRange.max > 1_000_000
            ? prefs.priceRange.max
            : Number.POSITIVE_INFINITY
        setPriceRange({ min, max })
      }
      if (prefs.stockFilter) setStockFilter(prefs.stockFilter)
      if (typeof prefs.creditOnly === 'boolean') setCreditOnly(prefs.creditOnly)
      if ([1, 3, 6, 12, 18, 24, 36, 48, 60].includes(prefs.minimumInstallments))
        setMinimumInstallments(prefs.minimumInstallments)
      if (
        ['installment_low', 'rate_low', 'installments_high', 'financed_total_low'].includes(
          prefs.creditSort
        )
      )
        setCreditSort(prefs.creditSort)
      if (prefs.recentSearches) setRecentSearches(prefs.recentSearches)
      if (prefs.itemsPerPage) setItemsPerPage(prefs.itemsPerPage)
    } catch (e) {
      console.warn('No se pudo restaurar preferencias POS', e)
    }
  }, [])

  // Persistir preferencias
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          selectedCategory,
          showFeatured,
          sortBy,
          sortOrder,
          priceRange,
          stockFilter,
          creditOnly,
          minimumInstallments,
          creditSort,
          recentSearches,
          itemsPerPage,
        })
      )
    } catch (e) {
      console.error('Error guardando preferencias POS', e)
    }
  }, [
    selectedCategory,
    showFeatured,
    sortBy,
    sortOrder,
    priceRange,
    stockFilter,
    creditOnly,
    minimumInstallments,
    creditSort,
    recentSearches,
    itemsPerPage,
  ])

  // --- Handlers de búsqueda ---
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value)
      setSmartSearchQuery(value)
      setShowSuggestions(value.length > 0)
      setSelectedSuggestionIndex(-1)
    },
    [setSmartSearchQuery]
  )

  const selectSuggestion = useCallback(
    (suggestion: string) => {
      setSearchTerm(suggestion)
      setSmartSearchQuery(suggestion)
      addToRecentSearches(suggestion)
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
      setRecentSearches(prev =>
        prev.includes(suggestion) ? prev : [suggestion, ...prev.slice(0, 4)]
      )
    },
    [addToRecentSearches, setSmartSearchQuery]
  )

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions || searchSuggestions.length === 0) return
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedSuggestionIndex(prev =>
            prev < searchSuggestions.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedSuggestionIndex(prev =>
            prev > 0 ? prev - 1 : searchSuggestions.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (selectedSuggestionIndex >= 0) {
            selectSuggestion(searchSuggestions[selectedSuggestionIndex])
          } else if (searchTerm.trim()) {
            setShowSuggestions(false)
            setRecentSearches(prev =>
              prev.includes(searchTerm) ? prev : [searchTerm, ...prev.slice(0, 4)]
            )
          }
          break
        case 'Escape':
          setShowSuggestions(false)
          setSelectedSuggestionIndex(-1)
          break
      }
    },
    [
      showSuggestions,
      searchSuggestions,
      selectedSuggestionIndex,
      selectSuggestion,
      searchTerm,
    ]
  )

  // --- Filtros calculados ---
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (selectedCategory !== 'all') count++
    if (showFeatured) count++
    if (sortBy !== 'name' || sortOrder !== 'asc') count++
    if (stockFilter !== 'all') count++
    if (priceRange.min > 0 || (priceRange.max < Number.POSITIVE_INFINITY && priceRange.max > 0))
      count++
    if (creditOnly) count++
    if (minimumInstallments > 1) count++
    if (creditSort) count++
    return count
  }, [
    selectedCategory,
    showFeatured,
    sortBy,
    sortOrder,
    stockFilter,
    priceRange,
    creditOnly,
    minimumInstallments,
    creditSort,
  ])

  const handleResetFilters = useCallback(() => {
    setSelectedCategory('all')
    setShowFeatured(false)
    setStockFilter('all')
    setSortBy('name')
    setSortOrder('asc')
    setPriceRange({ min: 0, max: Number.POSITIVE_INFINITY })
    setCreditOnly(false)
    setMinimumInstallments(1)
    setCreditSort(null)
    setSearchTerm('')
    toast.info('Filtros restablecidos')
  }, [])

  // --- Categorías y rango de precios derivados del catálogo ---
  const categories = useMemo(() => {
    const names = products
      .map(p => (typeof p.category === 'object' ? (p.category as any)?.name : p.category))
      .filter((name): name is string => !!name && typeof name === 'string')
    return ['all', ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))]
  }, [products])

  const priceRangeLimits = useMemo(() => {
    if (products.length === 0) return { min: 0, max: 0 }
    const prices = products.map(p => p.sale_price)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [products])

  const financedProductsCount = useMemo(
    () => products.filter(hasProductCredit).length,
    [products]
  )

  // --- Filtrado, ordenamiento y paginación ---
  const filteredList = useMemo(() => {
    return products.filter(product => {
      const searchLower = debouncedSearchTerm.toLowerCase()
      const categoryName =
        (typeof product.category === 'object'
          ? (product.category as any)?.name
          : product.category) || ''

      const matchesSearch =
        !debouncedSearchTerm ||
        product.name.toLowerCase().includes(searchLower) ||
        categoryName.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        (product.barcode && product.barcode.includes(debouncedSearchTerm)) ||
        smartSearchResults.some((res: any) => res.product.id === product.id)

      const matchesCategory =
        selectedCategory === 'all' || categoryName === selectedCategory

      const matchesFeatured =
        !showFeatured ||
        Boolean(
          (product as any).featured ||
            (product as any).is_featured ||
            (product as any).isFeatured
        )

      const matchesPrice =
        product.sale_price >= priceRange.min && product.sale_price <= priceRange.max

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
    })
  }, [
    products,
    debouncedSearchTerm,
    smartSearchResults,
    selectedCategory,
    showFeatured,
    priceRange,
    stockFilter,
  ])

  const filteredProducts = useMemo(() => {
    const sorted = [...filteredList].sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'price':
          cmp = a.sale_price - b.sale_price
          break
        case 'stock':
          cmp = a.stock_quantity - b.stock_quantity
          break
        case 'category': {
          const aName =
            (typeof a.category === 'object' ? (a.category as any)?.name : a.category) || ''
          const bName =
            (typeof b.category === 'object' ? (b.category as any)?.name : b.category) || ''
          cmp = aName.localeCompare(bName)
          break
        }
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return applyProductCreditFilter(sorted, { creditOnly, minimumInstallments, creditSort })
  }, [filteredList, sortBy, sortOrder, creditOnly, minimumInstallments, creditSort])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredProducts.slice(start, start + itemsPerPage)
  }, [filteredProducts, currentPage, itemsPerPage])

  return {
    searchTerm,
    setSearchTerm,
    handleSearchChange,
    handleSearchKeyDown,
    debouncedSearchTerm,

    showSuggestions,
    setShowSuggestions,
    searchSuggestions,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    selectSuggestion,
    recentSearches,

    selectedCategory,
    setSelectedCategory,
    showFeatured,
    setShowFeatured,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    priceRange,
    setPriceRange,
    stockFilter,
    setStockFilter,
    creditOnly,
    setCreditOnly,
    minimumInstallments,
    setMinimumInstallments,
    creditSort,
    setCreditSort,
    activeFiltersCount,
    handleResetFilters,

    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,

    categories,
    priceRangeLimits,
    financedProductsCount,
    filteredProducts,
    paginatedProducts,

    viewportWidth,
    viewportHeight,
    virtualizationThreshold: 100,

    smartSearchResults,
    isSmartSearching,
    addToRecentSearches,
  }
}
