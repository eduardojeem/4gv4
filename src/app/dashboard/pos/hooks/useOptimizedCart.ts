'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import type { CartItem, Product } from '../types'
import { toast } from 'sonner'

// Constantes copiadas de page.tsx
const WHOLESALE_DISCOUNT_RATE = 10

interface CartConfig {
  taxRate?: number
  pricesIncludeTax?: boolean
  maxQuantityPerItem?: number
  storageScope?: string
}

export interface CartVariantInput {
  id?: string
  product_id?: string
  variant_id?: string
  variant_name?: string
  variant?: string
  variant_attributes?: Array<{ name?: string; value?: string }> | null
  sku?: string
  name?: string
  product_name?: string
  price?: number | string | null
  quantity?: number | string | null
  stock?: number | string | null
  image?: string | null
  image_url?: string | null
  wholesalePrice?: number
  wholesale_price?: number
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
  addVariantToCart: (variantItem: CartVariantInput) => void
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
 * Hook optimizado para gestión del carrito de compras POS
 * Incluye toda la lógica de negocio: mayorista, descuentos por volumen, impuestos.
 */
export const useOptimizedCart = (
  inventoryProducts: Product[],
  config: CartConfig = {}
): UseOptimizedCartReturn => {
  const {
    taxRate = 0.19,
    pricesIncludeTax = true,
    maxQuantityPerItem: _maxQuantityPerItem = 999,
    storageScope = 'anonymous:unselected',
  } = config
  const storageKey = `pos.cart:${storageScope}`

  const [cart, setCart] = useState<CartItem[]>([])
  const [isWholesale, setIsWholesale] = useState(false)
  const [discount, setDiscount] = useState(0) // Descuento general manual/promo
  const [isLoaded, setIsLoaded] = useState(false)

  // Persistencia en localStorage: Cargar
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedCart = localStorage.getItem(storageKey)
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
  }, [storageKey])

  // Persistencia en localStorage: Guardar
  useEffect(() => {
    if (typeof window === 'undefined' || !isLoaded) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart))
    } catch (e) {
      console.error('Error saving cart to localStorage:', e)
    }
  }, [cart, isLoaded, storageKey])

  /**
   * Helper para identificar ítems de servicio o reparaciones sin control de stock físico
   */
  const isServiceItem = useCallback((itemOrId: unknown) => {
    if (!itemOrId) return false
    if (typeof itemOrId === 'string') {
      return itemOrId.startsWith('repair_') || itemOrId.startsWith('service_') || itemOrId.startsWith('quick_')
    }
    if (typeof itemOrId === 'object' && itemOrId !== null) {
      const obj = itemOrId as Record<string, unknown>
      return Boolean(
        obj.isService ||
        obj.is_service ||
        obj.type === 'service' ||
        (typeof obj.id === 'string' && (obj.id.startsWith('repair_') || obj.id.startsWith('service_'))) ||
        obj.isServiceItem
      )
    }
    return false
  }, [])

  /**
   * Verificar disponibilidad de stock
   */
  const checkAvailability = useCallback((productId: string, quantity: number) => {
    if (isServiceItem(productId)) return true
    const product = inventoryProducts.find(p => p.id === productId)
    if (!product) return true
    if (isServiceItem(product)) return true
    return (product.stock_quantity ?? 0) >= quantity
  }, [inventoryProducts, isServiceItem])

  /**
   * Helper para redondear a 2 decimales
   */
  const roundToTwo = useCallback((num: number) => Math.round((num + Number.EPSILON) * 100) / 100, [])

  /**
   * Agregar producto al carrito
   */
  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    const isService = isServiceItem(product)
    const currentProduct = inventoryProducts.find(p => p.id === product.id) || product
    if (!currentProduct) {
      toast.error('Producto no encontrado')
      return
    }

    setCart(prev => {
      const existingItem = prev.find(item => item.id === product.id)
      const currentQty = existingItem ? existingItem.quantity : 0
      const requestedQuantity = currentQty + quantity

      if (!isService) {
        const hasInventoryEntry = inventoryProducts.some(p => p.id === product.id)
        const availableStock = Number(currentProduct.stock_quantity || 0)
        const canAdd = hasInventoryEntry
          ? checkAvailability(product.id, requestedQuantity)
          : requestedQuantity <= availableStock

        if (!canAdd) {
          toast.error(`Stock insuficiente. Disponible: ${availableStock}`)
          return prev
        }
      }

      const itemPrice = Number((product as { price?: number | null }).price ?? product.sale_price ?? 0)

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
          price: itemPrice,
          quantity: quantity,
          stock: isService ? 999 : (currentProduct.stock_quantity ?? 0),
          subtotal: itemPrice * quantity,
          image: (product as { image?: string | null }).image || product.image_url || product.images?.[0] || '',
          wholesalePrice: inferredWholesale,
          originalPrice: itemPrice,
          category: typeof product.category === 'object' ? product.category?.id : product.category,
          categoryName: product.category?.name,
          brand: product.brand || undefined,
          isService: isService || Boolean((product as { isService?: boolean }).isService)
        }

        return [...prev, newItem]
      }
    })
  }, [inventoryProducts, checkAvailability, isServiceItem])

  /**
   * Agregar variante al carrito
   */
  const addVariantToCart = useCallback((cartItem: CartVariantInput) => {
    const productRef = inventoryProducts.find(p => p.id === cartItem.product_id || p.id === cartItem.id)
    const variantLabel =
      cartItem.variant ||
      cartItem.variant_name ||
      (Array.isArray(cartItem.variant_attributes)
        ? cartItem.variant_attributes.map(a => a?.value).filter(Boolean).join(' / ')
        : undefined)

    const normalizedItem: CartItem = {
      id: cartItem.variant_id || cartItem.sku || cartItem.id,
      productId: cartItem.product_id,
      variantId: cartItem.variant_id,
      variantName: cartItem.variant_name,
      variantSku: cartItem.sku,
      variantAttributes: cartItem.variant_attributes,
      name: cartItem.name || cartItem.product_name || productRef?.name || 'Producto',
      sku: cartItem.sku || productRef?.sku || '',
      price: Number(cartItem.price || productRef?.sale_price || 0),
      quantity: Number(cartItem.quantity || 1),
      stock: Number(cartItem.stock ?? productRef?.stock_quantity ?? 0),
      subtotal: Number(cartItem.price || productRef?.sale_price || 0) * Number(cartItem.quantity || 1),
      image: cartItem.image || productRef?.image || productRef?.image_url || productRef?.images?.[0] || '',
      wholesalePrice: cartItem.wholesalePrice ?? cartItem.wholesale_price ?? productRef?.wholesale_price ?? undefined,
      originalPrice: Number(cartItem.price || productRef?.sale_price || 0),
      category: typeof productRef?.category === 'object' ? productRef?.category?.id : productRef?.category,
      categoryName: productRef?.category?.name,
      brand: productRef?.brand || undefined,
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

  /** Actualizar cantidad. Los descuentos provienen del cliente o promociones configuradas. */
  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id))
      toast.info('Producto eliminado del carrito')
      return
    }

    const isService = isServiceItem(id)
    const currentCartItem = cart.find(item => item.id === id)
    const availableStock = Number(currentCartItem?.stock ?? 0)
    if (!isService && currentCartItem?.variantId && quantity > availableStock) {
      toast.error(`Stock insuficiente para esta variante. Disponible: ${availableStock}`)
      return
    }
    if (!isService && !currentCartItem?.variantId && !checkAvailability(id, quantity)) {
      const currentProduct = inventoryProducts.find(p => p.id === id)
      toast.error(`Stock insuficiente. Disponible: ${currentProduct?.stock_quantity || 0}`)
      return
    }

    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          quantity,
          subtotal: item.price * quantity,
          discount: item.discount || 0,
        }
      }
      return item
    }))
  }, [cart, checkAvailability, inventoryProducts, isServiceItem])

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
  const clearCart = useCallback((_force: boolean = false) => {
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

