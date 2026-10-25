/**
 * Rate Limiter — dual-mode implementation
 *
 * When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set (production /
 * Vercel), uses @upstash/ratelimit backed by Redis so the limit is shared
 * across all serverless instances. KV_REST_API_URL + KV_REST_API_TOKEN (the
 * names the Vercel Marketplace integration creates) work the same way.
 *
 * When those vars are absent (local dev, CI), falls back to a per-process
 * in-memory Map. The in-memory fallback is NOT shared across serverless
 * instances — do NOT rely on it for production rate limiting. In production
 * a missing Redis is logged once per instance.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import { SHARED_RATE_LIMIT_HINT, sharedRateLimitCredentials } from '@/lib/rate-limit-config'

// ---------------------------------------------------------------------------
// Upstash client — lazily created, shared across requests in the same process.
// ---------------------------------------------------------------------------

const _upstashRatelimiters = new Map<string, Ratelimit>()
let _warnedMissingRedis = false

/**
 * Without Redis in production the limit stays in per-instance memory (useless
 * on Vercel) and the mobile login / password reset answer 503. Logged once per
 * instance so it doesn't go unnoticed.
 */
function warnMissingRedisOnce() {
  if (_warnedMissingRedis || process.env.NODE_ENV !== 'production') return
  _warnedMissingRedis = true
  console.warn(
    `[rate-limiter] Shared Redis missing: set ${SHARED_RATE_LIMIT_HINT}. ` +
      'Without it rate limits are per-instance memory (not effective on Vercel) ' +
      'and mobile login / password reset respond 503.',
  )
}

function getUpstashRatelimiter(max: number, windowMs: number): Ratelimit | null {
  const credentials = sharedRateLimitCredentials()
  if (!credentials) {
    warnMissingRedisOnce()
    return null
  }

  const configKey = `${max}:${windowMs}`
  let ratelimiter = _upstashRatelimiters.get(configKey)

  if (!ratelimiter) {
    const redis = new Redis({ url: credentials.url, token: credentials.token })
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
  async check(identifier: string, maxRequests = 10, windowMs = 15 * 60 * 1000, options: { requireShared?: boolean } = {}): Promise<boolean> {
    const strict = options.requireShared && process.env.NODE_ENV === 'production'
    const upstash = getUpstashRatelimiter(maxRequests, windowMs)
    if (strict && !upstash) throw new Error('Shared rate limiter unavailable')
    if (upstash) {
      try {
        const { success } = await upstash.limit(identifier)
        return success
      } catch (err) {
        if (strict) throw new Error('Shared rate limiter unavailable')
        // Other callers retain their existing development/availability fallback.
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
