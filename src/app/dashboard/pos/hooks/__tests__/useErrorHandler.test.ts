/**
 * Tests para el hook useErrorHandler
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useErrorHandler, useNetworkErrorHandler, useValidationErrorHandler } from '../useErrorHandler'
import { ErrorType, ErrorSeverity, clearErrorLog } from '../../utils/error-handler'

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn()
  }
}))

describe('useErrorHandler', () => {
  beforeEach(() => {
    clearErrorLog()
    vi.clearAllMocks()
  })

  it('should initialize with no errors', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    expect(result.current.hasErrors).toBe(false)
    expect(result.current.errorCount).toBe(0)
    expect(result.current.lastError).toBeNull()
  })

  it('should update state when error occurs', async () => {
    const { result } = renderHook(() => useErrorHandler())
    
    await act(async () => {
      await result.current.handleError({
        type: ErrorType.NETWORK,
        message: 'Test network error',
        severity: ErrorSeverity.MEDIUM
      })
    })
    
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.errorCount).toBe(1)
    expect(result.current.lastError).not.toBeNull()
    expect(result.current.lastError?.message).toBe('Test network error')
  })

  it('should handle network errors', async () => {
    const { result } = renderHook(() => useErrorHandler())
    
    await act(async () => {
      await result.current.handleNetworkError('Connection failed', 'TIMEOUT')
    })
    
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.lastError?.type).toBe(ErrorType.NETWORK)
  })

  it('should handle payment errors', async () => {
    const { result } = renderHook(() => useErrorHandler())
    
    await act(async () => {
      await result.current.handlePaymentError('Card declined', 'CARD_DECLINED')
    })
    
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.lastError?.type).toBe(ErrorType.PAYMENT)
  })

  it('should handle inventory errors', async () => {
    const { result } = renderHook(() => useErrorHandler())
    
    await act(async () => {
      await result.current.handleInventoryError('Out of stock', 'INSUFFICIENT_STOCK')
    })
    
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.lastError?.type).toBe(ErrorType.INVENTORY)
  })

  it('should handle validation errors', async () => {
    const { result } = renderHook(() => useErrorHandler())
    
    await act(async () => {
      await result.current.handleValidationError('Invalid email', 'INVALID_FORMAT')
    })
    
    expect(result.current.hasErrors).toBe(true)
    expect(result.current.lastError?.type).toBe(ErrorType.VALIDATION)
  })

  it('should clear errors', async () => {
    const { result } = renderHook(() => useErrorHandler())
    
    // Add an error first
    await act(async () => {
      await result.current.handleError({
        type: ErrorType.SYSTEM,
        message: 'Test error'
      })
    })
    
    expect(result.current.hasErrors).toBe(true)
    
    // Clear errors
    act(() => {
      result.current.clearErrors()
    })
    
    expect(result.current.hasErrors).toBe(false)
    expect(result.current.errorCount).toBe(0)
    expect(result.current.lastError).toBeNull()
  })

  it('should provide error statistics', async () => {
    const { result } = renderHook(() => useErrorHandler())
    
    await act(async () => {
      await result.current.handleNetworkError('Network error 1')
      await result.current.handleNetworkError('Network error 2')
      await result.current.handlePaymentError('Payment error')
    })
    
    const stats = result.current.getStats()
    expect(stats.total).toBe(3)
    expect(stats.byType[ErrorType.NETWORK]).toBe(2)
    expect(stats.byType[ErrorType.PAYMENT]).toBe(1)
  })

  it('should provide recent errors', async () => {
    const { result } = renderHook(() => useErrorHandler())
    
    await act(async () => {
      await result.current.handleError({
        type: ErrorType.SYSTEM,
        message: 'First error'
      })
      await result.current.handleError({
        type: ErrorType.NETWORK,
        message: 'Second error'
      })
    })
    
    const recent = result.current.getRecent(2)
    expect(recent).toHaveLength(2)
    expect(recent[0].message).toBe('Second error') // Most recent first
    expect(recent[1].message).toBe('First error')
  })

  describe('withErrorHandling wrapper', () => {
    it('should handle successful operations', async () => {
      const { result } = renderHook(() => useErrorHandler())
      
      const successfulOperation = vi.fn().mockResolvedValue('success')
      
      let operationResult: string | null = null
      await act(async () => {
        operationResult = await result.current.withErrorHandling(
          successfulOperation,
          ErrorType.SYSTEM,
          'test_context'
        )
      })
      
      expect(operationResult).toBe('success')
      expect(successfulOperation).toHaveBeenCalled()
      expect(result.current.hasErrors).toBe(false)
    })

    it('should handle failed operations', async () => {
      const { result } = renderHook(() => useErrorHandler())
      
      const failedOperation = vi.fn().mockRejectedValue(new Error('Operation failed'))
      
      let operationResult: string | null = 'initial'
      await act(async () => {
        operationResult = await result.current.withErrorHandling(
          failedOperation,
          ErrorType.SYSTEM,
          'test_context'
        )
      })
      
      expect(operationResult).toBeNull()
      expect(failedOperation).toHaveBeenCalled()
      expect(result.current.hasErrors).toBe(true)
      expect(result.current.lastError?.message).toBe('Operation failed')
      expect(result.current.lastError?.context).toBe('test_context')
    })

    it('should handle non-Error exceptions', async () => {
      const { result } = renderHook(() => useErrorHandler())
      
      const failedOperation = vi.fn().mockRejectedValue('String error')
      
      let operationResult: string | null = 'initial'
      await act(async () => {
        operationResult = await result.current.withErrorHandling(
          failedOperation,
          ErrorType.SYSTEM,
          'test_context'
        )
      })
      
      expect(operationResult).toBeNull()
      expect(result.current.hasErrors).toBe(true)
      expect(result.current.lastError?.message).toBe('Operación falló')
    })
  })
})

describe('useNetworkErrorHandler', () => {
  beforeEach(() => {
    clearErrorLog()
    vi.clearAllMocks()
  })

  it('should retry operations on failure', async () => {
    const { result } = renderHook(() => useNetworkErrorHandler())
    
    let attemptCount = 0
    const flakyOperation = vi.fn().mockImplementation(() => {
      attemptCount++
      if (attemptCount < 3) {
        throw new Error(`Attempt ${attemptCount} failed`)
      }
      return Promise.resolve('success')
    })
    
    let operationResult: string | null = null
    await act(async () => {
      operationResult = await result.current.executeWithRetry(
        flakyOperation,
        3,
        'test_retry'
      )
    })
    
    expect(operationResult).toBe('success')
    expect(flakyOperation).toHaveBeenCalledTimes(3)
  })

  it('should fail after max retries', async () => {
    const { result } = renderHook(() => useNetworkErrorHandler())
    
    const alwaysFailOperation = vi.fn().mockRejectedValue(new Error('Always fails'))
    
    let operationResult: string | null = 'initial'
    await act(async () => {
      operationResult = await result.current.executeWithRetry(
        alwaysFailOperation,
        2,
        'test_max_retries'
      )
    })
    
    expect(operationResult).toBeNull()
    expect(alwaysFailOperation).toHaveBeenCalledTimes(2)
  })

  it('should provide network error handling wrapper', async () => {
    const { result } = renderHook(() => useNetworkErrorHandler())
    
    const networkOperation = vi.fn().mockRejectedValue(new Error('Network timeout'))
    
    let operationResult: string | null = 'initial'
    await act(async () => {
      operationResult = await result.current.withNetworkErrorHandling(
        networkOperation,
        'network_test'
      )
    })
    
    expect(operationResult).toBeNull()
    expect(networkOperation).toHaveBeenCalled()
  })
})

describe('useValidationErrorHandler', () => {
  beforeEach(() => {
    clearErrorLog()
    vi.clearAllMocks()
  })

  it('should validate data successfully', async () => {
    const { result } = renderHook(() => useValidationErrorHandler())
    
    const validData = { email: 'test@example.com' }
    const validator = vi.fn().mockReturnValue(true)
    
    let isValid = false
    await act(async () => {
      isValid = await result.current.validateAndHandle(
        validData,
        validator,
        'Invalid email format',
        'email_validation'
      )
    })
    
    expect(isValid).toBe(true)
    expect(validator).toHaveBeenCalledWith(validData)
  })

  it('should handle validation failure', async () => {
    const { result } = renderHook(() => useValidationErrorHandler())
    
    const invalidData = { email: 'invalid-email' }
    const validator = vi.fn().mockReturnValue(false)
    
    let isValid = true
    await act(async () => {
      isValid = await result.current.validateAndHandle(
        invalidData,
        validator,
        'Invalid email format',
        'email_validation'
      )
    })
    
    expect(isValid).toBe(false)
    expect(validator).toHaveBeenCalledWith(invalidData)
  })

  it('should handle validator exceptions', async () => {
    const { result } = renderHook(() => useValidationErrorHandler())
    
    const testData = { email: 'test@example.com' }
    const validator = vi.fn().mockRejectedValue(new Error('Validator crashed'))
    
    let isValid = true
    await act(async () => {
      isValid = await result.current.validateAndHandle(
        testData,
        validator,
        'Validation failed',
        'validator_test'
      )
    })
    
    expect(isValid).toBe(false)
    expect(validator).toHaveBeenCalledWith(testData)
  })

  it('should handle async validators', async () => {
    const { result } = renderHook(() => useValidationErrorHandler())
    
    const testData = { email: 'test@example.com' }
    const asyncValidator = vi.fn().mockResolvedValue(true)
    
    let isValid = false
    await act(async () => {
      isValid = await result.current.validateAndHandle(
        testData,
        asyncValidator,
        'Async validation failed',
        'async_validation'
      )
    })
    
    expect(isValid).toBe(true)
    expect(asyncValidator).toHaveBeenCalledWith(testData)
  })
})