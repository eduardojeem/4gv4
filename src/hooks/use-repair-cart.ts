/**
 * Hook para manejar carrito con reparaciones
 * Incluye cálculo automático de IVA y totales
 */

import { useState, useMemo } from 'react'
import { Repair } from '@/types/repairs'
import { 
  CartRepairItem, 
  createRepairCartItem, 
  calculateMixedCartTotal,
  formatRepairTaxBreakdown,
  formatCurrency
} from '@/lib/pos-calculator'

export interface ProductCartItem {
  id: string
  type: 'product'
  name: string
  price: number
  quantity: number
  subtotal: number
  taxAmount: number
  taxRate: number
}

export interface CartState {
  productItems: ProductCartItem[]
  repairItems: CartRepairItem[]
  totals: {
    subtotal: number
    totalTax: number
    total: number
    repairTaxBreakdown: {
      laborTax: number
      partsTax: number
    }
  }
}

export interface UseRepairCartReturn {
  cart: CartState
  addRepair: (repair: Repair, taxRate?: number, pricesIncludeTax?: boolean) => void
  addProduct: (product: { id: string; name: string; price: number }, quantity?: number, taxRate?: number) => void
  removeItem: (itemId: string) => void
  updateProductQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  getCartSummary: () => string
  getRepairTaxBreakdown: () => string
}

const DEFAULT_TAX_RATE = 10 // 10% IVA por defecto

export function useRepairCart(): UseRepairCartReturn {
  const [productItems, setProductItems] = useState<ProductCartItem[]>([])
  const [repairItems, setRepairItems] = useState<CartRepairItem[]>([])

  // Calcular totales automáticamente
  const totals = useMemo(() => {
    return calculateMixedCartTotal(productItems, repairItems)
  }, [productItems, repairItems])

  const cart: CartState = {
    productItems,
    repairItems,
    totals
  }

  // Agregar reparación al carrito
  const addRepair = (repair: Repair, taxRate: number = DEFAULT_TAX_RATE, pricesIncludeTax: boolean = true) => {
    const cartItem = createRepairCartItem(repair, taxRate, undefined, undefined, pricesIncludeTax)
    
    setRepairItems(prev => {
      // Verificar si ya existe
      const existingIndex = prev.findIndex(item => item.repair.id === repair.id)
      
      if (existingIndex >= 0) {
        // Actualizar existente
        const updated = [...prev]
        updated[existingIndex] = cartItem
        return updated
      } else {
        // Agregar nuevo
        return [...prev, cartItem]
      }
    })
  }

  // Agregar producto al carrito
  const addProduct = (
    product: { id: string; name: string; price: number }, 
    quantity: number = 1,
    taxRate: number = DEFAULT_TAX_RATE
  ) => {
    setProductItems(prev => {
      const existingIndex = prev.findIndex(item => item.id === product.id)
      
      if (existingIndex >= 0) {
        // Actualizar cantidad existente
        const updated = [...prev]
        const newQuantity = updated[existingIndex].quantity + quantity
        const subtotal = product.price * newQuantity
        const taxAmount = Math.round((subtotal * (taxRate / 100)) * 100) / 100
        
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQuantity,
          subtotal,
          taxAmount
        }
        return updated
      } else {
        // Agregar nuevo producto
        const subtotal = product.price * quantity
        const taxAmount = Math.round((subtotal * (taxRate / 100)) * 100) / 100
        
        const newItem: ProductCartItem = {
          id: product.id,
          type: 'product',
          name: product.name,
          price: product.price,
          quantity,
          subtotal,
          taxAmount,
          taxRate
        }
        
        return [...prev, newItem]
      }
    })
  }

  // Remover item del carrito
  const removeItem = (itemId: string) => {
    if (itemId.startsWith('repair-')) {
      const repairId = itemId.replace('repair-', '')
      setRepairItems(prev => prev.filter(item => item.repair.id !== repairId))
    } else {
      setProductItems(prev => prev.filter(item => item.id !== itemId))
    }
  }

  // Actualizar cantidad de producto
  const updateProductQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId)
      return
    }

    setProductItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const subtotal = item.price * quantity
        const taxAmount = Math.round((subtotal * (item.taxRate / 100)) * 100) / 100
        
        return {
          ...item,
          quantity,
          subtotal,
          taxAmount
        }
      }
      return item
    }))
  }

  // Limpiar carrito
  const clearCart = () => {
    setProductItems([])
    setRepairItems([])
  }

  // Obtener resumen del carrito
  const getCartSummary = (): string => {
    const { subtotal, totalTax, total } = totals
    
    return `
Subtotal: ${formatCurrency(subtotal)}
IVA Total: ${formatCurrency(totalTax)}
${repairItems.length > 0 ? `IVA Reparaciones: ${getRepairTaxBreakdown()}` : ''}
TOTAL: ${formatCurrency(total)}
    `.trim()
  }

  // Obtener desglose de IVA de reparaciones
  const getRepairTaxBreakdown = (): string => {
    const { repairTaxBreakdown } = totals
    
    if (repairItems.length === 0) {
      return 'No hay reparaciones en el carrito'
    }
    
    return `Mano de obra: ${formatCurrency(repairTaxBreakdown.laborTax)} | Repuestos: ${formatCurrency(repairTaxBreakdown.partsTax)}`
  }

  return {
    cart,
    addRepair,
    addProduct,
    removeItem,
    updateProductQuantity,
    clearCart,
    getCartSummary,
    getRepairTaxBreakdown
  }
}