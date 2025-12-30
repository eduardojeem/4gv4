import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProductManagement } from './useProductManagement'

// Mock de los hooks base
vi.mock('../useProductsSupabase', () => ({
  useProductsSupabase: () => ({
    products: [
      {
        id: '1',
        name: 'Test Product 1',
        sku: 'TEST-001',
        stock_quantity: 10,
        sale_price: 99.99,
        purchase_price: 59.99
      },
      {
        id: '2',
        name: 'Test Product 2',
        sku: 'TEST-002',
        stock_quantity: 5,
        sale_price: 149.99,
        purchase_price: 89.99
      }
    ],
    loading: false,
    error: null,
    totalCount: 2,
    fetchProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn()
  })
}))

vi.mock('../useProducts', () => ({
  useProducts: () => ({
    products: [],
    loading: false,
    error: null,
    loadProducts: vi.fn()
  })
}))

describe('useProductManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useProductManagement())

    expect(result.current.products).toHaveLength(2)
    expect(result.current.selectedProducts).toHaveLength(0)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.totalCount).toBe(2)
  })

  it('should select and deselect products', () => {
    const { result } = renderHook(() => useProductManagement())

    act(() => {
      result.current.selectProduct('1')
    })

    expect(result.current.selectedProducts).toContain('1')

    act(() => {
      result.current.selectProduct('1')
    })

    expect(result.current.selectedProducts).not.toContain('1')
  })

  it('should select all products', () => {
    const { result } = renderHook(() => useProductManagement())

    act(() => {
      result.current.selectAllProducts()
    })

    expect(result.current.selectedProducts).toHaveLength(2)
    expect(result.current.selectedProducts).toContain('1')
    expect(result.current.selectedProducts).toContain('2')
  })

  it('should clear selection', () => {
    const { result } = renderHook(() => useProductManagement())

    act(() => {
      result.current.selectProduct('1')
      result.current.selectProduct('2')
    })

    expect(result.current.selectedProducts).toHaveLength(2)

    act(() => {
      result.current.clearSelection()
    })

    expect(result.current.selectedProducts).toHaveLength(0)
  })

  it('should handle sorting configuration', () => {
    const { result } = renderHook(() => useProductManagement())

    act(() => {
      result.current.setSortConfig({
        field: 'name',
        direction: 'asc'
      })
    })

    expect(result.current.sortConfig).toEqual({
      field: 'name',
      direction: 'asc'
    })
  })

  it('should handle pagination', () => {
    const { result } = renderHook(() => useProductManagement())

    act(() => {
      result.current.setPagination({
        page: 2,
        limit: 10
      })
    })

    expect(result.current.pagination).toEqual({
      page: 2,
      limit: 10
    })
  })

  it('should handle bulk operations', async () => {
    const { result } = renderHook(() => useProductManagement())

    act(() => {
      result.current.selectProduct('1')
      result.current.selectProduct('2')
    })

    await act(async () => {
      await result.current.bulkDelete(['1', '2'])
    })

    // Verificar que se llamó la función de eliminación
    expect(result.current.selectedProducts).toHaveLength(0)
  })

  it('should handle bulk update', async () => {
    const { result } = renderHook(() => useProductManagement())

    const updateData = { category_id: 'new-category' }

    await act(async () => {
      await result.current.bulkUpdate(['1', '2'], updateData)
    })

    // Verificar que se procesó la actualización masiva
    expect(result.current.selectedProducts).toHaveLength(0)
  })

  it('should refresh products', async () => {
    const { result } = renderHook(() => useProductManagement())

    await act(async () => {
      await result.current.refreshProducts()
    })

    // Verificar que se mantiene el estado correcto después del refresh
    expect(result.current.products).toHaveLength(2)
  })

  it('should handle product creation', async () => {
    const { result } = renderHook(() => useProductManagement())

    const newProduct = {
      name: 'New Product',
      sku: 'NEW-001',
      stock_quantity: 15,
      sale_price: 199.99,
      purchase_price: 119.99
    }

    await act(async () => {
      await result.current.createProduct(newProduct)
    })

    // Verificar que se procesó la creación
    expect(result.current.error).toBe(null)
  })

  it('should handle product update', async () => {
    const { result } = renderHook(() => useProductManagement())

    const updateData = {
      name: 'Updated Product',
      sale_price: 299.99
    }

    await act(async () => {
      await result.current.updateProduct('1', updateData)
    })

    // Verificar que se procesó la actualización
    expect(result.current.error).toBe(null)
  })

  it('should handle product deletion', async () => {
    const { result } = renderHook(() => useProductManagement())

    await act(async () => {
      await result.current.deleteProduct('1')
    })

    // Verificar que se procesó la eliminación
    expect(result.current.error).toBe(null)
  })

  it('should handle sorting with different directions', () => {
    const { result } = renderHook(() => useProductManagement())

    // Ordenar ascendente
    act(() => {
      result.current.setSortConfig({
        field: 'sale_price',
        direction: 'asc'
      })
    })

    expect(result.current.sortConfig.direction).toBe('asc')

    // Cambiar a descendente
    act(() => {
      result.current.setSortConfig({
        field: 'sale_price',
        direction: 'desc'
      })
    })

    expect(result.current.sortConfig.direction).toBe('desc')
  })

  it('should maintain selection state during operations', () => {
    const { result } = renderHook(() => useProductManagement())

    act(() => {
      result.current.selectProduct('1')
    })

    expect(result.current.selectedProducts).toContain('1')

    // Cambiar ordenamiento no debe afectar la selección
    act(() => {
      result.current.setSortConfig({
        field: 'name',
        direction: 'asc'
      })
    })

    expect(result.current.selectedProducts).toContain('1')
  })
})