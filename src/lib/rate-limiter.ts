/**
 * Rate Limiter — dual-mode implementation
 *
 * When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set (production /
 * Vercel), uses @upstash/ratelimit backed by Redis so the limit is shared
 * across all serverless instances.
 *
 * When those vars are absent (local dev, CI), falls back to a per-process
 * in-memory Map. The in-memory fallback is NOT shared across serverless
 * instances — do NOT rely on it for production rate limiting.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ---------------------------------------------------------------------------
// Upstash client — lazily created, shared across requests in the same process.
// ---------------------------------------------------------------------------

const _upstashRatelimiters = new Map<string, Ratelimit>()

function getUpstashRatelimiter(max: number, windowMs: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  const configKey = `${max}:${windowMs}`
  let ratelimiter = _upstashRatelimiters.get(configKey)

  if (!ratelimiter) {
    const redis = new Redis({ url, token })
    ratelimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, `${windowMs}ms`),
      analytics: false,
      prefix: `4gv4:rl:${configKey}`,
    })
    _upstashRatelimiters.set(configKey, ratelimiter)
  }

  return ratelimiter
}

// ---------------------------------------------------------------------------
// In-memory fallback (dev / local)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  resetAt: number
}

class InMemoryRateLimiter {
  private readonly requests: Map<string, RateLimitEntry> = new Map()
  private readonly cleanupInterval: ReturnType<typeof setInterval>

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000)
  }

  check(identifier: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now()
    const entry = this.requests.get(identifier)

    if (!entry || now > entry.resetAt) {
      this.requests.set(identifier, { count: 1, resetAt: now + windowMs })
      return true
    }
    if (entry.count >= maxRequests) return false
    entry.count++
    return true
  }

  getResetTime(identifier: string): number {
    const entry = this.requests.get(identifier)
    if (!entry) return 0
    const remaining = entry.resetAt - Date.now()
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0
  }

  reset(identifier: string): void {
    this.requests.delete(identifier)
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetAt) this.requests.delete(key)
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.requests.clear()
  }
}

const _inMemory = new InMemoryRateLimiter()

// ---------------------------------------------------------------------------
// Public API — same surface as the old class so all callers stay unchanged.
// check() is now async (callers in route.ts already await it).
// ---------------------------------------------------------------------------

export const rateLimiter = {
  /**
   * Returns true if the request is allowed, false if rate-limited.
   * Uses Upstash when credentials are present; falls back to in-memory.
   */
  async check(identifier: string, maxRequests = 10, windowMs = 15 * 60 * 1000): Promise<boolean> {
    const upstash = getUpstashRatelimiter(maxRequests, windowMs)
    if (upstash) {
      try {
        const { success } = await upstash.limit(identifier)
        return success
      } catch (err) {
        // Upstash temporarily unreachable: fail open and use in-memory.
        console.error('[rate-limiter] Upstash error, falling back to in-memory:', err)
        return _inMemory.check(identifier, maxRequests, windowMs)
      }
    }
    return _inMemory.check(identifier, maxRequests, windowMs)
  },

  /** Seconds until reset (best-effort; Upstash doesn't expose this without an extra round-trip). */
  getResetTime(identifier: string): number {
    return _inMemory.getResetTime(identifier)
  },

  reset(identifier: string): void {
    _inMemory.reset(identifier)
  },
}

// ---------------------------------------------------------------------------
// IP extraction helper
// ---------------------------------------------------------------------------

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return request.headers.get('x-real-ip') ?? 'unknown'
}
