/**
 * Rate Limiter
 * Simple in-memory rate limiting for public APIs
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  /**
   * Check if request is allowed
   * @param identifier - Usually IP address
   * @param maxRequests - Maximum requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns true if allowed, false if rate limited
   */
  check(identifier: string, maxRequests: number = 10, windowMs: number = 15 * 60 * 1000): boolean {
    const now = Date.now()
    const entry = this.requests.get(identifier)

    if (!entry || now > entry.resetAt) {
      // New window or expired
      this.requests.set(identifier, {
        count: 1,
        resetAt: now + windowMs
      })
      return true
    }

    if (entry.count >= maxRequests) {
      // Rate limit exceeded
      return false
    }

    // Increment count
    entry.count++
    this.requests.set(identifier, entry)
    return true
  }

  /**
   * Get remaining time until reset (in seconds)
   */
  getResetTime(identifier: string): number {
    const entry = this.requests.get(identifier)
    if (!entry) return 0

    const now = Date.now()
    if (now > entry.resetAt) return 0

    return Math.ceil((entry.resetAt - now) / 1000)
  }

  /**
   * Get current count for identifier
   */
  getCount(identifier: string): number {
    const entry = this.requests.get(identifier)
    if (!entry || Date.now() > entry.resetAt) return 0
    return entry.count
  }

  /**
   * Clear rate limit for identifier (for testing)
   */
  reset(identifier: string): void {
    this.requests.delete(identifier)
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetAt) {
        this.requests.delete(key)
      }
    }
  }

  /**
   * Destroy the rate limiter (clear interval)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.requests.clear()
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter()

/**
 * Helper to get client IP from request
 */
export function getClientIp(request: Request): string {
  // Check various headers for IP
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback to a generic identifier
  return 'unknown'
}
