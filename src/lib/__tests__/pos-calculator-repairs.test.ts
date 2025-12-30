/**
 * Tests para cálculos de IVA en reparaciones
 * Verifica que los cálculos de impuestos sean correctos
 */

import { describe, it, expect } from 'vitest'
import {
  calculateRepairTotal,
  createRepairCartItem,
  calculateMixedCartTotal,
  formatRepairTaxBreakdown,
  calculateTaxFromInclusivePrice
} from '../pos-calculator'
import { Repair } from '@/types/repairs'

describe('POS Calculator - Repairs', () => {
  describe('calculateTaxFromInclusivePrice', () => {
    it('should extract tax from inclusive price', () => {
      const result = calculateTaxFromInclusivePrice(110000, 10) // 110,000 Gs con 10% IVA

      expect(result.subtotal).toBe(100000) // 110,000 / 1.10 = 100,000
      expect(result.taxAmount).toBe(10000) // 110,000 - 100,000 = 10,000
    })

    it('should handle 5% tax rate', () => {
      const result = calculateTaxFromInclusivePrice(105000, 5) // 105,000 Gs con 5% IVA

      expect(result.subtotal).toBe(100000) // 105,000 / 1.05 = 100,000
      expect(result.taxAmount).toBe(5000) // 105,000 - 100,000 = 5,000
    })

    it('should handle zero price', () => {
      const result = calculateTaxFromInclusivePrice(0, 10)

      expect(result.subtotal).toBe(0)
      expect(result.taxAmount).toBe(0)
    })

    it('should handle decimal amounts correctly', () => {
      const result = calculateTaxFromInclusivePrice(11000, 10) // 11,000 Gs con 10% IVA

      expect(result.subtotal).toBe(10000) // 11,000 / 1.10 = 10,000
      expect(result.taxAmount).toBe(1000) // 11,000 - 10,000 = 1,000
    })
  })

  describe('calculateRepairTotal', () => {
    it('should calculate repair total with 10% tax (IVA incluido)', () => {
      const result = calculateRepairTotal({
        laborCost: 110000, // 110,000 Gs con IVA incluido
        partsCost: 220000,  // 220,000 Gs con IVA incluido
        taxRate: 10,
        pricesIncludeTax: true
      })

      expect(result.laborCost).toBe(110000)
      expect(result.partsCost).toBe(220000)
      expect(result.subtotal).toBe(300000) // Subtotal sin IVA: 100,000 + 200,000
      expect(result.taxAmount).toBe(30000) // IVA extraído: 10,000 + 20,000
      expect(result.total).toBe(330000) // Total: igual al costo original
      expect(result.breakdown.laborTax).toBe(10000) // IVA de mano de obra
      expect(result.breakdown.partsTax).toBe(20000) // IVA de repuestos
      expect(result.breakdown.laborSubtotal).toBe(100000) // Subtotal mano de obra sin IVA
      expect(result.breakdown.partsSubtotal).toBe(200000) // Subtotal repuestos sin IVA
    })

    it('should calculate repair total with tax excluded (modo anterior)', () => {
      const result = calculateRepairTotal({
        laborCost: 100000, // 100,000 Gs sin IVA
        partsCost: 200000,  // 200,000 Gs sin IVA
        taxRate: 10,
        pricesIncludeTax: false
      })

      expect(result.laborCost).toBe(100000)
      expect(result.partsCost).toBe(200000)
      expect(result.subtotal).toBe(300000) // Subtotal sin IVA
      expect(result.taxAmount).toBe(30000) // IVA calculado: 10% de 300,000
      expect(result.total).toBe(330000) // Total con IVA agregado
      expect(result.breakdown.laborTax).toBe(10000)
      expect(result.breakdown.partsTax).toBe(20000)
      expect(result.breakdown.laborSubtotal).toBe(100000)
      expect(result.breakdown.partsSubtotal).toBe(200000)
    })

    it('should handle zero costs', () => {
      const result = calculateRepairTotal({
        laborCost: 0,
        partsCost: 0,
        taxRate: 10,
        pricesIncludeTax: true
      })

      expect(result.subtotal).toBe(0)
      expect(result.taxAmount).toBe(0)
      expect(result.total).toBe(0)
      expect(result.breakdown.laborTax).toBe(0)
      expect(result.breakdown.partsTax).toBe(0)
      expect(result.breakdown.laborSubtotal).toBe(0)
      expect(result.breakdown.partsSubtotal).toBe(0)
    })

    it('should apply discount proportionally (IVA incluido)', () => {
      const result = calculateRepairTotal({
        laborCost: 110000, // 110,000 Gs con IVA incluido
        partsCost: 220000, // 220,000 Gs con IVA incluido
        taxRate: 10,
        discountPercentage: 10, // 10% descuento sobre el total con IVA
        pricesIncludeTax: true
      })

      // Descuento: 33,000 (10% de 330,000 total con IVA)
      // Subtotal después descuento: 270,000
      // IVA después descuento: 27,000
      expect(result.discountAmount).toBe(33000)
      expect(result.subtotal).toBe(270000) // 300,000 - 30,000 (descuento proporcional)
      expect(result.taxAmount).toBe(27000) // 30,000 - 3,000 (descuento proporcional)
      expect(result.total).toBe(297000) // 330,000 - 33,000
    })

    it('should handle different tax rates (IVA incluido)', () => {
      const result = calculateRepairTotal({
        laborCost: 105000, // 105,000 Gs con 5% IVA incluido
        partsCost: 105000, // 105,000 Gs con 5% IVA incluido
        taxRate: 5,
        pricesIncludeTax: true
      })

      expect(result.subtotal).toBe(200000) // 100,000 + 100,000 (sin IVA)
      expect(result.taxAmount).toBe(10000) // 5,000 + 5,000 (IVA extraído)
      expect(result.total).toBe(210000) // Total original
    })
  })

  describe('createRepairCartItem', () => {
    const mockRepair: Repair = {
      id: 'repair-001',
      customer: { name: 'Test', phone: '123', email: 'test@test.com' },
      device: 'iPhone',
      deviceType: 'smartphone',
      brand: 'Apple',
      model: 'iPhone 12',
      issue: 'Screen broken',
      description: 'Replace screen',
      status: 'listo',
      priority: 'medium',
      urgency: 'normal',
      estimatedCost: 300000,
      finalCost: 300000,
      laborCost: 100000,
      technician: { id: 'tech1', name: 'Tech' },
      location: 'Shop',
      warranty: '30 days',
      createdAt: '2024-01-01',
      estimatedCompletion: null,
      completedAt: null,
      lastUpdate: '2024-01-01',
      progress: 100,
      customerRating: null,
      notes: [],
      parts: [
        { id: 1, name: 'Screen', cost: 150000, quantity: 1, supplier: 'Supplier', partNumber: 'SCR001' },
        { id: 2, name: 'Adhesive', cost: 50000, quantity: 1, supplier: 'Supplier', partNumber: 'ADH001' }
      ],
      images: [],
      notifications: { customer: true, technician: false, manager: false }
    }

    it('should create cart item with correct calculations (IVA incluido)', () => {
      const cartItem = createRepairCartItem(mockRepair, 10, undefined, undefined, true)

      expect(cartItem.id).toBe('repair-repair-001')
      expect(cartItem.type).toBe('repair')
      expect(cartItem.laborCost).toBe(100000) // Costo original con IVA incluido
      expect(cartItem.partsCost).toBe(200000) // 150,000 + 50,000 con IVA incluido
      
      // Con IVA incluido, el subtotal es menor (sin IVA)
      expect(cartItem.subtotal).toBe(272727.27) // Subtotal sin IVA extraído
      expect(cartItem.taxAmount).toBe(27272.73) // IVA extraído
      expect(cartItem.total).toBe(300000) // Total = subtotal + IVA = costo original
      expect(cartItem.taxRate).toBe(10)
    })

    it('should handle repair without parts (IVA incluido)', () => {
      const repairWithoutParts = { ...mockRepair, parts: [] }
      const cartItem = createRepairCartItem(repairWithoutParts, 10, undefined, undefined, true)

      expect(cartItem.laborCost).toBe(100000) // Costo con IVA incluido
      expect(cartItem.partsCost).toBe(0)
      expect(cartItem.subtotal).toBe(90909.09) // Subtotal sin IVA: 100,000 / 1.10
      expect(cartItem.taxAmount).toBe(9090.91) // IVA extraído: 100,000 - 90,909.09
      expect(cartItem.total).toBe(100000) // Total = costo original
    })

    it('should handle repair without labor cost (IVA incluido)', () => {
      const repairWithoutLabor = { ...mockRepair, laborCost: 0 }
      const cartItem = createRepairCartItem(repairWithoutLabor, 10, undefined, undefined, true)

      expect(cartItem.laborCost).toBe(0)
      expect(cartItem.partsCost).toBe(200000) // Costo con IVA incluido
      expect(cartItem.subtotal).toBe(181818.18) // Subtotal sin IVA: 200,000 / 1.10
      expect(cartItem.taxAmount).toBe(18181.82) // IVA extraído
      expect(cartItem.total).toBe(200000) // Total = costo original
    })
  })

  describe('calculateMixedCartTotal', () => {
    it('should calculate totals for mixed cart (IVA incluido)', () => {
      const productItems = [
        { subtotal: 100000, taxAmount: 10000 },
        { subtotal: 50000, taxAmount: 5000 }
      ]

      const repairItems = [
        {
          id: 'repair-1',
          type: 'repair' as const,
          repair: {} as Repair,
          laborCost: 110000, // Con IVA incluido
          partsCost: 220000, // Con IVA incluido
          subtotal: 300000, // Subtotal sin IVA extraído
          taxAmount: 30000, // IVA extraído
          total: 330000, // Total = costo original
          taxRate: 10
        }
      ]

      const result = calculateMixedCartTotal(productItems, repairItems)

      expect(result.subtotal).toBe(450000) // 150,000 + 300,000
      expect(result.totalTax).toBe(45000) // 15,000 + 30,000
      expect(result.total).toBe(495000)
      expect(result.repairTaxBreakdown.laborSubtotal).toBe(100000) // Subtotal mano de obra sin IVA
      expect(result.repairTaxBreakdown.partsSubtotal).toBe(200000) // Subtotal repuestos sin IVA
      expect(result.repairTaxBreakdown.laborTax).toBe(10000) // IVA mano de obra
      expect(result.repairTaxBreakdown.partsTax).toBe(20000) // IVA repuestos
    })

    it('should handle empty carts', () => {
      const result = calculateMixedCartTotal([], [])

      expect(result.subtotal).toBe(0)
      expect(result.totalTax).toBe(0)
      expect(result.total).toBe(0)
      expect(result.repairTaxBreakdown.laborTax).toBe(0)
      expect(result.repairTaxBreakdown.partsTax).toBe(0)
    })

    it('should handle products only', () => {
      const productItems = [
        { subtotal: 100000, taxAmount: 10000 }
      ]

      const result = calculateMixedCartTotal(productItems, [])

      expect(result.subtotal).toBe(100000)
      expect(result.totalTax).toBe(10000)
      expect(result.total).toBe(110000)
      expect(result.repairTaxBreakdown.laborTax).toBe(0)
      expect(result.repairTaxBreakdown.partsTax).toBe(0)
      expect(result.repairTaxBreakdown.laborSubtotal).toBe(0)
      expect(result.repairTaxBreakdown.partsSubtotal).toBe(0)
    })
  })

  describe('Edge cases and rounding', () => {
    it('should handle decimal amounts correctly', () => {
      const result = calculateRepairTotal({
        laborCost: 33333, // Número que genera decimales
        partsCost: 66667,
        taxRate: 10
      })

      // Verificar que los resultados estén redondeados correctamente
      expect(result.total).toBe(Math.round(result.total * 100) / 100)
      expect(result.taxAmount).toBe(Math.round(result.taxAmount * 100) / 100)
    })

    it('should handle large amounts (IVA incluido)', () => {
      const result = calculateRepairTotal({
        laborCost: 1100000, // 1.1 millón con IVA incluido
        partsCost: 2200000, // 2.2 millones con IVA incluido
        taxRate: 10,
        pricesIncludeTax: true
      })

      expect(result.subtotal).toBe(3000000) // 3 millones sin IVA
      expect(result.taxAmount).toBe(300000) // 300,000 IVA extraído
      expect(result.total).toBe(3300000) // Total original
    })

    it('should handle very small amounts (IVA incluido)', () => {
      const result = calculateRepairTotal({
        laborCost: 1.1, // 1.1 Gs con IVA incluido
        partsCost: 1.1, // 1.1 Gs con IVA incluido
        taxRate: 10,
        pricesIncludeTax: true
      })

      expect(result.subtotal).toBe(2) // Subtotal sin IVA redondeado
      expect(result.taxAmount).toBe(0.2) // IVA extraído
      expect(result.total).toBe(2.2) // Total original
    })
  })
})