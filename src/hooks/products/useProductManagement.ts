'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useProductsSupabase } from '../useProductsSupabase'
import { useProducts } from '../useProducts'
import { useProductErrorHandler, createProductError, ProductError } from '@/lib/product-errors'
import { useErrorHandler } from '@/lib/error-handling'
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
  ProductSort, 
  PaginationOptions,
  LoadingState,
  OperationResult
} from './types'

/**
 * Hook compuesto para gestión completa de productos
 * Combina datos, filtros, CRUD y operaciones en lote con optimizaciones de rendimiento
 */
export function useProductManagement(
  initialFilters: ProductFilters = {},
  initialSort: SortConfig = { field: 'name', direction: 'asc' },
  initialPagination: PaginationConfig = { page: 1, pageSize: 20 },
  performanceConfig: PerformanceConfig = DEFAULT_PERFORMANCE_CONFIG
) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false)
  const [lastError, setLastError] = useState<ProductError | null>(null)

  // Hooks de rendimiento
  const { recordMetric, getMetrics, clearMetrics } = usePerformanceMetrics()
  const { memoize, clear: clearMemoization } = useAdvancedMemoization(performanceConfig.memoization)

  // Hooks de manejo de errores
  const { handleProductError } = useProductErrorHandler()
  const { handleAsyncError } = useErrorHandler()

  // Usar el hook principal de productos
  const {
    products,
    categories,
    suppliers,
    loading,
    error,
    totalCount,
    filters,
    sort,
    pagination,
    setFilters,
    setSort,
    setPagination,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    refreshData
  } = useProductsSupabase()

  // Hook adicional para operaciones específicas
  const { loadProducts } = useProducts()

  // Validaciones
  const validateProductData = useCallback((product: Partial<Product>): void => {
    if (!product.name?.trim()) {
      throw createProductError.productValidationFailed(
        { name: 'El nombre del producto es requerido' },
        product.id
      )
    }

    if (product.price !== undefined && product.price < 0) {
      throw createProductError.productValidationFailed(
        { price: 'El precio debe ser mayor o igual a 0' },
        product.id
      )
    }

    if (product.stock !== undefined && product.stock < 0) {
      throw createProductError.productValidationFailed(
        { stock: 'El stock debe ser mayor o igual a 0' },
        product.id
      )
    }

    if (product.sku && products.some(p => p.sku === product.sku && p.id !== product.id)) {
      throw createProductError.duplicateProductId(product.sku)
    }
  }, [products])

  const validateProductIds = useCallback((productIds: string[]): void => {
    if (productIds.length === 0) {
      throw createProductError.invalidProductData('No se proporcionaron IDs de productos')
    }

    const existingIds = products.map(p => p.id)
    const invalidIds = productIds.filter(id => !existingIds.includes(id))
    
    if (invalidIds.length > 0) {
      throw createProductError.productNotFound(invalidIds[0])
    }
  }, [products])

  // Estado de carga combinado
  const loadingState: LoadingState = useMemo(() => ({
    loading: loading || bulkOperationLoading,
    error
  }), [loading, bulkOperationLoading, error])

  // Productos filtrados y ordenados con memoización optimizada
  const processedProducts = useAdvancedMemoization(
    () => {
      const startTime = performance.now()
      
      if (!products.length) {
        recordMetric('product_processing', performance.now() - startTime)
        return []
      }
      
      let result = [...products]

      // Aplicar filtros adicionales si es necesario
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase()
        result = result.filter(product => 
          product.name?.toLowerCase().includes(searchTerm) ||
          product.sku?.toLowerCase().includes(searchTerm) ||
          product.description?.toLowerCase().includes(searchTerm)
        )
      }
      
      // Aplicar filtros básicos de manera optimizada
      if (filters.category) {
        result = result.filter(product => product.category === filters.category)
      }
      
      if (filters.supplier) {
        result = result.filter(product => product.supplier === filters.supplier)
      }
      
      if (filters.priceRange) {
        result = result.filter(product => 
          product.price >= filters.priceRange!.min && 
          product.price <= filters.priceRange!.max
        )
      }
      
      if (filters.stockStatus) {
        result = result.filter(product => {
          switch (filters.stockStatus) {
            case 'in_stock':
              return product.stock > 0
            case 'low_stock':
              return product.stock > 0 && product.stock <= (product.minStock || 10)
            case 'out_of_stock':
              return product.stock === 0
            default:
              return true
          }
        })
      }
      
      if (typeof filters.isActive === 'boolean') {
        result = result.filter(product => product.isActive === filters.isActive)
      }
      
      if (typeof filters.isFeatured === 'boolean') {
        result = result.filter(product => product.isFeatured === filters.isFeatured)
      }
      
      // Aplicar ordenamiento optimizado
      if (result.length > performanceConfig.optimization.largeDatasetThreshold) {
        // Para datasets grandes, usar ordenamiento optimizado
        result = PerformanceUtils.processArrayAsync(
          result,
          (chunk) => chunk.sort((a, b) => {
            const aValue = a[sort.field]
            const bValue = b[sort.field]
            
            if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1
            if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1
            return 0
          }),
          performanceConfig.optimization.chunkSize
        ).then(chunks => chunks.flat())
      } else {
        result.sort((a, b) => {
          const aValue = a[sort.field]
          const bValue = b[sort.field]
          
          if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1
          if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1
          return 0
        })
      }
      
      const duration = performance.now() - startTime
      recordMetric('product_processing', duration)
      
      // Alertar si el procesamiento es lento
      if (duration > performanceConfig.optimization.slowOperationThreshold) {
        console.warn(`Procesamiento lento de productos: ${duration}ms para ${products.length} productos`)
      }

      return result
    },
    [products, filters, sort],
    { ttl: performanceConfig.memoization.ttl }
  )

  // Selección de productos
  const selectProduct = useCallback((productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }, [])

  const selectAllProducts = useCallback(() => {
    setSelectedProducts(processedProducts.map(p => p.id))
  }, [processedProducts])

  const clearSelection = useCallback(() => {
    setSelectedProducts([])
  }, [])

  // Operaciones en lote optimizadas con debouncing
  const debouncedBulkUpdate = useOptimizedDebounce(
    async (productIds: string[], updates: Partial<Product>) => {
      const startTime = performance.now()
      
      try {
        setBulkOperationLoading(true)
        setLastError(null)

        // Validaciones
        validateProductIds(productIds)
        validateProductData(updates)

        // Verificar rendimiento para datasets grandes
        if (productIds.length > performanceConfig.optimization.largeDatasetThreshold) {
          const warning = createProductError.largeDatasetWarning(productIds.length, performanceConfig.optimization.largeDatasetThreshold)
          console.warn('Bulk operation warning:', warning.message)
        }

        // Procesar en chunks para mejor rendimiento
        const results = await PerformanceUtils.processArrayAsync(
          productIds,
          async (chunk) => {
            return Promise.all(chunk.map(async (id) => {
              try {
                return await updateProduct(id, updates)
              } catch (error) {
                const productError = handleProductError(error, `bulk update product ${id}`)
                return { success: false, error: productError.message, productId: id }
              }
            }))
          },
          performanceConfig.optimization.chunkSize
        )

        const flatResults = results.flat()
        const duration = performance.now() - startTime
        recordMetric('bulk_update', duration)

        if (duration > performanceConfig.optimization.slowOperationThreshold) {
          const warning = createProductError.slowOperationWarning('bulk update', duration, performanceConfig.optimization.slowOperationThreshold)
          console.warn('Performance warning:', warning.message)
        }

        return flatResults
      } catch (error) {
        const productError = handleProductError(error, 'bulk update products')
        setLastError(productError)
        throw productError
      } finally {
        setBulkOperationLoading(false)
      }
    },
    performanceConfig.debounce.delay
  )

  const bulkUpdateProducts = useCallback(async (
    productIds: string[],
    updates: Partial<Product>
  ): Promise<OperationResult> => {
    try {
      const results = await debouncedBulkUpdate(productIds, updates)
      
      const failedUpdates = results.filter(result => !result.success)
      const failedProductIds = failedUpdates
        .map(result => (result as any).productId)
        .filter(Boolean)
      
      if (failedUpdates.length > 0) {
        const error = createProductError.bulkOperationFailed(
          'actualización',
          failedProductIds,
          productIds.length
        )
        setLastError(error)
        
        return {
          success: false,
          error: error.message,
          data: { 
            failedCount: failedUpdates.length,
            successCount: productIds.length - failedUpdates.length,
            failedProducts: failedProductIds
          }
        }
      }

      await refreshData()
      clearSelection()
      
      return {
        success: true,
        data: { updatedCount: productIds.length }
      }
    } catch (error) {
      const productError = handleProductError(error, 'bulk update products')
      setLastError(productError)
      
      return {
        success: false,
        error: productError.message
      }
    }
  }, [debouncedBulkUpdate, refreshData, clearSelection, handleProductError])

  const debouncedBulkDelete = useOptimizedDebounce(
    async (productIds: string[]) => {
      const startTime = performance.now()
      
      try {
        setBulkOperationLoading(true)
        setLastError(null)

        // Validaciones
        validateProductIds(productIds)

        // Verificar rendimiento para datasets grandes
        if (productIds.length > performanceConfig.optimization.largeDatasetThreshold) {
          const warning = createProductError.largeDatasetWarning(productIds.length, performanceConfig.optimization.largeDatasetThreshold)
          console.warn('Bulk delete warning:', warning.message)
        }

        // Procesar en chunks para mejor rendimiento
        const results = await PerformanceUtils.processArrayAsync(
          productIds,
          async (chunk) => {
            return Promise.all(chunk.map(async (id) => {
              try {
                return await deleteProduct(id)
              } catch (error) {
                const productError = handleProductError(error, `bulk delete product ${id}`)
                return { success: false, error: productError.message, productId: id }
              }
            }))
          },
          performanceConfig.optimization.chunkSize
        )

        const flatResults = results.flat()
        const duration = performance.now() - startTime
        recordMetric('bulk_delete', duration)

        if (duration > performanceConfig.optimization.slowOperationThreshold) {
          const warning = createProductError.slowOperationWarning('bulk delete', duration, performanceConfig.optimization.slowOperationThreshold)
          console.warn('Performance warning:', warning.message)
        }

        return flatResults
      } catch (error) {
        const productError = handleProductError(error, 'bulk delete products')
        setLastError(productError)
        throw productError
      } finally {
        setBulkOperationLoading(false)
      }
    },
    performanceConfig.debounce.delay
  )

  const bulkDeleteProducts = useCallback(async (
    productIds: string[]
  ): Promise<OperationResult> => {
    try {
      const results = await debouncedBulkDelete(productIds)
      
      const failedDeletes = results.filter(result => !result.success)
      const failedProductIds = failedDeletes
        .map(result => (result as any).productId)
        .filter(Boolean)
      
      if (failedDeletes.length > 0) {
        const error = createProductError.bulkOperationFailed(
          'eliminación',
          failedProductIds,
          productIds.length
        )
        setLastError(error)
        
        return {
          success: false,
          error: error.message,
          data: { 
            failedCount: failedDeletes.length,
            successCount: productIds.length - failedDeletes.length,
            failedProducts: failedProductIds
          }
        }
      }

      await refreshData()
      clearSelection()
      
      return {
        success: true,
        data: { deletedCount: productIds.length }
      }
    } catch (error) {
      const productError = handleProductError(error, 'bulk delete products')
      setLastError(productError)
      
      return {
        success: false,
        error: productError.message
      }
    }
  }, [debouncedBulkDelete, refreshData, clearSelection, handleProductError])

  // Filtros avanzados
  const applyAdvancedFilters = useCallback((newFilters: ProductFilters) => {
    setFilters(newFilters)
    setPagination(prev => ({ ...prev, page: 1 })) // Reset a primera página
  }, [setFilters, setPagination])

  // Información de paginación mejorada
  const paginationInfo = useMemo(() => ({
    ...pagination,
    totalCount,
    totalPages: Math.ceil(totalCount / pagination.limit),
    hasNextPage: pagination.page < Math.ceil(totalCount / pagination.limit),
    hasPrevPage: pagination.page > 1,
    startItem: (pagination.page - 1) * pagination.limit + 1,
    endItem: Math.min(pagination.page * pagination.limit, totalCount)
  }), [pagination, totalCount])

  // Funciones de recuperación de errores
  const retryLastOperation = useCallback(async () => {
    if (!lastError || !lastError.retryable) {
      return { success: false, error: 'No hay operación para reintentar' }
    }

    setLastError(null)
    
    // Aquí podrías implementar lógica específica para reintentar
    // basada en el tipo de error y operación
    try {
      await refreshData()
      return { success: true }
    } catch (error) {
      const productError = handleProductError(error, 'retry operation')
      setLastError(productError)
      return { success: false, error: productError.message }
    }
  }, [lastError, refreshData, handleProductError])

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
      memoryUsage: PerformanceUtils.getMemoryUsage()
    }
  }, [getMetrics])

  // Estado de carga y error mejorado
  const enhancedLoadingState: LoadingState & { lastError: ProductError | null } = useMemo(() => ({
    loading: loading || bulkOperationLoading,
    error: error || lastError,
    lastError
  }), [loading, bulkOperationLoading, error, lastError])

  return {
    // Datos
    products: processedProducts,
    categories,
    suppliers,
    totalCount,
    
    // Estados
    loadingState: enhancedLoadingState,
    
    // Filtros y ordenamiento
    filters,
    sort,
    pagination: paginationInfo,
    setFilters,
    setSort,
    setPagination,
    applyAdvancedFilters,
    
    // Operaciones CRUD
    createProduct,
    updateProduct,
    deleteProduct,
    refreshData,
    
    // Selección
    selectedProducts,
    selectProduct,
    selectAllProducts,
    clearSelection,
    
    // Operaciones en lote
    bulkUpdateProducts,
    bulkDeleteProducts,
    
    // Manejo de errores
    lastError,
    retryLastOperation,
    clearError,
    
    // Utilidades
    fetchProducts,
    loadProducts,
    validateProductData,
    validateProductIds,
    
    // Rendimiento
    getPerformanceReport,
    clearPerformanceData
  }
}