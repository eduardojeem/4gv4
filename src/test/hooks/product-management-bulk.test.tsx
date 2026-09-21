import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProductManagement } from '@/hooks/products/useProductManagement'

const mocks = vi.hoisted(() => ({
  update: vi.fn(), remove: vi.fn(), refresh: vi.fn(),
  products: [{ id: 'p1', name: 'Cable', sale_price: 10, stock_quantity: 3, sku: 'C1' }, { id: 'p2', name: 'Funda', sale_price: 15, stock_quantity: 4, sku: 'F1' }],
  filters: {}, sort: { field: 'name', direction: 'asc' }, pagination: { page: 1, limit: 20 },
  handleError: (error: Error) => error,
}))
vi.mock('@/hooks/useProductsSupabase', () => ({ useProductsSupabase: () => ({
  products: mocks.products, categories: [], suppliers: [], filters: mocks.filters,
  sort: mocks.sort, pagination: mocks.pagination, totalCount: 2, loading: false,
  updateProduct: mocks.update, deleteProduct: mocks.remove, refreshData: mocks.refresh,
}) }))
vi.mock('@/hooks/useProducts', () => ({ useProducts: () => ({}) }))
vi.mock('@/lib/error-handling', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/error-handling')>(),
  useErrorHandler: () => ({}),
}))
vi.mock('@/lib/product-errors', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/product-errors')>(),
  useProductErrorHandler: () => ({ handleProductError: mocks.handleError }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.update.mockResolvedValue({ success: true })
  mocks.remove.mockResolvedValue({ success: true })
  mocks.refresh.mockResolvedValue(undefined)
})

describe('operaciones de productos por lote', () => {
  it('actualiza cada producto y admite cambios parciales sin exigir el nombre', async () => {
    const { result } = renderHook(() => useProductManagement())
    await act(async () => {
      expect(await result.current.bulkUpdateProducts(['p1', 'p2'], { sale_price: 20 })).toMatchObject({ success: true, data: { updatedCount: 2 } })
    })
    expect(mocks.update).toHaveBeenCalledWith('p1', { sale_price: 20 })
    expect(mocks.update).toHaveBeenCalledWith('p2', { sale_price: 20 })
  })

  it('identifica el producto que no pudo eliminarse en un lote parcial', async () => {
    mocks.remove.mockImplementation(async (id: string) => ({ success: id === 'p1', error: id === 'p2' ? 'Tiene ventas' : undefined }))
    const { result } = renderHook(() => useProductManagement())
    await act(async () => {
      expect(await result.current.bulkDeleteProducts(['p1', 'p2'])).toMatchObject({ success: false, data: { failedCount: 1, successCount: 1, failedProducts: ['p2'] } })
    })
    expect(mocks.remove).toHaveBeenCalledTimes(2)
  })
})
