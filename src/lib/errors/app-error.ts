/**
 * AppError - Centralized Error Handling
 * 
 * A structured error class that provides consistent error handling across the application.
 * Includes error classification, context tracking, and recovery actions.
 */

import { ErrorCode, ERROR_MESSAGES, isRecoverableError } from './error-codes'

/**
 * Context information for an error
 */
export interface ErrorContext {
  operation?: string
  userId?: string
  repairId?: string
  timestamp?: string
  [key: string]: any
}

/**
 * Action that can be taken to recover from an error
 */
export interface ErrorAction {
  label: string
  onClick: () => void
}

/**
 * Structured application error with classification and context
 */
export class AppError extends Error {
  public readonly timestamp: string

  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly context?: ErrorContext,
    public readonly action?: ErrorAction,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'AppError'
    this.timestamp = new Date().toISOString()
    
    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  /**
   * Create an AppError from any error type
   * Automatically classifies the error and provides appropriate messaging
   */
  static from(error: unknown, context?: ErrorContext): AppError {
    // Already an AppError, just add context if provided
    if (error instanceof AppError) {
      return new AppError(
        error.code,
        error.message,
        { ...error.context, ...context },
        error.action,
        error.originalError
      )
    }

    // Extract error message
    let message: string
    let originalError: Error | undefined
    if (error instanceof Error) {
      message = error.message
      originalError = error
    } else if (typeof error === 'object' && error !== null && 'message' in (error as any) && typeof (error as any).message === 'string') {
      message = (error as any).message as string
      originalError = new Error(message)
    } else {
      message = String(error)
      originalError = undefined
    }

    // Classify the error
    const code = classifyError(message)
    
    // Get default message for the code
    const defaultMessage = ERROR_MESSAGES[code]
    
    // Create action if error is recoverable
    const action = isRecoverableError(code) ? {
      label: 'Reintentar',
      onClick: () => window.location.reload()
    } : undefined

    return new AppError(
      code,
      code === ErrorCode.UNKNOWN ? (message || defaultMessage) : defaultMessage,
      { ...context, originalMessage: message },
      action,
      originalError
    )
  }

  /**
   * Check if error is an authentication error
   */
  static isAuthError(error: unknown): boolean {
    if (!(error instanceof AppError)) {
      return false
    }
    return [
      ErrorCode.AUTH_EXPIRED,
      ErrorCode.AUTH_INVALID,
      ErrorCode.AUTH_MISSING
    ].includes(error.code)
  }

  /**
   * Check if error is a network error
   */
  static isNetworkError(error: unknown): boolean {
    if (!(error instanceof AppError)) {
      return false
    }
    return [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.NETWORK_TIMEOUT
    ].includes(error.code)
  }

  /**
   * Check if error is a validation error
   */
  static isValidationError(error: unknown): boolean {
    if (!(error instanceof AppError)) {
      return false
    }
    return [
      ErrorCode.VALIDATION_FAILED,
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      ErrorCode.VALIDATION_INVALID_FORMAT
    ].includes(error.code)
  }

  /**
   * Check if error is recoverable (can be retried)
   */
  isRecoverable(): boolean {
    return isRecoverableError(this.code)
  }

  /**
   * Serialize error to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    return this.message
  }
}

/**
 * Classify an error based on its message
 * @internal
 */
function classifyError(message: string): ErrorCode {
  const lowerMessage = message.toLowerCase()

  // Authentication errors
  if (
    lowerMessage.includes('jwt') ||
    lowerMessage.includes('token expired') ||
    lowerMessage.includes('token') && lowerMessage.includes('invalid') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('401')
  ) {
    return ErrorCode.AUTH_EXPIRED
  }

  if (
    lowerMessage.includes('authentication') ||
    lowerMessage.includes('credentials')
  ) {
    return ErrorCode.AUTH_INVALID
  }

  // Network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch failed') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('connection') && lowerMessage.includes('failed')
  ) {
    return ErrorCode.NETWORK_ERROR
  }

  if (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out')
  ) {
    return ErrorCode.NETWORK_TIMEOUT
  }

  // Validation errors
  if (
    lowerMessage.includes('validation') ||
    lowerMessage.includes('invalid') && !lowerMessage.includes('token') ||
    lowerMessage.includes('required') ||
    lowerMessage.includes('must be')
  ) {
    return ErrorCode.VALIDATION_FAILED
  }

  // Server errors
  if (
    lowerMessage.includes('500') ||
    lowerMessage.includes('internal server') ||
    lowerMessage.includes('server error')
  ) {
    return ErrorCode.SERVER_ERROR
  }

  if (
    lowerMessage.includes('404') ||
    lowerMessage.includes('not found')
  ) {
    return ErrorCode.NOT_FOUND
  }

  if (
    lowerMessage.includes('409') ||
    lowerMessage.includes('conflict')
  ) {
    return ErrorCode.CONFLICT
  }

  if (
    lowerMessage.includes('403') ||
    lowerMessage.includes('forbidden')
  ) {
    return ErrorCode.FORBIDDEN
  }

  // Database errors
  if (
    lowerMessage.includes('database') ||
    lowerMessage.includes('relation') && lowerMessage.includes('does not exist') ||
    lowerMessage.includes('table') && lowerMessage.includes('not found')
  ) {
    return ErrorCode.DATABASE_ERROR
  }

  // Default to unknown
  return ErrorCode.UNKNOWN
}
