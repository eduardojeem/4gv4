/**
 * Tests para error-handler.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POSErrorHandler } from '../error-handler'
import { toast } from 'sonner'

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn()
  }
}))

describe('POSErrorHandler', () => {
  beforeEach(() => {
    POSErrorHandler.clearErrorHistory()
    vi.clearAllMocks()
  })

  describe('Error Handling', () => {
    it('should handle string errors', () => {
      POSErrorHandler.handle('Simple error message', 'sale')
      
      const history = POSErrorHandler.getErrorHistory()
      expect(history).toHaveLength(1)
      expect(history[0].message).toBe('Simple error message')
      expect(history[0].context).toBe('sale')
    })

    it('should handle Error objects', () => {
      const error = new Error('Test error')
      POSErrorHandler.handle(error, 'payment')
      
      const history = POSErrorHandler.getErrorHistory()
      expect(history[0].message).toBe('Test error')
      expect(history[0].context).toBe('payment')
    })

    it('should handle unknown error types', () => {
      POSErrorHandler.handle(null, 'unknown')
      
      const history = POSErrorHandler.getErrorHistory()
      expect(history[0].message).toBe('Error desconocido')
    })

    it('should extract message from various error formats', () => {
      const errors = [
        { message: 'Error message' },
        { error: 'Error description' },
        { error_description: 'Auth error' },
        { details: 'Detailed error' },
        { hint: 'Error hint' }
      ]
      
      errors.forEach((error, index) => {
        POSErrorHandler.handle(error, 'test')
      })
      
      const history = POSErrorHandler.getErrorHistory()
      expect(history).toHaveLength(errors.length)
    })
  })

  describe('User-Friendly Messages', () => {
    it('should convert network errors', () => {
      POSErrorHandler.handle(new Error('Network request failed'), 'network')
      
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('conexión')
      )
    })

    it('should convert auth errors', () => {
      POSErrorHandler.handle(new Error('JWT expired'), 'auth')
      
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('sesión')
      )
    })

    it('should convert duplicate key errors', () => {
      POSErrorHandler.handle(new Error('duplicate key violation'), 'validation')
      
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('ya existe')
      )
    })

    it('should convert timeout errors', () => {
      POSErrorHandler.handle(new Error('Request timeout'), 'network')
      
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('tardó demasiado')
      )
    })

    it('should convert missing table errors', () => {
      POSErrorHandler.handle(
        new Error("Could not find the table 'public.sales'"),
        'sync'
      )
      
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('no disponible')
      )
    })
  })

  describe('Error Classification', () => {
    it('should show warnings for non-critical errors', () => {
      POSErrorHandler.handle(
        new Error('Tabla no encontrada'),
        'sync'
      )
      
      expect(toast.warning).toHaveBeenCalled()
    })

    it('should show errors for critical contexts', () => {
      POSErrorHandler.handle(
        new Error('Payment failed'),
        'payment'
      )
      
      expect(toast.error).toHaveBeenCalled()
    })
  })

  describe('Error History', () => {
    it('should maintain error history', () => {
      POSErrorHandler.handle('Error 1', 'sale')
      POSErrorHandler.handle('Error 2', 'payment')
      POSErrorHandler.handle('Error 3', 'inventory')
      
      const history = POSErrorHandler.getErrorHistory()
      expect(history).toHaveLength(3)
    })

    it('should limit history to 100 errors', () => {
      for (let i = 0; i < 150; i++) {
        POSErrorHandler.handle(`Error ${i}`, 'test')
      }
      
      const history = POSErrorHandler.getErrorHistory()
      expect(history).toHaveLength(100)
    })

    it('should clear error history', () => {
      POSErrorHandler.handle('Error 1', 'sale')
      POSErrorHandler.handle('Error 2', 'payment')
      
      POSErrorHandler.clearErrorHistory()
      
      const history = POSErrorHandler.getErrorHistory()
      expect(history).toHaveLength(0)
    })
  })

  describe('Error Statistics', () => {
    it('should track errors by context', () => {
      POSErrorHandler.handle('Error 1', 'sale')
      POSErrorHandler.handle('Error 2', 'sale')
      POSErrorHandler.handle('Error 3', 'payment')
      
      const stats = POSErrorHandler.getErrorStats()
      expect(stats.sale).toBe(2)
      expect(stats.payment).toBe(1)
    })

    it('should export errors as JSON', () => {
      POSErrorHandler.handle('Error 1', 'sale')
      POSErrorHandler.handle('Error 2', 'payment')
      
      const exported = POSErrorHandler.exportErrors()
      const parsed = JSON.parse(exported)
      
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(2)
    })
  })

  describe('Metadata', () => {
    it('should store metadata with errors', () => {
      const metadata = {
        userId: 'user-123',
        cartTotal: 999,
        itemCount: 3
      }
      
      POSErrorHandler.handle('Sale failed', 'sale', metadata)
      
      const history = POSErrorHandler.getErrorHistory()
      expect(history[0].metadata).toEqual(metadata)
    })

    it('should include timestamp', () => {
      POSErrorHandler.handle('Test error', 'test')
      
      const history = POSErrorHandler.getErrorHistory()
      expect(history[0].timestamp).toBeInstanceOf(Date)
    })
  })

  describe('Context-Specific Messages', () => {
    const contexts = [
      { context: 'sale', expected: 'venta' },
      { context: 'payment', expected: 'pago' },
      { context: 'inventory', expected: 'inventario' },
      { context: 'customer', expected: 'cliente' },
      { context: 'register', expected: 'caja' }
    ]

    contexts.forEach(({ context, expected }) => {
      it(`should include context in message for ${context}`, () => {
        POSErrorHandler.handle('Test error', context as any)
        
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining(expected)
        )
      })
    })
  })
})
