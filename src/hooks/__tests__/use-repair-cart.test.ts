/**
 * Tests para el hook useRepairCart
 * Verifica el funcionamiento del carrito con reparaciones
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRepairCart } from '../use-repair-cart'
import { Repair } from '@/types/repairs'

const mockRepair: Repair = {
  id: 'repair-001',
  customer: { name: 'Juan Pérez', phone: '0981-123456', email: 'juan@test.com' },
  device: 'iPhone 12',
  deviceType: 'smartphone',
  brand: 'Apple',
  model: 'iPhone 12',
  issue: 'Pantalla rota',
  description: 'Reemplazo de pantalla',
  status: 'listo',
  priority: 'medium',
  urgency: 'normal',
  estimatedCost: 300000,
  finalCost: 300000,
  laborCost: 100000,
  technician: { id: 'tech1', name: 'Carlos' },
  location: 'Taller',
  warranty: '30 días',
  createdAt: '2024-01-01',
  estimatedCompletion: null,
  completedAt: null,
  lastUpdate: '2024-01-01',
  progress: 100,
  customerRating: null,
  notes: [],
  parts: [
    { id: 1, name: 'Pantalla LCD', cost: 150000, quantity: 1, supplier: 'TechParts', partNumber: 'LCD001' },
    { id: 2, name: 'Adhesivo', cost: 50000, quantity: 1, supplier: 'TechParts', partNumber: 'ADH001' }
  ],
  images: [],
  notifications: { customer: true, technician: false, manager: false }
}

const mockProduct = {
  id: 'prod-001',
  name: 'Funda iPhone',
  price: 45000
}

describe('useRepairCart', () => {
  it('should initialize with empty cart', () => {
    const { result } = renderHook(() => useRepairCart())

    expect(result.current.cart.productItems).toHaveLength(0)
    expect(result.current.cart.repairItems).toHaveLength(0)
    expect(result.current.cart.totals.total).toBe(0)
  })

  describe('addRepair', () => {
    it('should add repair to cart with correct calculations (IVA included)', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addRepair(mockRepair)
      })

      expect(result.current.cart.repairItems).toHaveLength(1)
      
      const repairItem = result.current.cart.repairItems[0]
      expect(repairItem.id).toBe('repair-repair-001')
      expect(repairItem.laborCost).toBe(100000) // Precio con IVA incluido
      expect(repairItem.partsCost).toBe(200000) // 150,000 + 50,000 (con IVA incluido)
      
      // Con IVA incluido: subtotal es el monto SIN IVA extraído
      expect(repairItem.subtotal).toBeCloseTo(272727.27, 2) // 300,000 / 1.1
      expect(repairItem.taxAmount).toBeCloseTo(27272.73, 2) // IVA extraído
      expect(repairItem.total).toBe(300000) // Total = costo original
    })

    it('should update existing repair when added again', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addRepair(mockRepair)
      })

      expect(result.current.cart.repairItems).toHaveLength(1)

      // Agregar la misma reparación otra vez
      act(() => {
        result.current.addRepair(mockRepair)
      })

      // Debería seguir siendo 1 item (actualizado, no duplicado)
      expect(result.current.cart.repairItems).toHaveLength(1)
    })

    it('should handle custom tax rate', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addRepair(mockRepair, 5) // 5% IVA
      })

      const repairItem = result.current.cart.repairItems[0]
      expect(repairItem.taxRate).toBe(5)
      // Con 5% IVA incluido: 300,000 / 1.05 = 285,714.29 subtotal
      expect(repairItem.subtotal).toBeCloseTo(285714.29, 2)
      expect(repairItem.taxAmount).toBeCloseTo(14285.71, 2) // IVA extraído
      expect(repairItem.total).toBe(300000) // Total = costo original
    })
  })

  describe('addProduct', () => {
    it('should add product to cart', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addProduct(mockProduct)
      })

      expect(result.current.cart.productItems).toHaveLength(1)
      
      const productItem = result.current.cart.productItems[0]
      expect(productItem.id).toBe('prod-001')
      expect(productItem.name).toBe('Funda iPhone')
      expect(productItem.price).toBe(45000)
      expect(productItem.quantity).toBe(1)
      expect(productItem.subtotal).toBe(45000)
      expect(productItem.taxAmount).toBe(4500) // 10% de 45,000
    })

    it('should add quantity to existing product', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addProduct(mockProduct, 2)
      })

      act(() => {
        result.current.addProduct(mockProduct, 1)
      })

      expect(result.current.cart.productItems).toHaveLength(1)
      
      const productItem = result.current.cart.productItems[0]
      expect(productItem.quantity).toBe(3)
      expect(productItem.subtotal).toBe(135000) // 45,000 × 3
      expect(productItem.taxAmount).toBe(13500) // 10% de 135,000
    })

    it('should handle custom tax rate for products', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addProduct(mockProduct, 1, 5) // 5% IVA
      })

      const productItem = result.current.cart.productItems[0]
      expect(productItem.taxRate).toBe(5)
      expect(productItem.taxAmount).toBe(2250) // 5% de 45,000
    })
  })

  describe('removeItem', () => {
    it('should remove repair item', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addRepair(mockRepair)
      })

      expect(result.current.cart.repairItems).toHaveLength(1)

      act(() => {
        result.current.removeItem('repair-repair-001')
      })

      expect(result.current.cart.repairItems).toHaveLength(0)
    })

    it('should remove product item', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addProduct(mockProduct)
      })

      expect(result.current.cart.productItems).toHaveLength(1)

      act(() => {
        result.current.removeItem('prod-001')
      })

      expect(result.current.cart.productItems).toHaveLength(0)
    })
  })

  describe('updateProductQuantity', () => {
    it('should update product quantity', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addProduct(mockProduct)
      })

      act(() => {
        result.current.updateProductQuantity('prod-001', 3)
      })

      const productItem = result.current.cart.productItems[0]
      expect(productItem.quantity).toBe(3)
      expect(productItem.subtotal).toBe(135000)
      expect(productItem.taxAmount).toBe(13500)
    })

    it('should remove item when quantity is 0', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addProduct(mockProduct)
      })

      expect(result.current.cart.productItems).toHaveLength(1)

      act(() => {
        result.current.updateProductQuantity('prod-001', 0)
      })

      expect(result.current.cart.productItems).toHaveLength(0)
    })

    it('should remove item when quantity is negative', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addProduct(mockProduct)
      })

      act(() => {
        result.current.updateProductQuantity('prod-001', -1)
      })

      expect(result.current.cart.productItems).toHaveLength(0)
    })
  })

  describe('clearCart', () => {
    it('should clear all items from cart', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addRepair(mockRepair)
        result.current.addProduct(mockProduct)
      })

      expect(result.current.cart.repairItems).toHaveLength(1)
      expect(result.current.cart.productItems).toHaveLength(1)

      act(() => {
        result.current.clearCart()
      })

      expect(result.current.cart.repairItems).toHaveLength(0)
      expect(result.current.cart.productItems).toHaveLength(0)
      expect(result.current.cart.totals.total).toBe(0)
    })
  })

  describe('totals calculation', () => {
    it('should calculate mixed cart totals correctly (IVA included)', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addRepair(mockRepair) // 300,000 total (IVA incluido)
        result.current.addProduct(mockProduct, 2) // 99,000 total (90,000 + 9,000 IVA)
      })

      const { totals } = result.current.cart
      // Subtotal = subtotal sin IVA de reparación + subtotal de productos
      expect(totals.subtotal).toBeCloseTo(362727.27, 2) // 272,727.27 + 90,000
      expect(totals.totalTax).toBeCloseTo(36272.73, 2) // 27,272.73 + 9,000
      expect(totals.total).toBe(399000) // 300,000 + 99,000
      expect(totals.repairTaxBreakdown.laborTax).toBeCloseTo(9090.91, 2) // IVA extraído de 100,000
      expect(totals.repairTaxBreakdown.partsTax).toBeCloseTo(18181.82, 2) // IVA extraído de 200,000
    })
  })

  describe('getCartSummary', () => {
    it('should return formatted cart summary', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addRepair(mockRepair)
        result.current.addProduct(mockProduct)
      })

      const summary = result.current.getCartSummary()
      
      expect(summary).toContain('Subtotal:')
      expect(summary).toContain('IVA Total:')
      expect(summary).toContain('TOTAL:')
      expect(summary).toContain('IVA Reparaciones:')
    })

    it('should handle empty cart', () => {
      const { result } = renderHook(() => useRepairCart())

      const summary = result.current.getCartSummary()
      
      expect(summary).toContain('Subtotal:')
      expect(summary).toContain('IVA Total:')
      expect(summary).toContain('TOTAL:')
      expect(summary).toContain('0') // Debe contener ceros
    })
  })

  describe('getRepairTaxBreakdown', () => {
    it('should return repair tax breakdown', () => {
      const { result } = renderHook(() => useRepairCart())

      act(() => {
        result.current.addRepair(mockRepair)
      })

      const breakdown = result.current.getRepairTaxBreakdown()
      
      expect(breakdown).toContain('Mano de obra:')
      expect(breakdown).toContain('Repuestos:')
    })

    it('should handle no repairs', () => {
      const { result } = renderHook(() => useRepairCart())

      const breakdown = result.current.getRepairTaxBreakdown()
      
      expect(breakdown).toBe('No hay reparaciones en el carrito')
    })
  })
})