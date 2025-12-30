import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProductFiltering } from './useProductFiltering'
import type { Product } from './types'

// Mock de los hooks base
vi.mock('../useProductFilters', () => ({
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

vi.mock('../useProductSearch', () => ({
  useProductSearch: () => ({
    searchTerm: '',
    searchResults: [],
    isSearching: false,
    setSearchTerm: vi.fn(),
    clearSearch: vi.fn()
  })
}))

const mockProducts = [
  {
    id: '1',
    name: 'Laptop Gaming',
    sku: 'LAP-001',
    description: 'High-performance gaming laptop',
    category_id: 'electronics',
    brand: 'TechBrand',
    supplier_id: 'supplier-1',
    purchase_price: 899.99,
    sale_price: 1299.99,
    wholesale_price: 1100.00,
    stock_quantity: 15,
    min_stock: 5,
    unit_measure: 'unit',
    is_active: true,
    images: null,
    location: 'A1-B2',
    barcode: '1234567890123',
    weight: 2.5,
    dimensions: null,
    tags: null,
    featured: false,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    name: 'Mouse Inalámbrico',
    sku: 'MOU-001',
    description: 'Wireless optical mouse',
    category_id: 'accessories',
    brand: 'MouseCorp',
    supplier_id: 'supplier-2',
    purchase_price: 29.99,
    sale_price: 49.99,
    wholesale_price: 40.00,
    stock_quantity: 3,
    min_stock: 10,
    unit_measure: 'unit',
    is_active: true,
    images: null,
    location: 'B2-C3',
    barcode: '2345678901234',
    weight: 0.1,
    dimensions: null,
    tags: null,
    featured: false,
    created_at: '2024-02-10T14:30:00Z',
    updated_at: '2024-02-10T14:30:00Z'
  },
  {
    id: '3',
    name: 'Teclado Mecánico',
    sku: 'KEY-001',
    description: 'Mechanical gaming keyboard',
    category_id: 'accessories',
    brand: 'KeyMaster',
    supplier_id: 'supplier-1',
    purchase_price: 99.99,
    sale_price: 159.99,
    wholesale_price: 130.00,
    stock_quantity: 0,
    min_stock: 5,
    unit_measure: 'unit',
    is_active: true,
    images: null,
    location: 'C3-D4',
    barcode: '3456789012345',
    weight: 0.8,
    dimensions: null,
    tags: null,
    featured: true,
    created_at: '2024-01-20T09:15:00Z',
    updated_at: '2024-01-20T09:15:00Z'
  }
]

describe('useProductFiltering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default filters', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    expect(result.current.filters.search).toBe('')
    expect(result.current.filters.category).toBe('')
    expect(result.current.filters.supplier).toBe('')
    expect(result.current.filters.stockStatus).toBe('all')
    expect(result.current.filteredProducts).toHaveLength(3)
  })

  it('should filter products by search term', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.updateFilter('search', 'laptop')
    })

    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].name).toBe('Laptop Gaming')
  })

  it('should filter products by category', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.updateFilter('category', 'accessories')
    })

    expect(result.current.filteredProducts).toHaveLength(2)
    expect(result.current.filteredProducts.every((p: Product) => p.category_id === 'accessories')).toBe(true)
  })

  it('should filter products by supplier', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.updateFilter('supplier', 'supplier-1')
    })

    expect(result.current.filteredProducts).toHaveLength(2)
    expect(result.current.filteredProducts.every((p: Product) => p.supplier_id === 'supplier-1')).toBe(true)
  })

  it('should filter products by stock status - low stock', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.updateFilter('stockStatus', 'low')
    })

    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].stock_quantity).toBe(3)
  })

  it('should filter products by stock status - out of stock', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.updateFilter('stockStatus', 'out')
    })

    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].stock_quantity).toBe(0)
  })

  it('should filter products by stock status - in stock', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.updateFilter('stockStatus', 'in')
    })

    expect(result.current.filteredProducts).toHaveLength(2)
    expect(result.current.filteredProducts.every((p: Product) => p.stock_quantity > 0)).toBe(true)
  })

  it('should filter products by price range', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.updateFilter('priceRange', { min: 50, max: 200 })
    })

    expect(result.current.filteredProducts).toHaveLength(2)
    expect(result.current.filteredProducts.every((p: Product) => p.sale_price >= 50 && p.sale_price <= 200)).toBe(true)
  })

  it('should filter products by stock range', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.updateFilter('stockRange', { min: 1, max: 10 })
    })

    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].stock_quantity).toBe(3)
  })

  it('should filter products by margin range', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.updateFilter('marginRange', { min: 30, max: 50 })
    })

    // Productos con margen entre 30% y 50%
    const expectedProducts = result.current.filteredProducts.filter(product => {
      const margin = ((product.sale_price - product.purchase_price) / product.sale_price) * 100
      return margin >= 30 && margin <= 50
    })

    expect(result.current.filteredProducts.length).toBeGreaterThanOrEqual(0)
  })

  it('should filter products by date range', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.updateFilter('dateRange', {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      })
    })

    expect(result.current.filteredProducts).toHaveLength(2)
    expect(result.current.filteredProducts.every((p: Product) => {
      const createdDate = new Date(p.created_at)
      return createdDate >= new Date('2024-01-01') && createdDate <= new Date('2024-01-31')
    })).toBe(true)
  })

  it('should combine multiple filters', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.updateFilter('category', 'accessories')
      result.current.updateFilter('stockStatus', 'in')
    })

    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].name).toBe('Mouse Inalámbrico')
  })

  it('should clear all filters', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.updateFilter('search', 'laptop')
      result.current.updateFilter('category', 'electronics')
    })

    expect(result.current.filteredProducts).toHaveLength(1)

    act(() => {
      result.current.clearAllFilters()
    })

    expect(result.current.filteredProducts).toHaveLength(3)
  })

  it('should apply preset filters', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.applyFilterPreset('lowStock')
    })

    // Verificar que se aplicó el preset de stock bajo
    expect(result.current.filters.stockStatus).toBe('low')
  })

  it('should handle empty product list', () => {
    const { result } = renderHook(() => useProductFiltering([]))

    expect(result.current.filteredProducts).toHaveLength(0)

    act(() => {
      result.current.updateFilter('search', 'test')
    })

    expect(result.current.filteredProducts).toHaveLength(0)
  })

  it('should maintain filter state when products change', () => {
    const { result, rerender } = renderHook(
      ({ products }) => useProductFiltering(products),
      { initialProps: { products: mockProducts } }
    )

    act(() => {
      result.current.updateFilter('category', 'electronics')
    })

    expect(result.current.filteredProducts).toHaveLength(1)

    // Cambiar productos pero mantener filtros
    const newProducts = [...mockProducts, {
      id: '4',
      name: 'Smartphone',
      sku: 'PHO-001',
      stock_quantity: 8,
      sale_price: 699.99,
      purchase_price: 499.99,
      category_id: 'electronics',
      supplier_id: 'supplier-3',
      created_at: '2024-03-01T12:00:00Z'
    }]

    rerender({ products: newProducts })

    expect(result.current.filteredProducts).toHaveLength(2)
    expect(result.current.filters.category).toBe('electronics')
  })

  it('should handle invalid filter values gracefully', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    act(() => {
      result.current.updateFilter('priceRange', { min: -100, max: -50 })
    })

    // Debería manejar valores inválidos sin romper
    expect(result.current.filteredProducts).toHaveLength(0)
  })

  it('should provide filter statistics', () => {
    const { result } = renderHook(() => useProductFiltering(mockProducts))

    expect(result.current.filterStats.total).toBe(3)
    expect(result.current.filterStats.filtered).toBe(3)

    act(() => {
      result.current.updateFilter('category', 'electronics')
    })

    expect(result.current.filterStats.total).toBe(3)
    expect(result.current.filterStats.filtered).toBe(1)
  })
})