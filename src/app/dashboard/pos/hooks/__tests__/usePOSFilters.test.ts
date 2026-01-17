/**
 * Tests para usePOSFilters hook
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { usePOSFilters } from '../usePOSFilters'
import type { Product } from '@/types/product-unified'

const mockProducts: Product[] = [
  {
    id: '1',
    name: 'iPhone 13',
    sku: 'IP13-001',
    barcode: '1234567890123',
    sale_price: 999,
    stock_quantity: 10,
    category: { id: '1', name: 'Smartphones' }
  },
  {
    id: '2',
    name: 'Samsung Galaxy S21',
    sku: 'SG21-001',
    barcode: '1234567890124',
    sale_price: 799,
    stock_quantity: 5,
    category: { id: '1', name: 'Smartphones' }
  },
  {
    id: '3',
    name: 'MacBook Pro',
    sku: 'MBP-001',
    barcode: '1234567890125',
    sale_price: 2499,
    stock_quantity: 0,
    category: { id: '2', name: 'Laptops' }
  },
  {
    id: '4',
    name: 'iPad Air',
    sku: 'IPA-001',
    barcode: '1234567890126',
    sale_price: 599,
    stock_quantity: 15,
    category: { id: '3', name: 'Tablets' }
  }
] as Product[]

describe('usePOSFilters', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    expect(result.current.state.searchTerm).toBe('')
    expect(result.current.state.selectedCategory).toBe('all')
    expect(result.current.state.showFeatured).toBe(false)
    expect(result.current.state.sortBy).toBe('name')
    expect(result.current.state.sortOrder).toBe('asc')
    expect(result.current.state.currentPage).toBe(1)
  })

  it('should filter products by search term', async () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    act(() => {
      result.current.actions.setSearchTerm('iPhone')
    })
    
    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 350))
    
    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].name).toBe('iPhone 13')
  })

  it('should filter products by category', () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    act(() => {
      result.current.actions.setSelectedCategory('Smartphones')
    })
    
    expect(result.current.filteredProducts).toHaveLength(2)
  })

  it('should filter products by stock status', () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    act(() => {
      result.current.actions.setStockFilter('out_of_stock')
    })
    
    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].name).toBe('MacBook Pro')
  })

  it('should filter products by low stock', () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    act(() => {
      result.current.actions.setStockFilter('low_stock')
    })
    
    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].name).toBe('Samsung Galaxy S21')
  })

  it('should sort products by price ascending', () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    act(() => {
      result.current.actions.setSortBy('price')
      result.current.actions.setSortOrder('asc')
    })
    
    const prices = result.current.filteredProducts.map(p => p.sale_price)
    expect(prices).toEqual([599, 799, 999, 2499])
  })

  it('should sort products by price descending', () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    act(() => {
      result.current.actions.setSortBy('price')
      result.current.actions.setSortOrder('desc')
    })
    
    const prices = result.current.filteredProducts.map(p => p.sale_price)
    expect(prices).toEqual([2499, 999, 799, 599])
  })

  it('should paginate products correctly', () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    act(() => {
      result.current.actions.setItemsPerPage(2)
    })
    
    expect(result.current.paginatedProducts).toHaveLength(2)
    expect(result.current.totalPages).toBe(2)
    
    act(() => {
      result.current.actions.setCurrentPage(2)
    })
    
    expect(result.current.paginatedProducts).toHaveLength(2)
  })

  it('should reset page when filters change', () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    act(() => {
      result.current.actions.setCurrentPage(2)
    })
    
    expect(result.current.state.currentPage).toBe(2)
    
    act(() => {
      result.current.actions.setSelectedCategory('Smartphones')
    })
    
    expect(result.current.state.currentPage).toBe(1)
  })

  it('should reset all filters', () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    act(() => {
      result.current.actions.setSearchTerm('test')
      result.current.actions.setSelectedCategory('Smartphones')
      result.current.actions.setShowFeatured(true)
      result.current.actions.setSortBy('price')
    })
    
    act(() => {
      result.current.actions.resetFilters()
    })
    
    expect(result.current.state.searchTerm).toBe('')
    expect(result.current.state.selectedCategory).toBe('all')
    expect(result.current.state.showFeatured).toBe(false)
    expect(result.current.state.sortBy).toBe('name')
  })

  it('should extract unique categories', () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    expect(result.current.categories).toContain('all')
    expect(result.current.categories).toContain('Smartphones')
    expect(result.current.categories).toContain('Laptops')
    expect(result.current.categories).toContain('Tablets')
  })

  it('should calculate price range limits', () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    expect(result.current.priceRangeLimits.min).toBe(599)
    expect(result.current.priceRangeLimits.max).toBe(2499)
  })

  it('should filter by price range', () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    act(() => {
      result.current.actions.setPriceRange({ min: 700, max: 1000 })
    })
    
    expect(result.current.filteredProducts).toHaveLength(2)
    expect(result.current.filteredProducts.map(p => p.name)).toEqual([
      'iPhone 13',
      'Samsung Galaxy S21'
    ])
  })

  it('should combine multiple filters', () => {
    const { result } = renderHook(() => usePOSFilters(mockProducts))
    
    act(() => {
      result.current.actions.setSelectedCategory('Smartphones')
      result.current.actions.setStockFilter('in_stock')
      result.current.actions.setPriceRange({ min: 0, max: 900 })
    })
    
    expect(result.current.filteredProducts).toHaveLength(1)
    expect(result.current.filteredProducts[0].name).toBe('Samsung Galaxy S21')
  })
})
