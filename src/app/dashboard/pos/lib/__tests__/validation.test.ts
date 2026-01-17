/**
 * Tests para validation.ts
 */

import { describe, it, expect } from 'vitest'
import {
  validateSale,
  validateCartItem,
  validateCustomer,
  validateCashMovement,
  validateRegisterOpening,
  validateRegisterClosing,
  validateSaleBusinessRules,
  cartItemSchema,
  saleSchema,
  customerSchema
} from '../validation'

describe('Validation Schemas', () => {
  describe('cartItemSchema', () => {
    it('should validate a valid cart item', () => {
      const validItem = {
        id: '123',
        name: 'iPhone 13',
        sku: 'IP13-001',
        price: 999,
        quantity: 1,
        stock: 10,
        subtotal: 999
      }
      
      const result = cartItemSchema.safeParse(validItem)
      expect(result.success).toBe(true)
    })

    it('should reject item with negative price', () => {
      const invalidItem = {
        id: '123',
        name: 'iPhone 13',
        sku: 'IP13-001',
        price: -999,
        quantity: 1,
        stock: 10,
        subtotal: 999
      }
      
      const result = cartItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
    })

    it('should reject item with zero quantity', () => {
      const invalidItem = {
        id: '123',
        name: 'iPhone 13',
        sku: 'IP13-001',
        price: 999,
        quantity: 0,
        stock: 10,
        subtotal: 0
      }
      
      const result = cartItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
    })

    it('should accept optional fields', () => {
      const itemWithOptionals = {
        id: '123',
        name: 'iPhone 13',
        sku: 'IP13-001',
        price: 999,
        quantity: 1,
        stock: 10,
        subtotal: 999,
        discount: 10,
        wholesalePrice: 899,
        isService: false,
        promoCode: 'SAVE10',
        category: 'Electronics',
        image: 'https://example.com/image.jpg'
      }
      
      const result = cartItemSchema.safeParse(itemWithOptionals)
      expect(result.success).toBe(true)
    })
  })

  describe('saleSchema', () => {
    it('should validate a valid sale', () => {
      const validSale = {
        items: [{
          id: '123',
          name: 'iPhone 13',
          sku: 'IP13-001',
          price: 999,
          quantity: 1,
          stock: 10,
          subtotal: 999
        }],
        paymentMethod: 'cash',
        discount: 0
      }
      
      const result = saleSchema.safeParse(validSale)
      expect(result.success).toBe(true)
    })

    it('should reject sale with empty items', () => {
      const invalidSale = {
        items: [],
        paymentMethod: 'cash',
        discount: 0
      }
      
      const result = saleSchema.safeParse(invalidSale)
      expect(result.success).toBe(false)
    })

    it('should reject sale with invalid payment method', () => {
      const invalidSale = {
        items: [{
          id: '123',
          name: 'iPhone 13',
          sku: 'IP13-001',
          price: 999,
          quantity: 1,
          stock: 10,
          subtotal: 999
        }],
        paymentMethod: 'bitcoin',
        discount: 0
      }
      
      const result = saleSchema.safeParse(invalidSale)
      expect(result.success).toBe(false)
    })

    it('should reject discount over 100', () => {
      const invalidSale = {
        items: [{
          id: '123',
          name: 'iPhone 13',
          sku: 'IP13-001',
          price: 999,
          quantity: 1,
          stock: 10,
          subtotal: 999
        }],
        paymentMethod: 'cash',
        discount: 150
      }
      
      const result = saleSchema.safeParse(invalidSale)
      expect(result.success).toBe(false)
    })
  })

  describe('customerSchema', () => {
    it('should validate customer with name', () => {
      const validCustomer = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        email: 'john@example.com',
        type: 'regular'
      }
      
      const result = customerSchema.safeParse(validCustomer)
      expect(result.success).toBe(true)
    })

    it('should validate customer with only phone', () => {
      const validCustomer = {
        firstName: '',
        phone: '+1234567890',
        type: 'regular'
      }
      
      const result = customerSchema.safeParse(validCustomer)
      expect(result.success).toBe(true)
    })

    it('should reject customer without name or phone', () => {
      const invalidCustomer = {
        firstName: '',
        email: 'john@example.com',
        type: 'regular'
      }
      
      const result = customerSchema.safeParse(invalidCustomer)
      expect(result.success).toBe(false)
    })

    it('should reject invalid email', () => {
      const invalidCustomer = {
        firstName: 'John',
        email: 'not-an-email',
        type: 'regular'
      }
      
      const result = customerSchema.safeParse(invalidCustomer)
      expect(result.success).toBe(false)
    })

    it('should accept valid customer types', () => {
      const types = ['regular', 'vip', 'wholesale']
      
      types.forEach(type => {
        const customer = {
          firstName: 'John',
          type
        }
        
        const result = customerSchema.safeParse(customer)
        expect(result.success).toBe(true)
      })
    })
  })
})

