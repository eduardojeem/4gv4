'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { CartItem, Product } from '../types'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currency'

// Constantes copiadas de page.tsx
const WHOLESALE_DISCOUNT_RATE = 10

interface CartConfig {
  taxRate?: number
  pricesIncludeTax?: boolean
  maxQuantityPerItem?: number
}

interface UseOptimizedCartReturn {
  cart: CartItem[]
  
  // Estado
  isWholesale: boolean
  setIsWholesale: (value: boolean) => void
  discount: number
  setDiscount: (value: number) => void
  
  // Totals
  cartTotal: number
  cartSubtotal: number
  cartTax: number
  cartItemCount: number
  
  // Desgloses
  subtotalApplied: number
  subtotalNonWholesale: number
  generalDiscountAmount: number
  wholesaleDiscountAmount: number
  totalSavings: number
  
  // Acciones
  addToCart: (product: Product, quantity?: number) => void
  addVariantToCart: (variantItem: any) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateItemDiscount: (productId: string, discount: number) => void
  clearCart: (force?: boolean) => void
  getCartItemQuantity: (productId: string) => number
  
  // Helpers
  checkAvailability: (productId: string, quantity: number) => boolean
}

/**
 * Hook optimizado para gestión del carrito de compras POS
 * Incluye toda la lógica de negocio: mayorista, descuentos por volumen, impuestos.
 */
