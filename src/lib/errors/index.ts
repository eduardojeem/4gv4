/**
 * Error Handling Module
 * 
 * Centralized error handling utilities for the application.
 * Provides structured error classification, logging, and recovery.
 */

export { AppError } from './app-error'
export type { ErrorContext, ErrorAction } from './app-error'
export { ErrorCode, ERROR_MESSAGES, isRecoverableError, requiresUserAction } from './error-codes'
export { withRetry, retryable } from './retry'
export type { RetryOptions } from './retry'