describe('Validation Functions', () => {
  describe('validateSale', () => {
    it('should return success for valid sale', () => {
      const validSale = {
        items: [{
          id: '123',
          name: 'iPhone 13',
          sku: 'IP13-001',
          price: 999,
          quantity: 1,
          stock: 10,
          subtotal: 999
        }],
        paymentMethod: 'cash',
        discount: 0
      }
      
      const result = validateSale(validSale)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.items).toHaveLength(1)
      }
    })

    it('should return errors for invalid sale', () => {
      const invalidSale = {
        items: [],
        paymentMethod: 'invalid',
        discount: 150
      }
      
      const result = validateSale(invalidSale)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0)
      }
    })
  })

  describe('validateCartItem', () => {
    it('should return success for valid item', () => {
      const validItem = {
        id: '123',
        name: 'iPhone 13',
        sku: 'IP13-001',
        price: 999,
        quantity: 1,
        stock: 10,
        subtotal: 999
      }
      
      const result = validateCartItem(validItem)
      expect(result.success).toBe(true)
    })

    it('should return errors for invalid item', () => {
      const invalidItem = {
        id: '',
        name: '',
        price: -1
      }
      
      const result = validateCartItem(invalidItem)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0)
      }
    })
  })

  describe('validateCustomer', () => {
    it('should return success for valid customer', () => {
      const validCustomer = {
        firstName: 'John',
        phone: '+1234567890'
      }
      
      const result = validateCustomer(validCustomer)
      expect(result.success).toBe(true)
    })

    it('should return errors for invalid customer', () => {
      const invalidCustomer = {
        firstName: '',
        email: 'not-an-email'
      }
      
      const result = validateCustomer(invalidCustomer)
      expect(result.success).toBe(false)
    })
  })
})

describe('Business Rules Validation', () => {
  describe('validateSaleBusinessRules', () => {
    it('should validate sufficient cash received', () => {
      const sale = {
        items: [{
          id: '123',
          name: 'iPhone 13',
          sku: 'IP13-001',
          price: 999,
          quantity: 1,
          stock: 10,
          subtotal: 999,
          isService: false
        }],
        paymentMethod: 'cash' as const,
        discount: 0,
        cashReceived: 1000
      }
      
      const result = validateSaleBusinessRules(sale)
      expect(result.valid).toBe(true)
    })

    it('should reject insufficient cash', () => {
      const sale = {
        items: [{
          id: '123',
          name: 'iPhone 13',
          sku: 'IP13-001',
          price: 999,
          quantity: 1,
          stock: 10,
          subtotal: 999,
          isService: false
        }],
        paymentMethod: 'cash' as const,
        discount: 0,
        cashReceived: 500
      }
      
      const result = validateSaleBusinessRules(sale)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.errors).toContain('El efectivo recibido es insuficiente')
      }
    })

    it('should validate sufficient stock', () => {
      const sale = {
        items: [{
          id: '123',
          name: 'iPhone 13',
          sku: 'IP13-001',
          price: 999,
          quantity: 5,
          stock: 10,
          subtotal: 4995,
          isService: false
        }],
        paymentMethod: 'card' as const,
        discount: 0
      }
      
      const result = validateSaleBusinessRules(sale)
      expect(result.valid).toBe(true)
    })

    it('should reject insufficient stock', () => {
      const sale = {
        items: [{
          id: '123',
          name: 'iPhone 13',
          sku: 'IP13-001',
          price: 999,
          quantity: 15,
          stock: 10,
          subtotal: 14985,
          isService: false
        }],
        paymentMethod: 'card' as const,
        discount: 0
      }
      
      const result = validateSaleBusinessRules(sale)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.errors[0]).toContain('Stock insuficiente')
      }
    })

    it('should skip stock validation for services', () => {
      const sale = {
        items: [{
          id: '123',
          name: 'Repair Service',
          sku: 'SRV-001',
          price: 100,
          quantity: 1,
          stock: 0,
          subtotal: 100,
          isService: true
        }],
        paymentMethod: 'cash' as const,
        discount: 0,
        cashReceived: 100
      }
      
      const result = validateSaleBusinessRules(sale)
      expect(result.valid).toBe(true)
    })

    it('should validate mixed payment splits', () => {
      const sale = {
        items: [{
          id: '123',
          name: 'iPhone 13',
          sku: 'IP13-001',
          price: 999,
          quantity: 1,
          stock: 10,
          subtotal: 999,
          isService: false
        }],
        paymentMethod: 'mixed' as const,
        discount: 0,
        paymentSplit: [
          { id: '1', method: 'cash' as const, amount: 500 },
          { id: '2', method: 'card' as const, amount: 499 }
        ]
      }
      
      const result = validateSaleBusinessRules(sale)
      expect(result.valid).toBe(true)
    })

    it('should reject mixed payment with incorrect total', () => {
      const sale = {
        items: [{
          id: '123',
          name: 'iPhone 13',
          sku: 'IP13-001',
          price: 999,
          quantity: 1,
          stock: 10,
          subtotal: 999,
          isService: false
        }],
        paymentMethod: 'mixed' as const,
        discount: 0,
        paymentSplit: [
          { id: '1', method: 'cash' as const, amount: 500 },
          { id: '2', method: 'card' as const, amount: 400 }
        ]
      }
      
      const result = validateSaleBusinessRules(sale)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.errors[0]).toContain('no coincide')
      }
    })

    it('should require transfer reference', () => {
      const sale = {
        items: [{
          id: '123',
          name: 'iPhone 13',
          sku: 'IP13-001',
          price: 999,
          quantity: 1,
          stock: 10,
          subtotal: 999,
          isService: false
        }],
        paymentMethod: 'transfer' as const,
        discount: 0
      }
      
      const result = validateSaleBusinessRules(sale)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.errors).toContain('La transferencia requiere una referencia')
      }
    })

    it('should require card number', () => {
      const sale = {
        items: [{
          id: '123',
          name: 'iPhone 13',
          sku: 'IP13-001',
          price: 999,
          quantity: 1,
          stock: 10,
          subtotal: 999,
          isService: false
        }],
        paymentMethod: 'card' as const,
        discount: 0,
        cardNumber: '12'
      }
      
      const result = validateSaleBusinessRules(sale)
      expect(result.valid).toBe(false)
      if (!result.valid) {
        expect(result.errors[0]).toContain('últimos 4 dígitos')
      }
    })
  })
})
