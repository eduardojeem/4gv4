/**
 * Cache en memoria de los alias de slug de organizacion.
 *
 * El middleware consultaba Supabase en CADA request a una ruta publica de
 * tienda para ver si el slug habia cambiado de nombre. Es un dato que casi nunca
 * cambia, asi que ese viaje de red se pagaba una y otra vez antes de renderizar.
 *
 * Se cachea tambien el resultado negativo ("este slug no tiene alias"), que es
 * el caso de practicamente todas las tiendas: sin eso el cache no serviria de
 * nada, porque el camino comun seguiria yendo a la base.
 */

const TTL_MS = 5 * 60 * 1000

/**
 * Tope de entradas. Sin el, pedir slugs inexistentes al azar haria crecer el
 * mapa sin limite, porque cada uno guardaria su propio "no tiene alias".
 */
const MAX_ENTRIES = 500

type Entry = { value: string | null; expiresAt: number }

const cache = new Map<string, Entry>()

/**
 * @returns `undefined` si no hay dato cacheado (hay que consultar),
 *          `null` si se sabe que no tiene alias, o el slug destino.
 */
export function getCachedSlugAlias(slug: string, now = Date.now()): string | null | undefined {
  const entry = cache.get(slug)
  if (!entry) return undefined

  if (entry.expiresAt <= now) {
    cache.delete(slug)
    return undefined
  }

  // Re-insertar lo mantiene como el mas reciente para el desalojo por antiguedad.
  cache.delete(slug)
  cache.set(slug, entry)
  return entry.value
}

export function setCachedSlugAlias(slug: string, value: string | null, now = Date.now()): void {
  if (cache.size >= MAX_ENTRIES && !cache.has(slug)) {
    // Map conserva el orden de insercion: el primero es el menos usado.
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }

  cache.set(slug, { value, expiresAt: now + TTL_MS })
}

/** Solo para tests. */
export function clearSlugAliasCache(): void {
  cache.clear()
}

export const SLUG_ALIAS_TTL_MS = TTL_MS
export const SLUG_ALIAS_MAX_ENTRIES = MAX_ENTRIES
