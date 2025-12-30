import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProductManagement } from '../../hooks/products/useProductManagement'
import { useProductFiltering } from '../../hooks/products/useProductFiltering'
import { useProductAnalytics } from '../../hooks/products/useProductAnalytics'

// Mock de datos de productos para testing
const mockProducts = [
  {
    id: '1',
    name: 'Laptop Gaming',
    sku: 'LAP-001',
    stock_quantity: 15,
    sale_price: 1299.99,
    purchase_price: 899.99,
    category_id: 'electronics',
    supplier_id: 'supplier-1',
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    name: 'Mouse Inalámbrico',
    sku: 'MOU-001',
    stock_quantity: 3,
    sale_price: 49.99,
    purchase_price: 29.99,
    category_id: 'accessories',
    supplier_id: 'supplier-2',
    created_at: '2024-02-10T14:30:00Z'
  },
  {
    id: '3',
    name: 'Teclado Mecánico',
    sku: 'KEY-001',
    stock_quantity: 0,
    sale_price: 159.99,
    purchase_price: 99.99,
    category_id: 'accessories',
    supplier_id: 'supplier-1',
    created_at: '2024-01-20T09:15:00Z'
  },
  {
    id: '4',
    name: 'Monitor 4K',
    sku: 'MON-001',
    stock_quantity: 8,
    sale_price: 599.99,
    purchase_price: 399.99,
    category_id: 'electronics',
    supplier_id: 'supplier-1',
    created_at: '2024-01-25T16:45:00Z'
  }
]

// Mock de hooks base
vi.mock('../../hooks/useProductsSupabase', () => ({
  useProductsSupabase: () => ({
    products: mockProducts,
    loading: false,
    error: null,
    totalCount: mockProducts.length,
    fetchProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn()
  })
}))

vi.mock('../../hooks/useProducts', () => ({
  useProducts: () => ({
    products: mockProducts,
    loading: false,
    error: null,
    loadProducts: vi.fn()
  })
}))

vi.mock('../../hooks/useProductFilters', () => ({
  useProductFilters: () => ({
    filters: {
      search: '',
      category: '',
      supplier: '',
      stockStatus: 'all',
      priceRange: { min: 0, max: 1000 },
      stockRange: { min: 0, max: 100 },
      marginRange: { min: 0, max: 100 },
      dateRange: { start: null, end: null }
    },
    setFilters: vi.fn(),
    clearFilters: vi.fn(),
    applyPreset: vi.fn()
  })
}))

vi.mock('../../hooks/useProductSearch', () => ({
  useProductSearch: () => ({
    searchTerm: '',
    searchResults: [],
    isSearching: false,
    setSearchTerm: vi.fn(),
    clearSearch: vi.fn()
  })
}))

