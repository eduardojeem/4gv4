/**
 * useErrorHandler - Hook for centralized error handling
 * 
 * Provides a consistent way to handle errors across the application with:
 * - Automatic error classification
 * - Toast notifications
 * - Structured logging
 * - Recovery actions
 */

import { useCallback } from 'react'
import { toast } from 'sonner'
import { AppError, ErrorContext } from '@/lib/errors/app-error'
import { logger } from '@/lib/logging'

export interface UseErrorHandlerOptions {
  /**
   * Custom error handler callback
   */
  onError?: (error: AppError) => void
  
  /**
   * Whether to show toast notifications
   * @default true
   */
  showToast?: boolean
  
  /**
   * Whether to log errors to console/service
   * @default true
   */
  logError?: boolean
  
  /**
   * Context to add to all errors handled by this instance
   */
  defaultContext?: ErrorContext
}

/**
 * Hook for handling errors with automatic classification, logging, and user feedback
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const {
    onError,
    showToast = true,
    logError = true,
    defaultContext
  } = options

  /**
   * Handle an error with classification, logging, and user feedback
   */
  const handleError = useCallback((
    error: unknown,
    context?: ErrorContext
  ): AppError => {
    // Create AppError with combined context
    const appError = AppError.from(error, {
      ...defaultContext,
      ...context
    })

    // Log error if enabled
    if (logError) {
      logger.error(appError.getUserMessage(), appError.toJSON())
    }

    // Show toast notification if enabled
    if (showToast) {
      showErrorToast(appError)
    }

    // Call custom error handler if provided
    onError?.(appError)

    return appError
  }, [onError, showToast, logError, defaultContext])

  return { handleError }
}

/**
 * Show a toast notification for an error
 * @internal
 */
function showErrorToast(error: AppError) {
  const message = error.getUserMessage()
  
  // If error has a recovery action, show it in the toast
  if (error.action) {
    toast.error(message, {
      action: {
        label: error.action.label,
        onClick: error.action.onClick
      },
      duration: 5000
    })
  } else {
    toast.error(message, {
      duration: 4000
    })
  }
}
