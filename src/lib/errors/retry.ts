/**
 * Retry Logic with Exponential Backoff
 * 
 * Provides automatic retry functionality for failed operations with:
 * - Exponential backoff between retries
 * - Configurable retry attempts and delays
 * - Smart error classification (don't retry validation/auth errors)
 */

import { AppError } from './app-error'
import { logger } from '@/lib/logging'

export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 3
   */
  maxAttempts?: number
  
  /**
   * Base delay in milliseconds before first retry
   * @default 1000
   */
  baseDelay?: number
  
  /**
   * Maximum delay in milliseconds between retries
   * @default 10000
   */
  maxDelay?: number
  
  /**
   * Multiplier for exponential backoff
   * @default 2
   */
  backoffMultiplier?: number
  
  /**
   * Callback called before each retry attempt
   */
  onRetry?: (attempt: number, error: Error) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  onRetry: () => {}
}

/**
 * Check if an error should be retried
 */
function shouldRetry(error: unknown): boolean {
  // Don't retry validation errors
  if (AppError.isValidationError(error)) {
    return false
  }
  
  // Don't retry authentication errors (except expired tokens which might refresh)
  if (AppError.isAuthError(error)) {
    const appError = error as AppError
    // Only retry expired tokens, not invalid credentials
    return appError.code === 'AUTH_EXPIRED'
  }
  
  // Retry network errors and server errors
  return true
}

/**
 * Calculate delay for a given attempt using exponential backoff
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number {
  const delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1)
  return Math.min(delay, maxDelay)
}

/**
 * Execute a function with automatic retry on failure
 * 
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise that resolves with the function result or rejects with the last error
 * 
 * @example
 * ```typescript
 * const data = await withRetry(
 *   () => fetchRepairs(),
 *   { maxAttempts: 3, baseDelay: 1000 }
 * )
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      // Attempt to execute the function
      const result = await fn()
      
      // Log successful retry if this wasn't the first attempt
      if (attempt > 1) {
        logger.info(`Operation succeeded after ${attempt} attempts`)
      }
      
      return result
    } catch (error) {
      lastError = error as Error
      
      // Convert to AppError for classification
      const appError = AppError.from(error)
      
      // Check if we should retry this error
      if (!shouldRetry(appError)) {
        logger.warn('Error is not retryable, failing immediately', {
          code: appError.code,
          message: appError.message
        })
        throw appError
      }
      
      // Check if we have more attempts left
      if (attempt >= opts.maxAttempts) {
        logger.error(`Operation failed after ${attempt} attempts`, {
          code: appError.code,
          message: appError.message
        })
        throw appError
      }
      
      // Calculate delay before next retry
      const delay = calculateDelay(
        attempt,
        opts.baseDelay,
        opts.maxDelay,
        opts.backoffMultiplier
      )
      
      // Log retry attempt
      logger.warn(`Retry attempt ${attempt}/${opts.maxAttempts} after ${delay}ms`, {
        code: appError.code,
        message: appError.message
      })
      
      // Call onRetry callback
      opts.onRetry(attempt, lastError)
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!
}

/**
 * Create a retryable version of an async function
 * 
 * @param fn - Async function to make retryable
 * @param options - Retry configuration options
 * @returns A new function that automatically retries on failure
 * 
 * @example
 * ```typescript
 * const fetchWithRetry = retryable(fetchRepairs, { maxAttempts: 3 })
 * const data = await fetchWithRetry()
 * ```
 */
export function retryable<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options)
}
