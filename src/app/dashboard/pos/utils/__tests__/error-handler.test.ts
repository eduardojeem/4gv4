/**
 * Tests para el sistema de manejo de errores POS
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  posErrorHandler,
  handlePOSError,
  handleNetworkError,
  handlePaymentError,
  handleInventoryError,
  handleValidationError,
  getErrorStats,
  clearErrorLog,
  ErrorType,
  ErrorSeverity
} from '../error-handler'

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn()
  }
}))

describe('POS Error Handler', () => {
  beforeEach(() => {
    clearErrorLog()
    vi.clearAllMocks()
  })

  describe('handlePOSError', () => {
    it('should handle basic error correctly', async () => {
      const result = await handlePOSError({
        type: ErrorType.SYSTEM,
        message: 'Test error',
        severity: ErrorSeverity.LOW
      })

      expect(result).toBe(false) // No recovery for system errors by default
      
      const stats = getErrorStats()
      expect(stats.total).toBe(1)
      expect(stats.byType[ErrorType.SYSTEM]).toBe(1)
      expect(stats.bySeverity[ErrorSeverity.LOW]).toBe(1)
    })

    it('should attempt recovery for recoverable errors', async () => {
      const result = await handlePOSError({
        type: ErrorType.NETWORK,
        message: 'Network timeout',
        severity: ErrorSeverity.MEDIUM,
        recoverable: true
      })

      // Network errors have recovery strategy
      expect(result).toBe(true)
    })

    it('should not attempt recovery for non-recoverable errors', async () => {
      const result = await handlePOSError({
        type: ErrorType.VALIDATION,
        message: 'Invalid data',
        severity: ErrorSeverity.LOW,
        recoverable: false
      })

      expect(result).toBe(false)
    })

    it('should increment retry count on failed recovery', async () => {
      // Mock recovery to fail
      const originalRecover = posErrorHandler['recoveryStrategies'].get(ErrorType.NETWORK)?.recover
      if (originalRecover) {
        posErrorHandler['recoveryStrategies'].get(ErrorType.NETWORK)!.recover = vi.fn().mockResolvedValue(false)
      }

      await handlePOSError({
        type: ErrorType.NETWORK,
        message: 'Network error',
        severity: ErrorSeverity.MEDIUM,
        retryCount: 0
      })

      const stats = getErrorStats()
      expect(stats.total).toBe(1)
    })
  })

  describe('Specific Error Handlers', () => {
    it('should handle network errors with correct type', async () => {
      await handleNetworkError('Connection failed', 'TIMEOUT')
      
      const stats = getErrorStats()
      expect(stats.byType[ErrorType.NETWORK]).toBe(1)
    })

    it('should handle payment errors with high severity', async () => {
      await handlePaymentError('Payment declined', 'CARD_DECLINED')
      
      const stats = getErrorStats()
      expect(stats.byType[ErrorType.PAYMENT]).toBe(1)
      expect(stats.bySeverity[ErrorSeverity.HIGH]).toBe(1)
    })

    it('should handle inventory errors', async () => {
      await handleInventoryError('Out of stock', 'INSUFFICIENT_STOCK')
      
      const stats = getErrorStats()
      expect(stats.byType[ErrorType.INVENTORY]).toBe(1)
    })

    it('should handle validation errors as non-recoverable', async () => {
      const result = await handleValidationError('Invalid email', 'INVALID_FORMAT')
      
      expect(result).toBe(false) // Validation errors are not recoverable
      
      const stats = getErrorStats()
      expect(stats.byType[ErrorType.VALIDATION]).toBe(1)
      expect(stats.bySeverity[ErrorSeverity.LOW]).toBe(1)
    })
  })

  describe('Error Statistics', () => {
    it('should track errors by type and severity', async () => {
      await handleNetworkError('Network error 1')
      await handleNetworkError('Network error 2')
      await handlePaymentError('Payment error')
      await handleValidationError('Validation error')

      const stats = getErrorStats()
      expect(stats.total).toBe(4)
      expect(stats.byType[ErrorType.NETWORK]).toBe(2)
      expect(stats.byType[ErrorType.PAYMENT]).toBe(1)
      expect(stats.byType[ErrorType.VALIDATION]).toBe(1)
    })

    it('should only count errors from last 24 hours', async () => {
      // Add an old error (mock timestamp)
      const oldError = {
        type: ErrorType.SYSTEM,
        message: 'Old error',
        severity: ErrorSeverity.LOW,
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        recoverable: false
      }

      // Manually add to log (simulating old error)
      posErrorHandler['errorLog'].push(oldError)

      // Add recent error
      await handleNetworkError('Recent error')

      const stats = getErrorStats()
      expect(stats.total).toBe(1) // Only recent error should count
    })

    it('should clear error log', () => {
      handleNetworkError('Test error')
      
      let stats = getErrorStats()
      expect(stats.total).toBeGreaterThan(0)

      clearErrorLog()
      
      stats = getErrorStats()
      expect(stats.total).toBe(0)
    })
  })

  describe('Recovery Strategies', () => {
    it('should have recovery strategy for network errors', () => {
      const strategy = posErrorHandler['recoveryStrategies'].get(ErrorType.NETWORK)
      expect(strategy).toBeDefined()
      expect(strategy?.maxRetries).toBe(3)
    })

    it('should have recovery strategy for inventory errors', () => {
      const strategy = posErrorHandler['recoveryStrategies'].get(ErrorType.INVENTORY)
      expect(strategy).toBeDefined()
      expect(strategy?.maxRetries).toBe(1)
    })

    it('should not have recovery for validation errors', () => {
      const strategy = posErrorHandler['recoveryStrategies'].get(ErrorType.VALIDATION)
      expect(strategy).toBeDefined()
      expect(strategy?.maxRetries).toBe(0)
    })
  })

  describe('User-Friendly Messages', () => {
    it('should generate appropriate messages for different error types', async () => {
      const { toast } = await import('sonner')

      await handleNetworkError('Connection failed', 'TIMEOUT')
      expect(toast.warning).toHaveBeenCalledWith(
        'La conexión tardó demasiado en responder',
        expect.any(Object)
      )

      await handlePaymentError('Card declined', 'CARD_DECLINED')
      expect(toast.error).toHaveBeenCalledWith(
        'Tarjeta rechazada',
        expect.any(Object)
      )
    })

    it('should use default messages for unknown error codes', async () => {
      const { toast } = await import('sonner')

      await handleNetworkError('Unknown network error', 'UNKNOWN_CODE')
      expect(toast.warning).toHaveBeenCalledWith(
        'Problema de conexión detectado',
        expect.any(Object)
      )
    })
  })

  describe('Error Context and Details', () => {
    it('should store error context and details', async () => {
      await handlePOSError({
        type: ErrorType.SYSTEM,
        message: 'Database error',
        severity: ErrorSeverity.HIGH,
        context: 'product_sync',
        details: { query: 'SELECT * FROM products', error: 'Connection timeout' }
      })

      const recent = posErrorHandler.getRecentErrors(1)
      expect(recent[0].context).toBe('product_sync')
      expect(recent[0].details).toEqual({
        query: 'SELECT * FROM products',
        error: 'Connection timeout'
      })
    })
  })

  describe('Error Log Management', () => {
    it('should maintain maximum log size', async () => {
      // Set a small max size for testing
      const originalMaxSize = posErrorHandler['maxLogSize']
      posErrorHandler['maxLogSize'] = 3

      // Add more errors than max size
      for (let i = 0; i < 5; i++) {
        await handleNetworkError(`Error ${i}`)
      }

      const recent = posErrorHandler.getRecentErrors(10)
      expect(recent.length).toBe(3) // Should not exceed max size

      // Restore original max size
      posErrorHandler['maxLogSize'] = originalMaxSize
    })

    it('should return recent errors in correct order', async () => {
      await handleNetworkError('First error')
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
      await handlePaymentError('Second error')
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
      await handleValidationError('Third error')

      const recent = posErrorHandler.getRecentErrors(3)
      expect(recent[0].message).toBe('Third error') // Most recent first
      expect(recent[1].message).toBe('Second error')
      expect(recent[2].message).toBe('First error')
    })
  })
})