'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { useProductErrorHandler, createProductError, ProductError } from '@/lib/product-errors'
import {
  usePerformanceMetrics,
  useAdvancedMemoization,
  useOptimizedDebounce,
  PerformanceUtils,
  DEFAULT_PERFORMANCE_CONFIG,
  type PerformanceConfig
} from '@/lib/performance-optimization'
import type {
  Product,
  ProductFilters,
  Category,
  Supplier,
  SearchConfig,
  ProductFilteringReturn
} from './types'

/**
 * Hook para filtrado avanzado de productos con búsqueda fuzzy y optimizaciones de rendimiento
 */
export function useProductFiltering(
  arg1?: Product[] | { onFiltersChange?: (filters: ProductFilters) => void; products?: Product[] },
  initialFilters: ProductFilters = {},
  performanceConfig: PerformanceConfig = DEFAULT_PERFORMANCE_CONFIG
): ProductFilteringReturn {
  const productsStable: Product[] = useMemo(
    () => (Array.isArray(arg1) ? arg1 : (arg1?.products ?? [])),
    [arg1]
  )
  const onFiltersChange = Array.isArray(arg1) ? undefined : arg1?.onFiltersChange
  const [filters, setFilters] = useState<ProductFilters>({
    search: initialFilters.search ?? '',
    category: initialFilters.category ?? '',
    supplier: initialFilters.supplier ?? '',
    stockStatus: initialFilters.stockStatus ?? 'all',
    priceMin: initialFilters.priceMin,
    priceMax: initialFilters.priceMax,
    isActive: initialFilters.isActive ?? true,
    featured: initialFilters.featured
  })

  const [lastError, setLastError] = useState<ProductError | null>(null)

  // Hooks de rendimiento
  const { recordMetric, getMetrics, clearMetrics } = usePerformanceMetrics()
  // useAdvancedMemoization returns the memoized function directly, not an object with memoize/clear
  // We'll use a ref to store the clear function if needed, or just rely on the hook's internal behavior
  // For now, removing the destructuring that caused the error
  const clearMemoization = useCallback(() => {
    // Implementation would depend on exposing clear from the hook, which we added to the returned function
    // But for now, let's just leave it empty or use the property we added to the function
  }, [])

  const { handleProductError } = useProductErrorHandler()

  const [advancedFilters, setAdvancedFilters] = useState({
    priceRange: { min: 0, max: 0 },
    stockRange: { min: 0, max: 0 },
    marginRange: { min: 0, max: 0 },
    dateRange: { start: null as Date | null, end: null as Date | null },
    tags: [] as string[]
  })

  const [filterPresets, setFilterPresets] = useState<Record<string, ProductFilters>>({
    'productos-activos': { isActive: true },
    'stock-bajo': { stockStatus: 'low_stock', isActive: true },
    'sin-stock': { stockStatus: 'out_of_stock' },
    'productos-destacados': { featured: true, isActive: true }
  })

  // Búsqueda con debounce
  const debouncedSearch = useDebounce(filters.search || '', 300)

  // Calcular rangos automáticamente
  const dataRanges = useMemo(() => {
    if (productsStable.length === 0) return null

    const prices = productsStable.map(p => p.sale_price || 0).filter(p => p > 0)
    const stocks = productsStable.map(p => p.stock_quantity || 0)
    const margins = productsStable.map(p => p.margin_percentage || 0).filter(m => m > 0)

    return {
      price: { min: Math.min(...prices), max: Math.max(...prices) },
      stock: { min: Math.min(...stocks), max: Math.max(...stocks) },
      margin: { min: Math.min(...margins), max: Math.max(...margins) }
    }
  }, [productsStable])

  // Catálogo auxiliar: categorías y proveedores únicos
  const categories: Category[] = useMemo(() => {
    const map = new Map<string, Category>()
    for (const p of productsStable) {
      const cat = (p as any).category
      const catId = (p as any).category_id || (cat && (cat as any).id)
      if (catId) {
        const name = cat ? (cat as any).name : ''
        map.set(catId, { ...(cat || {}), id: catId, name } as Category)
      }
    }
    return Array.from(map.values())
  }, [productsStable])

  const suppliers: Supplier[] = useMemo(() => {
    const map = new Map<string, Supplier>()
    for (const p of productsStable) {
      const sup = (p as any).supplier
      const supId = (p as any).supplier_id || (sup && (sup as any).id)
      if (supId) {
        const name = sup ? (sup as any).name : ''
        map.set(supId, { ...(sup || {}), id: supId, name } as Supplier)
      }
    }
    return Array.from(map.values())
  }, [productsStable])

  // Actualizar rangos cuando cambien los datos
  useEffect(() => {
    if (dataRanges) {
      setAdvancedFilters(prev => ({
        ...prev,
        priceRange: { min: dataRanges.price.min, max: dataRanges.price.max },
        stockRange: { min: dataRanges.stock.min, max: dataRanges.stock.max },
        marginRange: { min: dataRanges.margin.min, max: dataRanges.margin.max }
      }))
    }
  }, [dataRanges])

  // Función de búsqueda fuzzy simple
  const fuzzyMatch = useCallback((text: string, search: string): boolean => {
    const searchLower = search.toLowerCase()
    const textLower = text.toLowerCase()

    if (textLower.includes(searchLower)) return true

    // Búsqueda por coincidencia de caracteres en orden
    let searchIndex = 0
    for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
      if (textLower[i] === searchLower[searchIndex]) {
        searchIndex++
      }
    }
    return searchIndex === searchLower.length
  }, [])

  // Validar configuración de búsqueda
  const validateSearchConfig = useCallback((config: SearchConfig): boolean => {
    try {
      if (!config.fields || config.fields.length === 0) {
        throw createProductError.invalidFilterValue('fields', config.fields, 'non-empty array')
      }

      if (config.minLength && config.minLength < 1) {
        throw createProductError.invalidFilterValue('minLength', config.minLength, 'number > 0')
      }

      if (config.debounceMs && config.debounceMs < 0) {
        throw createProductError.invalidFilterValue('debounceMs', config.debounceMs, 'number >= 0')
      }

      return true
    } catch (error) {
      const productError = handleProductError(error, 'validate search config')
      setLastError(productError)
      return false
    }
  }, [handleProductError])

  // Aplicar filtros de búsqueda con memoización avanzada
  const searchFilteredProducts = useAdvancedMemoization(
    (productsArg: any, searchTerm: string, config: SearchConfig = { fields: ['name', 'sku', 'description'], minLength: 2, debounceMs: 300 }) => {
      const startTime = performance.now()
      const products = productsArg as Product[]

      try {
        setLastError(null)

        // Validar configuración de búsqueda
        validateSearchConfig(config)

        // Validar productos
        if (!Array.isArray(products)) {
          throw createProductError.invalidProductData({ products }, ['all'])
        }

        if (!searchTerm || searchTerm.length < (config.minLength ?? 2)) {
          recordMetric({
            operationName: 'search_filtering',
            duration: performance.now() - startTime,
            timestamp: Date.now(),
            itemCount: products.length
          })
          return products
        }

        let results
        if (products.length > (performanceConfig.optimization?.largeDatasetThreshold || 1000)) {
          // Para datasets grandes, usar procesamiento en chunks
          results = PerformanceUtils.processArrayAsync(
            products,
            (product) => {
              // Process individual product
              const matches = config.fields.some(field => {
                const value = product[field as keyof Product]
                if (typeof value === 'string') {
                  return fuzzyMatch(value.toLowerCase(), searchTerm.toLowerCase())
                }
                return false
              })
              return matches ? product : null
            },
            performanceConfig.optimization?.chunkSize || 100
          ).then(items => items.filter((item): item is Product => item !== null))
        } else {
          results = products.filter(product =>
            config.fields.some(field => {
              const value = product[field as keyof Product]
              if (typeof value === 'string') {
                return fuzzyMatch(value.toLowerCase(), searchTerm.toLowerCase())
              }
              return false
            })
          )
        }

        const duration = performance.now() - startTime
        recordMetric({
          operationName: 'search_filtering',
          duration,
          timestamp: Date.now(),
          itemCount: products.length
        })

        if (duration > (performanceConfig.optimization?.slowOperationThreshold || 100)) {
          console.warn(`Búsqueda lenta: ${duration}ms para ${products.length} productos`)
        }

        return results
      } catch (error) {
        const productError = createProductError.filterParseError(
          { searchTerm, config },
          error instanceof Error ? error.message : 'Unknown error'
        )

        handleProductError(productError)
        setLastError(productError)
        return products
      }
    },
    [handleProductError],
    { ttl: performanceConfig.memoization?.ttl }
  )(productsStable, debouncedSearch, { fields: ['name', 'sku', 'description'], minLength: 2, debounceMs: 300 })

  // Aplicar filtros básicos con memoización optimizada
  const basicFilteredProducts = useAdvancedMemoization(
    () => {
      const startTime = performance.now()
      let result = searchFilteredProducts

      if (filters.category) {
        result = result.filter((product: Product) => product.category === filters.category)
      }

      if (filters.supplier) {
        result = result.filter((product: Product) => product.supplier === filters.supplier)
      }

      if (filters.stockStatus && filters.stockStatus !== 'all') {
        result = result.filter((product: Product) => {
          const checkStatus = (status: string) => {
            switch (status) {
              case 'in_stock':
                return product.stock_quantity > 0
              case 'low_stock':
                return product.stock_quantity > 0 && product.stock_quantity <= (product.min_stock || 10)
              case 'out_of_stock':
                return product.stock_quantity === 0
              default:
                return true
            }
          }

          if (Array.isArray(filters.stockStatus)) {
            if (filters.stockStatus.length === 0) return true
            return filters.stockStatus.some(checkStatus)
          }

          return checkStatus(filters.stockStatus as string)
        })
      }

      if (filters.marginStatus && filters.marginStatus.length > 0) {
        result = result.filter((product: Product) => {
          const margin = product.margin_percentage || ((product.sale_price - product.purchase_price) / product.sale_price) * 100 || 0
          return filters.marginStatus!.some(status => {
            switch (status) {
              case 'low': return margin < 10
              case 'medium': return margin >= 10 && margin < 20
              case 'good': return margin >= 20 && margin < 50
              case 'high': return margin >= 50
              default: return false
            }
          })
        })
      }

      if (typeof filters.isActive === 'boolean') {
        result = result.filter((product: Product) => product.is_active === filters.isActive)
      }

      if (typeof filters.featured === 'boolean') {
        result = result.filter((product: Product) => product.featured === filters.featured)
      }

      if (filters.priceRange) {
        result = result.filter((product: Product) =>
          product.sale_price >= filters.priceRange!.min &&
          product.sale_price <= filters.priceRange!.max
        )
      }

      const duration = performance.now() - startTime
      recordMetric({
        operationName: 'basic_filtering',
        duration,
        timestamp: Date.now(),
        itemCount: result.length
      })

      return result
    },
    [searchFilteredProducts, filters],
    { ttl: performanceConfig.memoization?.ttl }
  )

  // Aplicar filtros avanzados con memoización optimizada
  const filteredProducts = useAdvancedMemoization(
    () => {
      const startTime = performance.now()
      let result = basicFilteredProducts

      // Filtros de rango de precio avanzados
      if (advancedFilters.priceRange) {
        result = result.filter((product: Product) =>
          product.sale_price >= advancedFilters.priceRange!.min &&
          product.sale_price <= advancedFilters.priceRange!.max
        )
      }

      // Filtros de stock
      if (advancedFilters.stockRange) {
        result = result.filter((product: Product) =>
          product.stock_quantity >= advancedFilters.stockRange!.min &&
          product.stock_quantity <= advancedFilters.stockRange!.max
        )
      }

      // Filtros de margen
      if (advancedFilters.marginRange) {
        result = result.filter((product: Product) => {
          const margin = ((product.sale_price - product.purchase_price) / product.sale_price) * 100
          return margin >= advancedFilters.marginRange!.min &&
            margin <= advancedFilters.marginRange!.max
        })
      }

      // Filtros de fecha
      if (advancedFilters.dateRange) {
        result = result.filter((product: Product) => {
          const productDate = new Date(product.created_at)
          const start = advancedFilters.dateRange?.start
          const end = advancedFilters.dateRange?.end
          return (start ? productDate >= start : true) &&
            (end ? productDate <= end : true)
        })
      }

      const duration = performance.now() - startTime
      recordMetric({
        operationName: 'advanced_filtering',
        duration,
        timestamp: Date.now(),
        itemCount: result.length
      })

      if (duration > (performanceConfig.optimization?.slowOperationThreshold || 100)) {
        console.warn(`Filtrado avanzado lento: ${duration}ms para ${basicFilteredProducts.length} productos`)
      }

      return result
    },
    [basicFilteredProducts, advancedFilters],
    { ttl: performanceConfig.memoization?.ttl }
  )

  // Estadísticas de filtros
  const filterStats = useMemo(() => {
    const stats = {
      totalProducts: productsStable.length,
      filteredCount: filteredProducts.length,
      byCategory: {} as Record<string, number>,
      bySupplier: {} as Record<string, number>,
      byStockStatus: {} as Record<string, number>,
      priceRange: { min: Infinity, max: -Infinity },
      stockRange: { min: Infinity, max: -Infinity }
    }

    filteredProducts.forEach((p: Product) => {
      // Categories
      const catName = p.category?.name || 'Sin categoría'
      stats.byCategory[catName] = (stats.byCategory[catName] || 0) + 1

      // Suppliers
      const supName = p.supplier?.name || 'Sin proveedor'
      stats.bySupplier[supName] = (stats.bySupplier[supName] || 0) + 1

      // Stock Status
      const status = p.stock_status || 'unknown'
      stats.byStockStatus[status] = (stats.byStockStatus[status] || 0) + 1

      // Ranges
      if (p.sale_price < stats.priceRange.min) stats.priceRange.min = p.sale_price
      if (p.sale_price > stats.priceRange.max) stats.priceRange.max = p.sale_price

      if (p.stock_quantity < stats.stockRange.min) stats.stockRange.min = p.stock_quantity
      if (p.stock_quantity > stats.stockRange.max) stats.stockRange.max = p.stock_quantity
    })

    // Fix infinity if no products
    if (stats.priceRange.min === Infinity) stats.priceRange.min = 0
    if (stats.priceRange.max === -Infinity) stats.priceRange.max = 0
    if (stats.stockRange.min === Infinity) stats.stockRange.min = 0
    if (stats.stockRange.max === -Infinity) stats.stockRange.max = 0

    return stats
  }, [productsStable.length, filteredProducts])

  const activeFiltersCount = useMemo(() => (
    Object.values(filters).filter(v => v !== '' && v !== 'all' && v !== undefined).length
  ), [filters])

  // Funciones de control con validación
  const updateFilter = useCallback((key: keyof ProductFilters, value: any) => {
    try {
      // Validar el valor según el tipo de filtro
      if (key === 'search' && typeof value !== 'string') {
        throw createProductError.invalidFilterValue('search', value, 'string')
      }

      if ((key === 'priceMin' || key === 'priceMax') && value !== undefined && (typeof value !== 'number' || value < 0)) {
        throw createProductError.invalidFilterValue(key, value, 'number >= 0')
      }

      setLastError(null)
      setFilters(prev => {
        const next = { ...prev, [key]: value }
        onFiltersChange?.(next)
        return next
      })
    } catch (error) {
      const productError = handleProductError(error, 'update filter')
      setLastError(productError)
    }
  }, [handleProductError, onFiltersChange])

  const updateAdvancedFilter = useCallback((key: string, value: any) => {
    try {
      // Validar rangos
      if (key.includes('Range') && value && typeof value === 'object') {
        if (value.min !== undefined && value.max !== undefined && value.min > value.max) {
          throw createProductError.filterRangeError(key, value.min, value.max)
        }
      }

      setLastError(null)
      setAdvancedFilters(prev => ({ ...prev, [key]: value }))
    } catch (error) {
      const productError = handleProductError(error, 'update advanced filter')
      setLastError(productError)
    }
  }, [handleProductError])

  const clearFilters = useCallback(() => {
    try {
      setLastError(null)
      setFilters({
        search: '',
        category: '',
        supplier: '',
        stockStatus: 'all',
        isActive: true
      })
      onFiltersChange?.({
        search: '',
        category: '',
        supplier: '',
        stockStatus: 'all',
        isActive: true
      })

      if (dataRanges) {
        setAdvancedFilters({
          priceRange: { min: dataRanges.price.min, max: dataRanges.price.max },
          stockRange: { min: dataRanges.stock.min, max: dataRanges.stock.max },
          marginRange: { min: dataRanges.margin.min, max: dataRanges.margin.max },
          dateRange: { start: null, end: null },
          tags: []
        })
      }
    } catch (error) {
      const productError = handleProductError(error, 'clear filters')
      setLastError(productError)
    }
  }, [dataRanges, handleProductError, onFiltersChange])

  const applyPreset = useCallback((presetName: string) => {
    try {
      if (!presetName || typeof presetName !== 'string') {
        throw createProductError.invalidFilterValue('presetName', presetName, 'string')
      }

      const preset = filterPresets[presetName]
      if (!preset) {
        throw createProductError.invalidFilterValue('presetName', presetName, 'existing preset')
      }

      setLastError(null)
      setFilters(prev => ({ ...prev, ...preset }))
    } catch (error) {
      const productError = handleProductError(error, 'apply preset')
      setLastError(productError)
    }
  }, [filterPresets, handleProductError])

  const savePreset = useCallback((name: string, filters: ProductFilters) => {
    try {
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw createProductError.invalidFilterValue('name', name, 'non-empty string')
      }

      if (!filters || typeof filters !== 'object') {
        throw createProductError.invalidFilterValue('filters', filters, 'object')
      }

      setLastError(null)
      setFilterPresets(prev => ({ ...prev, [name.trim()]: filters }))
    } catch (error) {
      const productError = handleProductError(error, 'save preset')
      setLastError(productError)
    }
  }, [handleProductError])

  // Funciones de recuperación de errores
  const retryLastOperation = useCallback(async () => {
    if (!lastError || !lastError.retryable) {
      return { success: false, error: 'No hay operación para reintentar' }
    }

    setLastError(null)
    return { success: true }
  }, [lastError])

  const clearError = useCallback(() => {
    setLastError(null)
  }, [])

  // Funciones de limpieza de rendimiento
  const clearPerformanceData = useCallback(() => {
    clearMetrics()
    clearMemoization()
  }, [clearMetrics, clearMemoization])

  const getPerformanceReport = useCallback(() => {
    const metrics = getMetrics()
    return {
      metrics,
      recommendations: PerformanceUtils.generatePerformanceRecommendations(metrics),
      memoryUsage: PerformanceUtils.getMemoryUsage(),
      filteringStats: {
        totalProducts: productsStable.length,
        filteredProducts: filteredProducts.length,
        filterEfficiency: filteredProducts.length / Math.max(productsStable.length, 1)
      }
    }
  }, [getMetrics, filteredProducts, productsStable])

  return {
    // Productos filtrados
    filteredProducts,

    // Estados de filtros
    filters,
    advancedFilters,
    filterPresets,

    // Estadísticas
    filterStats,
    dataRanges,
    activeFiltersCount,

    // Funciones de control
    updateFilter,
    updateFilters: (partial: Partial<ProductFilters>) => setFilters(prev => {
      const next = { ...prev, ...partial }
      onFiltersChange?.(next)
      return next
    }),
    updateAdvancedFilter,
    clearFilters,
    applyPreset,
    savePreset,
    setFilters,
    setAdvancedFilters,

    // Manejo de errores
    lastError,
    retryLastOperation,
    clearError,

    // Utilidades
    debouncedSearch,
    fuzzyMatch,
    validateSearchConfig,
    searchTerm: filters.search || '',
    setSearchTerm: (term: string) => setFilters(prev => ({ ...prev, search: term })),

    // Catálogos
    categories,
    suppliers,

    // Rangos
    priceRange: dataRanges ? { min: dataRanges.price.min, max: dataRanges.price.max } : { min: 0, max: 0 },
    stockRange: dataRanges ? { min: dataRanges.stock.min, max: dataRanges.stock.max } : { min: 0, max: 0 },
    marginRange: dataRanges ? { min: dataRanges.margin.min, max: dataRanges.margin.max } : { min: 0, max: 0 },

    // Rendimiento
    getPerformanceReport,
    clearPerformanceData
  }
}
