import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePOS } from '@/hooks/usePOS'
import type { Product } from '@/types/product-unified'

vi.mock('@/contexts/branch-context', () => ({ useBranch: () => ({ selectedBranchId: 'branch-1' }) }))
vi.mock('@/lib/pos-toasts', () => ({ showAddToCartToast: vi.fn() }))

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'product-1', name: 'Remera clásica', sku: 'REM-001', sale_price: 100_000,
  wholesale_price: 80_000, purchase_price: 60_000, stock_quantity: 10, images: [],
  ...overrides,
} as Product)

describe('usePOS current cart contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts with an empty, unpaid cart', () => {
    const { result } = renderHook(() => usePOS())
    expect(result.current.cart).toEqual([])
    expect(result.current.subtotal).toBe(0)
    expect(result.current.total).toBe(0)
    expect(result.current.totalPaid).toBe(0)
    expect(result.current.processing).toBe(false)
  })

  it('adds a product and merges repeated additions by product id', () => {
    const { result } = renderHook(() => usePOS())
    act(() => result.current.addToCart(product(), 2))
    act(() => result.current.addToCart(product(), 1))
    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0]).toMatchObject({ product_id: 'product-1', quantity: 3, price: 100_000, subtotal: 300_000 })
    expect(result.current.total).toBe(300_000)
  })

  it('does not add more units than available stock', () => {
    const { result } = renderHook(() => usePOS())
    act(() => result.current.addToCart(product({ stock_quantity: 1 }), 2))
    expect(result.current.cart).toEqual([])
  })

  it('updates quantity using the generated cart item id', () => {
    const { result } = renderHook(() => usePOS())
    act(() => result.current.addToCart(product(), 1))
    const itemId = result.current.cart[0].id
    act(() => result.current.updateQuantity(itemId, 4))
    expect(result.current.cart[0]).toMatchObject({ quantity: 4, subtotal: 400_000 })
  })

  it('switches existing items to the wholesale price', () => {
    const { result } = renderHook(() => usePOS())
    act(() => result.current.addToCart(product(), 1))
    act(() => result.current.toggleWholesale())
    expect(result.current.isWholesale).toBe(true)
    expect(result.current.cart[0].price).toBe(80_000)
    expect(result.current.total).toBe(80_000)
  })

  it('calculates split payments and change', () => {
    const { result } = renderHook(() => usePOS())
    act(() => result.current.addToCart(product(), 1))
    act(() => result.current.addPayment({ method: 'cash', amount: 120_000 }))
    expect(result.current.totalPaid).toBe(120_000)
    expect(result.current.change).toBe(20_000)
  })

  it('clears all sale state together', () => {
    const { result } = renderHook(() => usePOS())
    act(() => {
      result.current.addToCart(product(), 1)
      result.current.setCustomer({ id: 'customer-1', name: 'Ana' })
      result.current.addPayment({ method: 'cash', amount: 100_000 })
      result.current.setGlobalDiscount(5)
      result.current.setNotes('Entrega inmediata')
    })
    act(() => result.current.clearCart())
    expect(result.current.cart).toEqual([])
    expect(result.current.customer).toBeNull()
    expect(result.current.paymentSplits).toEqual([])
    expect(result.current.globalDiscount).toBe(0)
    expect(result.current.notes).toBe('')
  })
})
