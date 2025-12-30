'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useProductsSupabase } from '../useProductsSupabase'
import { useProducts } from '../useProducts'
import { useProductErrorHandler, createProductError, ProductError } from '@/lib/product-errors'
import { useErrorHandler } from '@/lib/error-handling'
import { useDebounce } from '@/lib/notification-performance'
import { 
  usePerformanceMetrics, 
  useAdvancedMemoization, 
  PerformanceUtils,
  DEFAULT_PERFORMANCE_CONFIG,
  type PerformanceConfig
} from '@/lib/performance-optimization'
import type { 
  ProductFilters, 
  ProductSort, 
  PaginationOptions,
  LoadingState,
  OperationResult
} from './types'
import { Product } from '@/types/product-unified'

/**
 * Hook compuesto para gestión completa de productos
 * Combina datos, filtros, CRUD y operaciones en lote con optimizaciones de rendimiento
 */
export function useProductManagement(
  initialFilters: ProductFilters = {},
  initialSort: ProductSort = { field: 'name', direction: 'asc' },
  initialPagination: PaginationOptions = { page: 1, limit: 20 },
  performanceConfig: PerformanceConfig = DEFAULT_PERFORMANCE_CONFIG
) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false)
  const [lastError, setLastError] = useState<ProductError | null>(null)
  
  // Estado para productos procesados
  const [processedProducts, setProcessedProducts] = useState<Product[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // Hooks de rendimiento
  const { recordMetric, getMetrics, clearMetrics } = usePerformanceMetrics()
  // No necesitamos usar memoize aquí directamente, solo la instancia
  const { clear: clearMemoization } = useAdvancedMemoization(() => {}, [], performanceConfig.memoization || {})
  
  // Hooks de manejo de errores

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

    if (product.sale_price !== undefined && product.sale_price < 0) {
      throw createProductError.productValidationFailed(
        { sale_price: 'El precio debe ser mayor o igual a 0' },
        product.id
      )
    }

    if (product.stock_quantity !== undefined && product.stock_quantity < 0) {
      throw createProductError.productValidationFailed(
        { stock_quantity: 'El stock debe ser mayor o igual a 0' },
        product.id
      )
    }

    if (product.sku && products.some(p => p.sku === product.sku && p.id !== product.id)) {
      throw createProductError.duplicateProductId(product.sku)
    }
  }, [products])

  const validateProductIds = useCallback((productIds: string[]): void => {
    if (productIds.length === 0) {
      // @ts-ignore
      throw createProductError.invalidProductData({ message: 'No se proporcionaron IDs de productos' }, undefined)
    }

    const existingIds = new Set(products.map(p => p.id))
    const invalidIds = productIds.filter(id => !existingIds.has(id))
    
    if (invalidIds.length > 0) {
      // @ts-ignore
      throw createProductError.productNotFound(invalidIds[0])
    }
  }, [products])

  // Estado de carga combinado
  const loadingState: LoadingState = useMemo(() => ({
    loading: loading || bulkOperationLoading || isProcessing,
    error
  }), [loading, bulkOperationLoading, isProcessing, error])

  // Productos filtrados y ordenados
  useEffect(() => {
    let mounted = true
    
    const processProducts = async () => {
      if (!mounted) return
      
      const startTime = performance.now()
      setIsProcessing(true)
      
      try {
        if (!products.length) {
          setProcessedProducts([])
          return
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
          result = result.filter(product => product.category_id === filters.category)
        }
        
        if (filters.supplier) {
          result = result.filter(product => product.supplier_id === filters.supplier)
        }
        
        if (filters.priceMin !== undefined) {
          result = result.filter(product => product.sale_price >= filters.priceMin!)
        }

        if (filters.priceMax !== undefined) {
          result = result.filter(product => product.sale_price <= filters.priceMax!)
        }
        
        if (filters.stockStatus) {
          result = result.filter(product => {
            switch (filters.stockStatus) {
              case 'in_stock':
                return product.stock_quantity > 0
              case 'low_stock':
                return product.stock_quantity > 0 && product.stock_quantity <= (product.min_stock || 10)
              case 'out_of_stock':
                return product.stock_quantity === 0
              default:
                return true
            }
          })
        }
        
        if (typeof filters.isActive === 'boolean') {
          result = result.filter(product => product.is_active === filters.isActive)
        }
        
        if (typeof filters.featured === 'boolean') {
          // @ts-ignore
          result = result.filter(product => product.featured === filters.featured)
        }
        
        // Aplicar ordenamiento optimizado
        const largeDatasetThreshold = performanceConfig.optimization?.largeDatasetThreshold || 1000
        if (result.length > largeDatasetThreshold) {
          // Permitir que la UI respire antes de ordenar
          await new Promise(resolve => setTimeout(resolve, 0))
        }

        result.sort((a, b) => {
          const aValue = a[sort.field as keyof Product]
          const bValue = b[sort.field as keyof Product]
          
          if (aValue === bValue) return 0
          if (aValue === null || aValue === undefined) return 1
          if (bValue === null || bValue === undefined) return -1
          
          if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1
          if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1
          return 0
        })
        
        if (mounted) {
          setProcessedProducts(result)
          
          const duration = performance.now() - startTime
          recordMetric({
            operationName: 'product_processing',
            duration,
            timestamp: Date.now(),
            itemCount: products.length
          })
          
          // Alertar si el procesamiento es lento
          const slowOperationThreshold = performanceConfig.optimization?.slowOperationThreshold || 100
          if (duration > slowOperationThreshold) {
            console.warn(`Procesamiento lento de productos: ${duration}ms para ${products.length} productos`)
          }
        }
      } catch (error) {
        console.error('Error processing products:', error)
      } finally {
        if (mounted) {
          setIsProcessing(false)
        }
      }
    }

    processProducts()
    
    return () => {
      mounted = false
    }
  }, [products, filters, sort, recordMetric, performanceConfig])

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

  // Operaciones en lote optimizadas
  const bulkUpdateProducts = useCallback(async (
    productIds: string[],
    updates: Partial<Product>
  ): Promise<OperationResult> => {
    try {
      setBulkOperationLoading(true)
      setLastError(null)

      // Validaciones
      validateProductIds(productIds)
      validateProductData(updates)

      // Verificar rendimiento para datasets grandes
      const largeDatasetThreshold = performanceConfig.optimization?.largeDatasetThreshold || 1000
      if (productIds.length > largeDatasetThreshold) {
        const warning = createProductError.largeDatasetWarning(productIds.length, largeDatasetThreshold)
        console.warn('Bulk operation warning:', warning.message)
      }

      const startTime = performance.now()

      // Procesar en chunks para mejor rendimiento
      const results = await PerformanceUtils.processArrayAsync(
        productIds,
        async (chunk) => {
          // @ts-ignore
          const promises = chunk.map(async (id: string) => {
            try {
              // Cast updates to any to bypass Partial<Product> vs Update type mismatch
              // Supabase client should handle the partial update correctly
              return await updateProduct(id, updates as any)
            } catch (error) {
              const productError = handleProductError(error, `bulk update product ${id}`)
              return { success: false, error: productError.message, productId: id }
            }
          })
          return Promise.all(promises)
        },
        performanceConfig.optimization?.chunkSize || 100
      )

      // Process the nested arrays manually to avoid TypeScript confusion
      const chunkResults = results as unknown as any[][]
      const flatResults = chunkResults.flat()
      const duration = performance.now() - startTime
      
      recordMetric({
        operationName: 'bulk_update',
        duration,
        timestamp: Date.now(),
        itemCount: productIds.length
      })

      const slowOperationThreshold = performanceConfig.optimization?.slowOperationThreshold || 100
      if (duration > slowOperationThreshold) {
        const warning = createProductError.slowOperationWarning('bulk update', duration, slowOperationThreshold)
        console.warn('Performance warning:', warning.message)
      }

      // @ts-ignore
      const failedUpdates = flatResults.filter(result => !result.success)
      const failedProductIds = failedUpdates
        .map((result: any) => result.productId || result.data?.id)
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
    } finally {
      setBulkOperationLoading(false)
    }
  }, [validateProductIds, validateProductData, performanceConfig, updateProduct, handleProductError, recordMetric, refreshData, clearSelection])

  const bulkDeleteProducts = useCallback(async (
    productIds: string[]
  ): Promise<OperationResult> => {
    try {
      setBulkOperationLoading(true)
      setLastError(null)

      // Validaciones
      validateProductIds(productIds)

      // Verificar rendimiento para datasets grandes
      const largeDatasetThreshold = performanceConfig.optimization?.largeDatasetThreshold || 1000
      if (productIds.length > largeDatasetThreshold) {
        const warning = createProductError.largeDatasetWarning(productIds.length, largeDatasetThreshold)
        console.warn('Bulk delete warning:', warning.message)
      }

      const startTime = performance.now()

      // Procesar en chunks para mejor rendimiento
      const results = await PerformanceUtils.processArrayAsync(
        productIds,
        async (chunk) => {
          // @ts-ignore
          const promises = chunk.map(async (id: string) => {
            try {
              return await deleteProduct(id)
            } catch (error) {
              const productError = handleProductError(error, `bulk delete product ${id}`)
              return { success: false, error: productError.message, productId: id }
            }
          })
          return Promise.all(promises)
        },
        performanceConfig.optimization?.chunkSize || 100
      )

      // Process the nested arrays manually to avoid TypeScript confusion
      const chunkResults = results as unknown as any[][]
      const flatResults = chunkResults.flat()
      const duration = performance.now() - startTime
      
      recordMetric({
        operationName: 'bulk_delete',
        duration,
        timestamp: Date.now(),
        itemCount: productIds.length
      })

      const slowOperationThreshold = performanceConfig.optimization?.slowOperationThreshold || 100
      if (duration > slowOperationThreshold) {
        const warning = createProductError.slowOperationWarning('bulk delete', duration, slowOperationThreshold)
        console.warn('Performance warning:', warning.message)
      }

      // @ts-ignore
      const failedDeletes = flatResults.filter(result => !result.success)
      const failedProductIds = failedDeletes
        .map((result: any) => result.productId || result.data?.id)
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
    } finally {
      setBulkOperationLoading(false)
    }
  }, [validateProductIds, performanceConfig, deleteProduct, handleProductError, recordMetric, refreshData, clearSelection])

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
    loading: loading || bulkOperationLoading || isProcessing,
    error: (error || lastError ? String(error || lastError) : null),
    lastError
  }), [loading, bulkOperationLoading, isProcessing, error, lastError])

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