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
  updateItemPromoCode: (productId: string, promoCode: string | null) => void
  clearCart: (force?: boolean) => void
  replaceCart: (items: CartItem[]) => void
  getCartItemQuantity: (productId: string) => number
  
  // Helpers
  checkAvailability: (productId: string, quantity: number) => boolean
}

/**
 * Hook optimizado para gestiÃ³n del carrito de compras POS
 * Incluye toda la lÃ³gica de negocio: mayorista, descuentos por volumen, impuestos.
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
  const [isLoaded, setIsLoaded] = useState(false)

  // Persistencia en localStorage: Cargar
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedCart = localStorage.getItem('pos.cart')
      if (savedCart) {
        const parsed = JSON.parse(savedCart)
        if (Array.isArray(parsed)) {
          setCart(parsed)
        }
      }
    } catch (e) {
      console.warn('No se pudo restaurar carrito', e)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Persistencia en localStorage: Guardar
  useEffect(() => {
    if (typeof window === 'undefined' || !isLoaded) return
    try {
      localStorage.setItem('pos.cart', JSON.stringify(cart))
    } catch (e) {
      console.error('Error saving cart to localStorage:', e)
    }
  }, [cart, isLoaded])

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
    const currentProduct = inventoryProducts.find(p => p.id === product.id) || (product as any)
    if (!currentProduct) {
      toast.error('Producto no encontrado')
      return
    }

    setCart(prev => {
      const existingItem = prev.find(item => item.id === product.id)
      const currentQty = existingItem ? existingItem.quantity : 0
      const requestedQuantity = currentQty + quantity

      const hasInventoryEntry = inventoryProducts.some(p => p.id === product.id)
      const availableStock = Number(currentProduct.stock_quantity || 0)
      const canAdd = hasInventoryEntry
        ? checkAvailability(product.id, requestedQuantity)
        : requestedQuantity <= availableStock

      if (!canAdd) {
        toast.error(`Stock insuficiente. Disponible: ${availableStock}`)
        return prev
      }

      if (existingItem) {
        // Actualizar item existente
        const updatedCart = prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: requestedQuantity, subtotal: item.price * requestedQuantity }
            : item
        )
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
          image: (product as any).image || (product as any).image_url || '',
          wholesalePrice: inferredWholesale,
          originalPrice: product.sale_price,
          category: typeof product.category === 'object' ? product.category?.id : product.category
        }
        
        // NotificaciÃ³n rica (copiada de page.tsx)
        // Nota: JSX en toast requiere que este archivo sea .tsx o manejarlo en el componente
        // Por ahora usamos texto simple o confiamos en que toast soporte JSX si cambiamos extensiÃ³n
        // Para seguridad en .ts, usamos mensaje simple
        return [...prev, newItem]
      }
    })
  }, [inventoryProducts, checkAvailability])

  /**
   * Agregar variante al carrito
   */
  const addVariantToCart = useCallback((cartItem: any) => {
    const productRef = inventoryProducts.find((p: any) => p.id === cartItem.product_id || p.id === cartItem.id)
    const variantLabel =
      cartItem.variant ||
      cartItem.variant_name ||
      (Array.isArray(cartItem.variant_attributes)
        ? cartItem.variant_attributes.map((a: any) => a?.value).filter(Boolean).join(' / ')
        : undefined)

    const normalizedItem: CartItem = {
      id: cartItem.variant_id || cartItem.sku || cartItem.id,
      name: cartItem.name || cartItem.product_name || productRef?.name || 'Producto',
      sku: cartItem.sku || productRef?.sku || '',
      price: Number(cartItem.price || productRef?.sale_price || 0),
      quantity: Number(cartItem.quantity || 1),
      stock: Number(cartItem.stock ?? productRef?.stock_quantity ?? 0),
      subtotal: Number(cartItem.price || productRef?.sale_price || 0) * Number(cartItem.quantity || 1),
      image: cartItem.image || productRef?.image || productRef?.image_url || productRef?.images?.[0] || '',
      wholesalePrice: cartItem.wholesalePrice ?? cartItem.wholesale_price ?? productRef?.wholesale_price ?? undefined,
      originalPrice: Number(cartItem.price || productRef?.sale_price || 0),
      category: typeof productRef?.category === 'object' ? productRef?.category?.id : productRef?.category
    }

    if (variantLabel) {
      ;(normalizedItem as CartItem & { variant?: string }).variant = variantLabel
    }

    setCart(prev => {
      const existingItem = prev.find(item => 
        item.id === normalizedItem.id || (item.sku === normalizedItem.sku)
      )

      if (existingItem) {
        const newQuantity = existingItem.quantity + normalizedItem.quantity
        return prev.map(item => 
          (item.id === normalizedItem.id || item.sku === normalizedItem.sku)
            ? { ...item, quantity: newQuantity }
            : item
        )
      } else {
        return [...prev, normalizedItem]
      }
    })
  }, [inventoryProducts])

  /**
   * Remover item
   */
  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId))
  }, [])

  /**
   * Actualizar cantidad con descuentos automÃ¡ticos
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
        // LÃ³gica de descuento por volumen (bulk discount)
        let autoDiscount = 0
        if (quantity >= 50) autoDiscount = 15
        else if (quantity >= 20) autoDiscount = 10
        else if (quantity >= 10) autoDiscount = 5

        // Mantener descuento manual si es mayor
        const finalDiscount = Math.max(autoDiscount, item.discount || 0)

        if (autoDiscount > (item.discount || 0)) {
          // toast.success(`Â¡Descuento por cantidad aplicado: ${autoDiscount}%!`)
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
          // Recalcular subtotal es opcional aquÃ­ porque se hace en el render/memo, 
          // pero mantenemos consistencia en el estado
          // Nota: el subtotal almacenado en el item suele ser bruto * cantidad, 
          // el descuento se aplica despuÃ©s en los cÃ¡lculos globales.
        }
      }
      return item
    }))
  }, [])

  const updateItemPromoCode = useCallback((id: string, promoCode: string | null) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, promoCode: promoCode || undefined }
      }
      return item
    }))
  }, [])

  /**
   * Vaciar carrito
   */
  const clearCart = useCallback((force: boolean = false) => {
    // La confirmaciÃ³n debe ser manejada por la UI (Dialog)
    setCart([])
  }, [])

  const replaceCart = useCallback((items: CartItem[]) => {
    setCart(Array.isArray(items) ? items : [])
  }, [])

  /**
   * CÃ¡lculos completos (Motor de precios)
   */
  const calculations = useMemo(() => {
    // CÃ¡lculo por item
    const itemsCalculation = cart.map(item => {
      const itemDiscountRate = item.discount || 0
      const unitNonWholesale = item.price
      
      // Precio mayorista: explÃ­cito o calculado
      const unitWholesaleCandidate = item.wholesalePrice ?? roundToTwo(item.price * (1 - (WHOLESALE_DISCOUNT_RATE / 100)))
      
      // Precio base a aplicar (segÃºn modo mayorista)
      const unitApplied = isWholesale ? unitWholesaleCandidate : unitNonWholesale

      // Descuento por item (porcentaje)
      const discountAmountPerUnit = unitApplied * (itemDiscountRate / 100)
      const unitAfterItemDiscount = unitApplied - discountAmountPerUnit
      const lineTotalApplied = unitAfterItemDiscount * item.quantity

      // CÃ¡lculo de referencia (sin mayorista) para saber cuÃ¡nto se ahorrÃ³
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
    updateItemDiscount,
    updateItemPromoCode,
    clearCart,
    replaceCart,
    getCartItemQuantity,
    checkAvailability
  }
}