export const useOptimizedCart = (
  inventoryProducts: any[], 
  config: CartConfig = {}
): UseOptimizedCartReturn => {
  const { 
    taxRate = 0.19, 
    pricesIncludeTax = true,
    maxQuantityPerItem = 999 
  } = config

  const [cart, setCart] = useState<CartItem[]>([])
  const [isWholesale, setIsWholesale] = useState(false)
  const [discount, setDiscount] = useState(0) // Descuento general manual/promo

  // Persistencia en localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedCart = localStorage.getItem('pos.cart')
      if (savedCart) {
        const parsed = JSON.parse(savedCart)
        if (Array.isArray(parsed)) setCart(parsed)
      }
    } catch (e) {
      console.warn('No se pudo restaurar carrito', e)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('pos.cart', JSON.stringify(cart))
    } catch (e) {
      console.error('Error saving cart to localStorage:', e)
    }
  }, [cart])

  /**
   * Verificar disponibilidad de stock
   */
  const checkAvailability = useCallback((productId: string, quantity: number) => {
    const product = inventoryProducts.find(p => p.id === productId)
    return product ? product.stock_quantity >= quantity : false
  }, [inventoryProducts])

  /**
   * Helper para redondear a 2 decimales
   */
  const roundToTwo = useCallback((num: number) => Math.round((num + Number.EPSILON) * 100) / 100, [])

  /**
   * Agregar producto al carrito
   */
  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    // Verificar disponibilidad
    const currentProduct = inventoryProducts.find(p => p.id === product.id)
    if (!currentProduct) {
      toast.error('Producto no encontrado')
      return
    }

    setCart(prev => {
      const existingItem = prev.find(item => item.id === product.id)
      const currentQty = existingItem ? existingItem.quantity : 0
      const requestedQuantity = currentQty + quantity

      if (!checkAvailability(product.id, requestedQuantity)) {
        toast.error(`Stock insuficiente. Disponible: ${currentProduct.stock_quantity}`)
        return prev
      }

      if (existingItem) {
        // Actualizar item existente
        const updatedCart = prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: requestedQuantity, subtotal: item.price * requestedQuantity }
            : item
        )
        toast.success(`Cantidad actualizada: ${product.name}`)
        return updatedCart
      } else {
        // Agregar nuevo item
        const inferredWholesale = product.wholesale_price
        
        const newItem: CartItem = {
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.sale_price, // Precio base de venta
          quantity: quantity,
          stock: currentProduct.stock_quantity,
          subtotal: product.sale_price * quantity,
          image: product.image,
          wholesalePrice: inferredWholesale,
          originalPrice: product.sale_price,
          category: typeof product.category === 'object' ? product.category?.id : product.category
        }
        
        // Notificación rica (copiada de page.tsx)
        // Nota: JSX en toast requiere que este archivo sea .tsx o manejarlo en el componente
        // Por ahora usamos texto simple o confiamos en que toast soporte JSX si cambiamos extensión
        // Para seguridad en .ts, usamos mensaje simple
        toast.success(`${product.name} agregado al carrito`)
        
        return [...prev, newItem]
      }
    })
  }, [inventoryProducts, checkAvailability])

  /**
   * Agregar variante al carrito
   */
  const addVariantToCart = useCallback((cartItem: CartItem) => {
    setCart(prev => {
      const existingItem = prev.find(item => 
        item.id === cartItem.id || (item.sku === cartItem.sku)
      )

      if (existingItem) {
        const newQuantity = existingItem.quantity + cartItem.quantity
        // Asumimos que el stock ya fue verificado antes de llamar a esta función
        // o que cartItem trae el stock correcto
        
        toast.success(`Cantidad actualizada: ${cartItem.name}`)
        return prev.map(item => 
          (item.id === cartItem.id || item.sku === cartItem.sku)
            ? { ...item, quantity: newQuantity }
            : item
        )
      } else {
        toast.success(`${cartItem.name} agregado al carrito`)
        return [...prev, cartItem]
      }
    })
  }, [])

  /**
   * Remover item
   */
  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId))
  }, [])

  /**
   * Actualizar cantidad con descuentos automáticos
   */
  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id))
      toast.info('Producto eliminado del carrito')
      return
    }

    if (!checkAvailability(id, quantity)) {
      const currentProduct = inventoryProducts.find(p => p.id === id)
      toast.error(`Stock insuficiente. Disponible: ${currentProduct?.stock_quantity || 0}`)
      return
    }

    setCart(prev => prev.map(item => {
      if (item.id === id) {
        // Lógica de descuento por volumen (bulk discount)
        let autoDiscount = 0
        if (quantity >= 50) autoDiscount = 15
        else if (quantity >= 20) autoDiscount = 10
        else if (quantity >= 10) autoDiscount = 5

        // Mantener descuento manual si es mayor
        const finalDiscount = Math.max(autoDiscount, item.discount || 0)

        if (autoDiscount > (item.discount || 0)) {
          // toast.success(`¡Descuento por cantidad aplicado: ${autoDiscount}%!`)
        }

        return {
          ...item,
          quantity,
          subtotal: item.price * quantity,
          discount: finalDiscount
        }
      }
      return item
    }))
  }, [checkAvailability, inventoryProducts])

  /**
   * Actualizar descuento de un item
   */
  const updateItemDiscount = useCallback((id: string, discount: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const safeDiscount = Math.max(0, Math.min(100, discount))
        return {
          ...item,
          discount: safeDiscount,
          // Recalcular subtotal es opcional aquí porque se hace en el render/memo, 
          // pero mantenemos consistencia en el estado
          // Nota: el subtotal almacenado en el item suele ser bruto * cantidad, 
          // el descuento se aplica después en los cálculos globales.
        }
      }
      return item
    }))
  }, [])

  /**
   * Vaciar carrito
   */
  const clearCart = useCallback((force: boolean = false) => {
    if (!force && cart.length > 0) {
      const confirmed = window.confirm(
        `¿Estás seguro de que deseas vaciar el carrito?\n\nEsta acción no se puede deshacer.`
      )
      if (!confirmed) return
    }
    setCart([])
    toast.success('Carrito vaciado')
  }, [cart])

  /**
   * Cálculos completos (Motor de precios)
   */
  const calculations = useMemo(() => {
    // Cálculo por item
    const itemsCalculation = cart.map(item => {
      const itemDiscountRate = item.discount || 0
      const unitNonWholesale = item.price
      
      // Precio mayorista: explícito o calculado
      const unitWholesaleCandidate = item.wholesalePrice ?? roundToTwo(item.price * (1 - (WHOLESALE_DISCOUNT_RATE / 100)))
      
      // Precio base a aplicar (según modo mayorista)
      const unitApplied = isWholesale ? unitWholesaleCandidate : unitNonWholesale

      // Descuento por item (porcentaje)
      const discountAmountPerUnit = unitApplied * (itemDiscountRate / 100)
      const unitAfterItemDiscount = unitApplied - discountAmountPerUnit
      const lineTotalApplied = unitAfterItemDiscount * item.quantity

      // Cálculo de referencia (sin mayorista) para saber cuánto se ahorró
      const unitAfterItemDiscountNonWholesale = unitNonWholesale * (1 - itemDiscountRate / 100)
      const lineTotalNonWholesale = unitAfterItemDiscountNonWholesale * item.quantity

      return {
        lineTotal: roundToTwo(lineTotalApplied),
        lineTotalNonWholesale: roundToTwo(lineTotalNonWholesale),
        discountAmount: roundToTwo(discountAmountPerUnit * item.quantity)
      }
    })

    // Sumas
    const subtotalApplied = roundToTwo(itemsCalculation.reduce((sum, it) => sum + it.lineTotal, 0))
    const subtotalNonWholesale = roundToTwo(itemsCalculation.reduce((sum, it) => sum + it.lineTotalNonWholesale, 0))
    const totalItemsDiscount = roundToTwo(itemsCalculation.reduce((sum, it) => sum + it.discountAmount, 0))

    // Descuento general (global sobre el subtotal)
    const generalDiscountRate = Math.max(0, Math.min(100, discount))
    const generalDiscountAmountApplied = roundToTwo(subtotalApplied * (generalDiscountRate / 100))
    const subtotalAfterDiscountApplied = roundToTwo(subtotalApplied - generalDiscountAmountApplied)

    // Referencia para ahorro mayorista
    const generalDiscountAmountNonWholesale = roundToTwo(subtotalNonWholesale * (generalDiscountRate / 100))
    const subtotalAfterDiscountNonWholesale = roundToTwo(subtotalNonWholesale - generalDiscountAmountNonWholesale)

    // Ahorro mayorista
    const wholesaleDiscountAmount = isWholesale
      ? roundToTwo(Math.max(0, subtotalAfterDiscountNonWholesale - subtotalAfterDiscountApplied))
      : 0

    const subtotalAfterAllDiscounts = subtotalAfterDiscountApplied

    // Impuestos
    const productTaxAmount = pricesIncludeTax
      ? roundToTwo(subtotalAfterAllDiscounts * (taxRate / (1 + taxRate)))
      : roundToTwo(subtotalAfterAllDiscounts * taxRate)

    const total = pricesIncludeTax
      ? roundToTwo(subtotalAfterAllDiscounts)
      : roundToTwo(subtotalAfterAllDiscounts + productTaxAmount)

    return {
      subtotalApplied,
      subtotalNonWholesale,
      generalDiscountAmount: generalDiscountAmountApplied,
      wholesaleDiscountAmount,
      tax: productTaxAmount,
      total,
      totalSavings: roundToTwo(totalItemsDiscount + generalDiscountAmountApplied + wholesaleDiscountAmount)
    }
  }, [cart, isWholesale, discount, taxRate, pricesIncludeTax, roundToTwo])

  const getCartItemQuantity = useCallback((productId: string) => {
    const item = cart.find(i => i.id === productId)
    return item?.quantity || 0
  }, [cart])

  return {
    cart,
    
    isWholesale,
    setIsWholesale,
    discount,
    setDiscount,

    cartTotal: calculations.total,
    cartSubtotal: calculations.subtotalApplied,
    cartTax: calculations.tax,
    cartItemCount: cart.reduce((acc, item) => acc + item.quantity, 0),
    
    subtotalApplied: calculations.subtotalApplied,
    subtotalNonWholesale: calculations.subtotalNonWholesale,
    generalDiscountAmount: calculations.generalDiscountAmount,
    wholesaleDiscountAmount: calculations.wholesaleDiscountAmount,
    totalSavings: calculations.totalSavings,

    addToCart,
    addVariantToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartItemQuantity,
    checkAvailability
  }
}