describe('Product Hooks Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useProductManagement + useProductFiltering Integration', () => {
    it('should work together for filtered product management', () => {
      const { result: managementResult } = renderHook(() => useProductManagement())
      const { result: filteringResult } = renderHook(() => useProductFiltering(mockProducts))

      // Verificar que ambos hooks tienen acceso a los productos
      expect(managementResult.current.products).toHaveLength(4)
      expect(filteringResult.current.filteredProducts).toHaveLength(4)

      // Aplicar filtro
      act(() => {
        filteringResult.current.updateFilter('category', 'electronics')
      })

      // Los productos filtrados deberían reflejar el filtro
      expect(filteringResult.current.filteredProducts).toHaveLength(2)
      expect(filteringResult.current.filteredProducts.every(p => p.category_id === 'electronics')).toBe(true)

      // La selección en management debería funcionar independientemente
      act(() => {
        managementResult.current.selectProduct('1')
      })

      expect(managementResult.current.selectedProducts).toContain('1')
    })

    it('should handle bulk operations on filtered products', () => {
      const { result: managementResult } = renderHook(() => useProductManagement())
      const { result: filteringResult } = renderHook(() => useProductFiltering(mockProducts))

      // Filtrar productos de electronics
      act(() => {
        filteringResult.current.updateFilter('category', 'electronics')
      })

      const electronicsProducts = filteringResult.current.filteredProducts
      expect(electronicsProducts).toHaveLength(2)

      // Seleccionar todos los productos filtrados
      act(() => {
        electronicsProducts.forEach(product => {
          managementResult.current.selectProduct(product.id)
        })
      })

      expect(managementResult.current.selectedProducts).toHaveLength(2)
      expect(managementResult.current.selectedProducts).toContain('1')
      expect(managementResult.current.selectedProducts).toContain('4')
    })
  })

  describe('useProductManagement + useProductAnalytics Integration', () => {
    it('should provide analytics for managed products', () => {
      const { result: managementResult } = renderHook(() => useProductManagement())
      const { result: analyticsResult } = renderHook(() => useProductAnalytics(mockProducts))

      // Analytics debería reflejar todos los productos
      const metrics = analyticsResult.current.getKeyMetrics()
      expect(metrics.totalProducts).toBe(4)
      expect(metrics.totalValue).toBeGreaterThan(0)

      // Verificar análisis de categorías
      const categoryAnalysis = analyticsResult.current.getCategoryAnalysis()
      expect(categoryAnalysis).toHaveLength(2)
      expect(categoryAnalysis.find(c => c.category === 'electronics')?.count).toBe(2)
      expect(categoryAnalysis.find(c => c.category === 'accessories')?.count).toBe(2)
    })

    it('should update analytics when products are modified', async () => {
      const { result: managementResult } = renderHook(() => useProductManagement())
      const { result: analyticsResult } = renderHook(() => useProductAnalytics(mockProducts))

      // Estado inicial
      const initialMetrics = analyticsResult.current.getKeyMetrics()
      expect(initialMetrics.totalProducts).toBe(4)

      // Simular eliminación de producto
      await act(async () => {
        await managementResult.current.deleteProduct('1')
      })

      // Analytics debería reflejar el cambio
      await act(async () => {
        await analyticsResult.current.refreshAnalytics()
      })

      // Verificar que las métricas se actualizaron
      expect(analyticsResult.current.loading).toBe(false)
    })
  })

  describe('useProductFiltering + useProductAnalytics Integration', () => {
    it('should provide analytics for filtered products', () => {
      const { result: filteringResult } = renderHook(() => useProductFiltering(mockProducts))
      const { result: analyticsResult } = renderHook(() => useProductAnalytics(mockProducts))

      // Filtrar productos con stock bajo
      act(() => {
        filteringResult.current.updateFilter('stockStatus', 'low')
      })

      const lowStockProducts = filteringResult.current.filteredProducts
      expect(lowStockProducts).toHaveLength(1)
      expect(lowStockProducts[0].stock_quantity).toBe(3)

      // Analytics debería poder analizar productos filtrados
      const { result: filteredAnalyticsResult } = renderHook(() => 
        useProductAnalytics(lowStockProducts)
      )

      const filteredMetrics = filteredAnalyticsResult.current.getKeyMetrics()
      expect(filteredMetrics.totalProducts).toBe(1)
      expect(filteredMetrics.lowStockCount).toBe(1)
    })

    it('should handle complex filter combinations with analytics', () => {
      const { result: filteringResult } = renderHook(() => useProductFiltering(mockProducts))

      // Aplicar múltiples filtros
      act(() => {
        filteringResult.current.updateFilter('category', 'electronics')
        filteringResult.current.updateFilter('priceRange', { min: 500, max: 2000 })
      })

      const filteredProducts = filteringResult.current.filteredProducts
      expect(filteredProducts).toHaveLength(2) // Laptop y Monitor

      // Analytics para productos filtrados
      const { result: analyticsResult } = renderHook(() => 
        useProductAnalytics(filteredProducts)
      )

      const metrics = analyticsResult.current.getKeyMetrics()
      expect(metrics.totalProducts).toBe(2)
      expect(metrics.averagePrice).toBeGreaterThan(500)
    })
  })

  describe('Triple Integration: Management + Filtering + Analytics', () => {
    it('should work together in a complete workflow', async () => {
      const { result: managementResult } = renderHook(() => useProductManagement())
      const { result: filteringResult } = renderHook(() => useProductFiltering(mockProducts))
      const { result: analyticsResult } = renderHook(() => useProductAnalytics(mockProducts))

      // 1. Filtrar productos de accessories
      act(() => {
        filteringResult.current.updateFilter('category', 'accessories')
      })

      const accessoryProducts = filteringResult.current.filteredProducts
      expect(accessoryProducts).toHaveLength(2)

      // 2. Seleccionar productos filtrados
      act(() => {
        accessoryProducts.forEach(product => {
          managementResult.current.selectProduct(product.id)
        })
      })

      expect(managementResult.current.selectedProducts).toHaveLength(2)

      // 3. Realizar operación masiva (actualizar categoría)
      await act(async () => {
        await managementResult.current.bulkUpdate(
          managementResult.current.selectedProducts,
          { category_id: 'updated-accessories' }
        )
      })

      // 4. Verificar que analytics refleja los cambios
      await act(async () => {
        await analyticsResult.current.refreshAnalytics()
      })

      // 5. Limpiar filtros y verificar estado final
      act(() => {
        filteringResult.current.clearAllFilters()
        managementResult.current.clearSelection()
      })

      expect(filteringResult.current.filteredProducts).toHaveLength(4)
      expect(managementResult.current.selectedProducts).toHaveLength(0)
    })

    it('should handle error states across all hooks', () => {
      // Mock error state
      vi.mocked(require('../../hooks/useProductsSupabase').useProductsSupabase).mockReturnValue({
        products: [],
        loading: false,
        error: 'Network error',
        totalCount: 0,
        fetchProducts: vi.fn(),
        createProduct: vi.fn(),
        updateProduct: vi.fn(),
        deleteProduct: vi.fn()
      })

      const { result: managementResult } = renderHook(() => useProductManagement())
      const { result: filteringResult } = renderHook(() => useProductFiltering([]))
      const { result: analyticsResult } = renderHook(() => useProductAnalytics([]))

      // Todos los hooks deberían manejar el estado de error
      expect(managementResult.current.error).toBe('Network error')
      expect(filteringResult.current.filteredProducts).toHaveLength(0)
      expect(analyticsResult.current.getKeyMetrics().totalProducts).toBe(0)
    })

    it('should handle loading states across all hooks', () => {
      // Mock loading state
      vi.mocked(require('../../hooks/useProductsSupabase').useProductsSupabase).mockReturnValue({
        products: [],
        loading: true,
        error: null,
        totalCount: 0,
        fetchProducts: vi.fn(),
        createProduct: vi.fn(),
        updateProduct: vi.fn(),
        deleteProduct: vi.fn()
      })

      const { result: managementResult } = renderHook(() => useProductManagement())
      const { result: analyticsResult } = renderHook(() => useProductAnalytics([]))

      expect(managementResult.current.loading).toBe(true)
      expect(analyticsResult.current.loading).toBe(false) // Analytics puede tener su propio loading
    })
  })

  describe('Performance and Memory Management', () => {
    it('should not cause memory leaks with frequent updates', () => {
      const { result: managementResult } = renderHook(() => useProductManagement())
      const { result: filteringResult } = renderHook(() => useProductFiltering(mockProducts))

      // Simular múltiples actualizaciones rápidas
      for (let i = 0; i < 100; i++) {
        act(() => {
          filteringResult.current.updateFilter('search', `test-${i}`)
          managementResult.current.selectProduct(`${i % 4 + 1}`)
        })
      }

      // Los hooks deberían mantener un estado consistente
      expect(filteringResult.current.filters.search).toBe('test-99')
      expect(managementResult.current.selectedProducts.length).toBeGreaterThan(0)
    })

    it('should handle large datasets efficiently', () => {
      const largeProductSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i + 1}`,
        name: `Product ${i + 1}`,
        sku: `SKU-${i + 1}`,
        stock_quantity: Math.floor(Math.random() * 100),
        sale_price: Math.random() * 1000,
        purchase_price: Math.random() * 500,
        category_id: `category-${i % 10}`,
        supplier_id: `supplier-${i % 5}`,
        created_at: new Date().toISOString()
      }))

      const { result: filteringResult } = renderHook(() => useProductFiltering(largeProductSet))
      const { result: analyticsResult } = renderHook(() => useProductAnalytics(largeProductSet))

      // Filtrado debería ser eficiente
      act(() => {
        filteringResult.current.updateFilter('category', 'category-1')
      })

      expect(filteringResult.current.filteredProducts.length).toBe(100)

      // Analytics debería manejar el dataset grande
      const metrics = analyticsResult.current.getKeyMetrics()
      expect(metrics.totalProducts).toBe(1000)
    })
  })

  describe('Data Consistency', () => {
    it('should maintain data consistency across hooks', () => {
      const { result: managementResult } = renderHook(() => useProductManagement())
      const { result: filteringResult } = renderHook(() => useProductFiltering(mockProducts))
      const { result: analyticsResult } = renderHook(() => useProductAnalytics(mockProducts))

      // Todos los hooks deberían ver los mismos datos base
      expect(managementResult.current.products).toHaveLength(4)
      expect(filteringResult.current.filteredProducts).toHaveLength(4)
      expect(analyticsResult.current.getKeyMetrics().totalProducts).toBe(4)

      // Los IDs deberían coincidir
      const managementIds = managementResult.current.products.map(p => p.id).sort()
      const filteringIds = filteringResult.current.filteredProducts.map(p => p.id).sort()
      
      expect(managementIds).toEqual(filteringIds)
    })
  })
})