type CacheStorage = Pick<Storage, 'removeItem'>

/**
 * Descarta la copia persistida y solicita una revalidación sin recargar el
 * documento. Así se conservan formularios, modales y navegación en curso.
 */
export function clearPersistentCacheInBackground(
  storage: CacheStorage,
  requestBackgroundRefresh: () => void,
): void {
  storage.removeItem('swr_cache_v1')
  requestBackgroundRefresh()
}
