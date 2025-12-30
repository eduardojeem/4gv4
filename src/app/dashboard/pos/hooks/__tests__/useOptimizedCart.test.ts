import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useOptimizedCart } from '../useOptimizedCart'
import type { Product } from '../../types'

// Mock product data
const mockProduct: Product = {
  id: '1',
  name: 'Test Product',
  sku: 'TEST-001',
  price: 100,
  stock: 10,
  category: 'Electronics',
  description: 'Test product description'
}

const mockProduct2: Product = {
  id: '2',
  name: 'Test Product 2',
  sku: 'TEST-002',
  price: 50,
  stock: 5,
  category: 'Electronics',
  description: 'Second test product'
}

describe('useOptimizedCart', () => {
  it('should initialize with empty cart', () => {
    const { result } = renderHook(() => useOptimizedCart())
    
    expect(result.current.cart).toEqual([])
    expect(result.current.cartTotal).toBe(0)
    expect(result.current.cartSubtotal).toBe(0)
    expect(result.current.cartTax).toBe(0)
    expect(result.current.cartItemCount).toBe(0)
  })

  it('should add product to cart', () => {
    const { result } = renderHook(() => useOptimizedCart())
    
    act(() => {
      result.current.addToCart(mockProduct, 2)
    })
    
    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0]).toEqual({
      id: '1',
      name: 'Test Product',
      price: 100,
      quantity: 2,
      sku: 'TEST-001',
      category: 'Electronics'
    })
    expect(result.current.cartSubtotal).toBe(200)
    expect(result.current.cartItemCount).toBe(2)
  })

  it('should update quantity when adding existing product', () => {
    const { result } = renderHook(() => useOptimizedCart())
    
    act(() => {
      result.current.addToCart(mockProduct, 1)
    })
    
    act(() => {
      result.current.addToCart(mockProduct, 2)
    })
    
    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0].quantity).toBe(3)
    expect(result.current.cartSubtotal).toBe(300)
  })

  it('should respect max quantity per item', () => {
    const { result } = renderHook(() => useOptimizedCart({ maxQuantityPerItem: 5 }))
    
    act(() => {
      result.current.addToCart(mockProduct, 10)
    })
    
    expect(result.current.cart[0].quantity).toBe(5)
  })

  it('should calculate tax correctly', () => {
    const { result } = renderHook(() => useOptimizedCart({ taxRate: 0.1 }))
    
    act(() => {
      result.current.addToCart(mockProduct, 1)
    })
    
    expect(result.current.cartSubtotal).toBe(100)
    expect(result.current.cartTax).toBe(10)
    expect(result.current.cartTotal).toBe(110)
  })

  it('should update product quantity', () => {
    const { result } = renderHook(() => useOptimizedCart())
    
    act(() => {
      result.current.addToCart(mockProduct, 2)
    })
    
    act(() => {
      result.current.updateQuantity('1', 5)
    })
    
    expect(result.current.cart[0].quantity).toBe(5)
    expect(result.current.cartSubtotal).toBe(500)
  })

  it('should remove product when quantity is 0', () => {
    const { result } = renderHook(() => useOptimizedCart())
    
    act(() => {
      result.current.addToCart(mockProduct, 2)
    })
    
    act(() => {
      result.current.updateQuantity('1', 0)
    })
    
    expect(result.current.cart).toHaveLength(0)
    expect(result.current.cartSubtotal).toBe(0)
  })

  it('should remove product from cart', () => {
    const { result } = renderHook(() => useOptimizedCart())
    
    act(() => {
      result.current.addToCart(mockProduct, 2)
      result.current.addToCart(mockProduct2, 1)
    })
    
    act(() => {
      result.current.removeFromCart('1')
    })
    
    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0].id).toBe('2')
    expect(result.current.cartSubtotal).toBe(50)
  })

  it('should clear entire cart', () => {
    const { result } = renderHook(() => useOptimizedCart())
    
    act(() => {
      result.current.addToCart(mockProduct, 2)
      result.current.addToCart(mockProduct2, 1)
    })
    
    act(() => {
      result.current.clearCart()
    })
    
    expect(result.current.cart).toHaveLength(0)
    expect(result.current.cartSubtotal).toBe(0)
    expect(result.current.cartTotal).toBe(0)
  })

  it('should get cart item quantity', () => {
    const { result } = renderHook(() => useOptimizedCart())
    
    act(() => {
      result.current.addToCart(mockProduct, 3)
    })
    
    expect(result.current.getCartItemQuantity('1')).toBe(3)
    expect(result.current.getCartItemQuantity('999')).toBe(0)
  })

  it('should handle multiple products correctly', () => {
    const { result } = renderHook(() => useOptimizedCart({ taxRate: 0.2 }))
    
    act(() => {
      result.current.addToCart(mockProduct, 2) // 200
      result.current.addToCart(mockProduct2, 3) // 150
    })
    
    expect(result.current.cart).toHaveLength(2)
    expect(result.current.cartSubtotal).toBe(350)
    expect(result.current.cartTax).toBe(70)
    expect(result.current.cartTotal).toBe(420)
    expect(result.current.cartItemCount).toBe(5)
  })
})