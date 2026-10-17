/** Browser memory only. Callers must key user, org, branch, period and authorization. */
type Options = { signal?: AbortSignal; force?: boolean; ttlMs?: number }
type Entry = { value: unknown; expiresAt: number }
const entries = new Map<string, Entry>()
const pending = new Map<string, symbol>()
let generation = 0
let listening = false
let activeScope: string | null = null

/** Called by useTenantScope; changes/logout invalidate pending and settled values. */
export function synchronizeDashboardSummaryScope(scope: string): void {
  if (typeof window === 'undefined' || activeScope === scope) return
  activeScope = scope
  clearDashboardSummaryCache()
}

export function clearDashboardSummaryCache(): void {
  entries.clear()
  pending.clear()
  generation += 1
}

export async function getCachedDashboardSummary<T>(key: string, load: () => Promise<T>, options: Options = {}): Promise<T> {
  const { signal } = options
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const browser = typeof window !== 'undefined'
  if (browser && !listening) {
    window.addEventListener('organization:changed', clearDashboardSummaryCache)
    listening = true
  }
  if (browser && !options.force) {
    const cached = entries.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      entries.delete(key); entries.set(key, cached)
      return structuredClone(cached.value) as T
    }
    entries.delete(key)
  }
  const token = Symbol(key)
  const startedGeneration = generation
  if (browser) pending.set(key, token)
  let onAbort: (() => void) | undefined
  try {
    const operation = load()
    const value = signal ? await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
        signal.addEventListener('abort', onAbort, { once: true })
        if (signal.aborted) onAbort()
      }),
    ]) : await operation
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const snapshot = structuredClone(value)
    if (browser && generation === startedGeneration && pending.get(key) === token) {
      entries.delete(key)
      const ttl = Number.isFinite(options.ttlMs) ? Math.max(0, options.ttlMs!) : 30_000
      entries.set(key, { value: snapshot, expiresAt: Date.now() + ttl })
      while (entries.size > 25) entries.delete(entries.keys().next().value!)
    }
    return structuredClone(snapshot)
  } finally {
    if (onAbort) signal?.removeEventListener('abort', onAbort)
    if (browser && pending.get(key) === token) pending.delete(key)
  }
}
