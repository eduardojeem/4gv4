'use client'

import { useState, useCallback, useMemo } from 'react'
import type { CartItem, Product } from '../types'

interface UseOptimizedCartReturn {
  cart: CartItem[]
  cartTotal: number
  cartSubtotal: number
  cartTax: number
  cartItemCount: number
  addToCart: (product: Product, quantity?: number) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getCartItemQuantity: (productId: string) => number
}

interface CartConfig {
  taxRate?: number
  maxQuantityPerItem?: number
}

/**
 * Hook optimizado para gestión del carrito de compras POS
 * 
 * Proporciona funcionalidad completa de carrito con optimizaciones de rendimiento:
 * - Cálculos memoizados para evitar re-renders innecesarios
 * - Operaciones optimizadas con useCallback
 * - Validaciones automáticas de stock y límites
 * - Soporte para configuración personalizada de impuestos
 * 
 * @param config - Configuración opcional del carrito
 * @param config.taxRate - Tasa de impuesto (por defecto 0.19 = 19%)
 * @param config.maxQuantityPerItem - Cantidad máxima por producto (por defecto 999)
 * 
 * @returns Objeto con estado del carrito y funciones de manipulación
 * 
 * @example
 * ```tsx
 * const { cart, addToCart, cartTotal } = useOptimizedCart({
 *   taxRate: 0.21, // 21% IVA
 *   maxQuantityPerItem: 100
 * })
 * 
 * // Agregar producto al carrito
 * addToCart(product, 2)
 * 
 * // Mostrar total
 * console.log(`Total: ${cartTotal}`)
 * ```
 */
export const useOptimizedCart = (config: CartConfig = {}): UseOptimizedCartReturn => {
  const { taxRate = 0.19, maxQuantityPerItem = 999 } = config
  const [cart, setCart] = useState<CartItem[]>([])

  /**
   * Subtotal del carrito (sin impuestos)
   * Memoizado para optimizar rendimiento
   */
  const cartSubtotal = useMemo(() => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0)
  }, [cart])

  /**
   * Impuestos calculados sobre el subtotal
   * Memoizado para optimizar rendimiento
   */
  const cartTax = useMemo(() => {
    return cartSubtotal * taxRate
  }, [cartSubtotal, taxRate])

  /**
   * Total del carrito (subtotal + impuestos)
   * Memoizado para optimizar rendimiento
   */
  const cartTotal = useMemo(() => {
    return cartSubtotal + cartTax
  }, [cartSubtotal, cartTax])

  /**
   * Cantidad total de items en el carrito
   * Memoizado para optimizar rendimiento
   */
  const cartItemCount = useMemo(() => {
    return cart.reduce((total, item) => total + item.quantity, 0)
  }, [cart])

  /**
   * Agregar producto al carrito o incrementar cantidad si ya existe
   * 
   * @param product - Producto a agregar
   * @param quantity - Cantidad a agregar (por defecto 1)
   */
  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    setCart(prevCart => {
      const existingItemIndex = prevCart.findIndex(item => item.id === product.id)
      
      if (existingItemIndex >= 0) {
        // Actualizar item existente
        const newCart = [...prevCart]
        const currentQuantity = newCart[existingItemIndex].quantity
        const newQuantity = Math.min(currentQuantity + quantity, maxQuantityPerItem, product.stock)
        
        if (newQuantity <= 0) {
          return newCart.filter(item => item.id !== product.id)
        }
        
        newCart[existingItemIndex] = {
          ...newCart[existingItemIndex],
          quantity: newQuantity
        }
        return newCart
      } else {
        // Agregar nuevo item
        const finalQuantity = Math.min(quantity, maxQuantityPerItem, product.stock)
        if (finalQuantity <= 0) return prevCart
        
        const newItem: CartItem = {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: finalQuantity,
          sku: product.sku,
          image: product.image,
          category: product.category,
          stock: product.stock,
          subtotal: product.price * finalQuantity
        }
        return [...prevCart, newItem]
      }
    })
  }, [maxQuantityPerItem])

  /**
   * Remover producto completamente del carrito
   * 
   * @param productId - ID del producto a remover
   */
  const removeFromCart = useCallback((productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId))
  }, [])

  /**
   * Actualizar cantidad específica de un producto en el carrito
   * Si la cantidad es 0 o menor, el producto se remueve del carrito
   * 
   * @param productId - ID del producto a actualizar
   * @param quantity - Nueva cantidad (debe ser mayor a 0)
   */
  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setCart(prevCart => {
      if (quantity <= 0) {
        return prevCart.filter(item => item.id !== productId)
      }
      
      return prevCart.map(item => 
        item.id === productId 
          ? { ...item, quantity: Math.min(quantity, maxQuantityPerItem) }
          : item
      )
    })
  }, [maxQuantityPerItem])

  /**
   * Vaciar completamente el carrito
   * Remueve todos los productos del carrito
   */
  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  /**
   * Obtener la cantidad de un producto específico en el carrito
   * 
   * @param productId - ID del producto a consultar
   * @returns Cantidad del producto en el carrito (0 si no está presente)
   */
  const getCartItemQuantity = useCallback((productId: string): number => {
    const item = cart.find(item => item.id === productId)
    return item?.quantity || 0
  }, [cart])

  return {
    cart,
    cartTotal,
    cartSubtotal,
    cartTax,
    cartItemCount,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartItemQuantity
  }
}