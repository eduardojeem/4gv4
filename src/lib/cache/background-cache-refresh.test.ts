import { describe, expect, it, vi } from 'vitest'

import { clearPersistentCacheInBackground } from './background-cache-refresh'

describe('clearPersistentCacheInBackground', () => {
  it('clears the persistent cache and requests a background refresh without reloading', () => {
    const removeItem = vi.fn()
    const requestBackgroundRefresh = vi.fn()

    clearPersistentCacheInBackground({ removeItem }, requestBackgroundRefresh)

    expect(removeItem).toHaveBeenCalledWith('swr_cache_v1')
    expect(requestBackgroundRefresh).toHaveBeenCalledOnce()
  })
})
