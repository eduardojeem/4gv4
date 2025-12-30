/**
 * usePOS Hook Tests - Fase 5 Testing & QA
 * Tests para el hook crítico del sistema POS
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePOS } from '@/hooks/usePOS'
import { createMockProduct } from '@/test/setup'

// Mock de servicios externos
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ data: [], error: null })),
      select: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  })
}))

describe('usePOS Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Limpiar localStorage
    localStorage.clear()
  })

  describe('Initial State', () => {
    it('should initialize with empty cart', () => {
      const { result } = renderHook(() => usePOS())
      
      expect(result.current.cart).toEqual([])
      expect(result.current.total).toBe(0)
      expect(result.current.itemCount).toBe(0)
      expect(result.current.isProcessing).toBe(false)
    })

    it('should restore cart from localStorage', () => {
      const savedCart = [
        {
          id: '1',
          product: createMockProduct({ id: '1', price: 100 }),
          quantity: 2,
          subtotal: 200
        }
      ]
      
      localStorage.setItem('pos-cart', JSON.stringify(savedCart))
      
      const { result } = renderHook(() => usePOS())
      
      expect(result.current.cart).toEqual(savedCart)
      expect(result.current.total).toBe(200)
      expect(result.current.itemCount).toBe(2)
    })
  })

  describe('Add to Cart', () => {
    it('should add new product to cart', () => {
      const { result } = renderHook(() => usePOS())
      const product = createMockProduct({ id: '1', price: 100 })
      
      act(() => {
        result.current.addToCart(product, 2)
      })
      
      expect(result.current.cart).toHaveLength(1)
      expect(result.current.cart[0]).toEqual({
        id: '1',
        product,
        quantity: 2,
        subtotal: 200
      })
      expect(result.current.total).toBe(200)
    })

    it('should update quantity if product already exists', () => {
      const { result } = renderHook(() => usePOS())
      const product = createMockProduct({ id: '1', price: 100 })
      
      act(() => {
        result.current.addToCart(product, 1)
      })
      
      act(() => {
        result.current.addToCart(product, 2)
      })
      
      expect(result.current.cart).toHaveLength(1)
      expect(result.current.cart[0].quantity).toBe(3)
      expect(result.current.total).toBe(300)
    })

    it('should handle products with different variants', () => {
      const { result } = renderHook(() => usePOS())
      const product1 = createMockProduct({ id: '1', price: 100, variant: 'small' })
      const product2 = createMockProduct({ id: '1', price: 100, variant: 'large' })
      
      act(() => {
        result.current.addToCart(product1, 1)
      })
      
      act(() => {
        result.current.addToCart(product2, 1)
      })
      
      expect(result.current.cart).toHaveLength(2)
      expect(result.current.total).toBe(200)
    })
  })

  describe('Update Quantity', () => {
    it('should update item quantity', () => {
      const { result } = renderHook(() => usePOS())
      const product = createMockProduct({ id: '1', price: 100 })
      
      act(() => {
        result.current.addToCart(product, 2)
      })
      
      act(() => {
        result.current.updateQuantity('1', 5)
      })
      
      expect(result.current.cart[0].quantity).toBe(5)
      expect(result.current.cart[0].subtotal).toBe(500)
      expect(result.current.total).toBe(500)
    })

    it('should remove item when quantity is 0', () => {
      const { result } = renderHook(() => usePOS())
      const product = createMockProduct({ id: '1', price: 100 })
      
      act(() => {
        result.current.addToCart(product, 2)
      })
      
      act(() => {
        result.current.updateQuantity('1', 0)
      })
      
      expect(result.current.cart).toHaveLength(0)
      expect(result.current.total).toBe(0)
    })

    it('should handle invalid quantities gracefully', () => {
      const { result } = renderHook(() => usePOS())
      const product = createMockProduct({ id: '1', price: 100 })
      
      act(() => {
        result.current.addToCart(product, 2)
      })
      
      act(() => {
        result.current.updateQuantity('1', -1)
      })
      
      // Should not update with negative quantity
      expect(result.current.cart[0].quantity).toBe(2)
    })
  })

  describe('Remove from Cart', () => {
    it('should remove item from cart', () => {
      const { result } = renderHook(() => usePOS())
      const product = createMockProduct({ id: '1', price: 100 })
      
      act(() => {
        result.current.addToCart(product, 2)
      })
      
      act(() => {
        result.current.removeFromCart('1')
      })
      
      expect(result.current.cart).toHaveLength(0)
      expect(result.current.total).toBe(0)
    })

    it('should handle removing non-existent item', () => {
      const { result } = renderHook(() => usePOS())
      
      act(() => {
        result.current.removeFromCart('non-existent')
      })
      
      expect(result.current.cart).toHaveLength(0)
    })
  })

  describe('Clear Cart', () => {
    it('should clear all items from cart', () => {
      const { result } = renderHook(() => usePOS())
      const product1 = createMockProduct({ id: '1', price: 100 })
      const product2 = createMockProduct({ id: '2', price: 50 })
      
      act(() => {
        result.current.addToCart(product1, 1)
        result.current.addToCart(product2, 2)
      })
      
      act(() => {
        result.current.clearCart()
      })
      
      expect(result.current.cart).toHaveLength(0)
      expect(result.current.total).toBe(0)
      expect(result.current.itemCount).toBe(0)
    })
  })

  describe('Process Payment', () => {
    it('should process payment successfully', async () => {
      const { result } = renderHook(() => usePOS())
      const product = createMockProduct({ id: '1', price: 100 })
      
      act(() => {
        result.current.addToCart(product, 1)
      })
      
      let paymentResult: any
      
      await act(async () => {
        paymentResult = await result.current.processPayment({
          method: 'cash',
          amount: 100
        })
      })
      
      expect(paymentResult.success).toBe(true)
      expect(paymentResult.transactionId).toBeDefined()
    })

    it('should handle payment errors', async () => {
      const { result } = renderHook(() => usePOS())
      
      // Mock error en el pago
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Payment failed'))
      
      let paymentResult: any
      
      await act(async () => {
        paymentResult = await result.current.processPayment({
          method: 'card',
          amount: 100
        })
      })
      
      expect(paymentResult.success).toBe(false)
      expect(paymentResult.error).toBeDefined()
    })

    it('should set processing state during payment', async () => {
      const { result } = renderHook(() => usePOS())
      
      const paymentPromise = act(async () => {
        return result.current.processPayment({
          method: 'cash',
          amount: 100
        })
      })
      
      // Durante el procesamiento
      expect(result.current.isProcessing).toBe(true)
      
      await paymentPromise
      
      // Después del procesamiento
      expect(result.current.isProcessing).toBe(false)
    })
  })

  describe('Persistence', () => {
    it('should save cart to localStorage on changes', () => {
      const { result } = renderHook(() => usePOS())
      const product = createMockProduct({ id: '1', price: 100 })
      
      act(() => {
        result.current.addToCart(product, 1)
      })
      
      const savedCart = JSON.parse(localStorage.getItem('pos-cart') || '[]')
      expect(savedCart).toHaveLength(1)
      expect(savedCart[0].product.id).toBe('1')
    })

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage error
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage full')
      })
      
      const { result } = renderHook(() => usePOS())
      const product = createMockProduct({ id: '1', price: 100 })
      
      // Should not throw error
      expect(() => {
        act(() => {
          result.current.addToCart(product, 1)
        })
      }).not.toThrow()
      
      // Restore original function
      localStorage.setItem = originalSetItem
    })
  })

  describe('Performance', () => {
    it('should calculate totals efficiently', () => {
      const { result } = renderHook(() => usePOS())
      
      // Add many items
      act(() => {
        for (let i = 1; i <= 100; i++) {
          const product = createMockProduct({ id: `${i}`, price: i })
          result.current.addToCart(product, 1)
        }
      })
      
      // Total should be calculated correctly
      const expectedTotal = Array.from({ length: 100 }, (_, i) => i + 1).reduce((a, b) => a + b, 0)
      expect(result.current.total).toBe(expectedTotal)
      expect(result.current.itemCount).toBe(100)
    })

    it('should debounce localStorage updates', async () => {
      const setItemSpy = vi.spyOn(localStorage, 'setItem')
      const { result } = renderHook(() => usePOS())
      const product = createMockProduct({ id: '1', price: 100 })
      
      // Multiple rapid updates
      act(() => {
        result.current.addToCart(product, 1)
        result.current.updateQuantity('1', 2)
        result.current.updateQuantity('1', 3)
      })
      
      await waitFor(() => {
        // Should debounce and only save once
        expect(setItemSpy).toHaveBeenCalledTimes(1)
      })
    })
  })
})