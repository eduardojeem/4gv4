/**
 * Hook para manejo de errores en componentes POS
 * Proporciona una interfaz React-friendly para el sistema de error handling
 */

import { useCallback, useState, useEffect } from 'react'
import { 
  handlePOSError, 
  handleNetworkError, 
  handlePaymentError, 
  handleInventoryError, 
  handleValidationError,
  getErrorStats,
  getRecentErrors,
  ErrorType,
  ErrorSeverity,
  type POSError 
} from '../utils/error-handler'

interface UseErrorHandlerReturn {
  // Estado de errores
  hasErrors: boolean
  errorCount: number
  lastError: POSError | null
  
  // Funciones de manejo
  handleError: (error: Partial<POSError> & { message: string; type: ErrorType }) => Promise<boolean>
  handleNetworkError: (message: string, code?: string, details?: any) => Promise<boolean>
  handlePaymentError: (message: string, code?: string, details?: any) => Promise<boolean>
  handleInventoryError: (message: string, code?: string, details?: any) => Promise<boolean>
  handleValidationError: (message: string, code?: string, details?: any) => Promise<boolean>
  
  // Utilidades
  clearErrors: () => void
  getStats: () => ReturnType<typeof getErrorStats>
  getRecent: (limit?: number) => POSError[]
  
  // Wrapper para operaciones async
  withErrorHandling: <T>(
    operation: () => Promise<T>,
    errorType: ErrorType,
    context?: string
  ) => Promise<T | null>
}

export const useErrorHandler = (): UseErrorHandlerReturn => {
  const [errorState, setErrorState] = useState({
    hasErrors: false,
    errorCount: 0,
    lastError: null as POSError | null
  })

  // Actualizar estado cuando ocurren errores
  const updateErrorState = useCallback(() => {
    const stats = getErrorStats()
    const recent = getRecentErrors(1)
    
    setErrorState({
      hasErrors: stats.total > 0,
      errorCount: stats.total,
      lastError: recent[0] || null
    })
  }, [])

  // Wrapper para handlePOSError que actualiza el estado
  const handleError = useCallback(async (error: Partial<POSError> & { message: string; type: ErrorType }) => {
    const result = await handlePOSError(error)
    updateErrorState()
    return result
  }, [updateErrorState])

  // Wrappers para errores específicos
  const handleNetworkErrorWithState = useCallback(async (message: string, code?: string, details?: any) => {
    const result = await handleNetworkError(message, code, details)
    updateErrorState()
    return result
  }, [updateErrorState])

  const handlePaymentErrorWithState = useCallback(async (message: string, code?: string, details?: any) => {
    const result = await handlePaymentError(message, code, details)
    updateErrorState()
    return result
  }, [updateErrorState])

  const handleInventoryErrorWithState = useCallback(async (message: string, code?: string, details?: any) => {
    const result = await handleInventoryError(message, code, details)
    updateErrorState()
    return result
  }, [updateErrorState])

  const handleValidationErrorWithState = useCallback(async (message: string, code?: string, details?: any) => {
    const result = await handleValidationError(message, code, details)
    updateErrorState()
    return result
  }, [updateErrorState])

  // Limpiar errores
  const clearErrors = useCallback(() => {
    // Note: clearErrorLog está disponible pero no la usamos aquí para mantener el historial
    setErrorState({
      hasErrors: false,
      errorCount: 0,
      lastError: null
    })
  }, [])

  // Wrapper para operaciones con manejo automático de errores
  const withErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    errorType: ErrorType,
    context?: string
  ): Promise<T | null> => {
    try {
      return await operation()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operación falló'
      const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined
      
      await handleError({
        type: errorType,
        severity: ErrorSeverity.MEDIUM,
        message: errorMessage,
        code: errorCode,
        context,
        details: error instanceof Error ? { stack: error.stack } : { error }
      })
      
      return null
    }
  }, [handleError])

  // Actualizar estado inicial
  useEffect(() => {
    updateErrorState()
  }, [updateErrorState])

  return {
    // Estado
    hasErrors: errorState.hasErrors,
    errorCount: errorState.errorCount,
    lastError: errorState.lastError,
    
    // Funciones de manejo
    handleError,
    handleNetworkError: handleNetworkErrorWithState,
    handlePaymentError: handlePaymentErrorWithState,
    handleInventoryError: handleInventoryErrorWithState,
    handleValidationError: handleValidationErrorWithState,
    
    // Utilidades
    clearErrors,
    getStats: getErrorStats,
    getRecent: getRecentErrors,
    withErrorHandling
  }
}

// Hook especializado para operaciones de red
export const useNetworkErrorHandler = () => {
  const { withErrorHandling, handleNetworkError } = useErrorHandler()
  
  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    context?: string
  ): Promise<T | null> => {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt === maxRetries) {
          await handleNetworkError(
            `Operación falló después de ${maxRetries} intentos: ${lastError.message}`,
            'MAX_RETRIES_EXCEEDED',
            { attempts: maxRetries, context }
          )
          break
        }
        
        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
    
    return null
  }, [handleNetworkError])

  return {
    executeWithRetry,
    withNetworkErrorHandling: (operation: () => Promise<any>, context?: string) =>
      withErrorHandling(operation, ErrorType.NETWORK, context)
  }
}

// Hook para validación con manejo de errores
export const useValidationErrorHandler = () => {
  const { handleValidationError } = useErrorHandler()
  
  const validateAndHandle = useCallback(async <T>(
    data: T,
    validator: (data: T) => Promise<boolean> | boolean,
    errorMessage: string,
    context?: string
  ): Promise<boolean> => {
    try {
      const isValid = await validator(data)
      
      if (!isValid) {
        await handleValidationError(errorMessage, 'VALIDATION_FAILED', { data, context })
        return false
      }
      
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error de validación'
      await handleValidationError(message, 'VALIDATION_ERROR', { data, context, error })
      return false
    }
  }, [handleValidationError])

  return { validateAndHandle }
}