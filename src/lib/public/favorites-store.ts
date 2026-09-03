'use client'
import { useSyncExternalStore } from 'react'
import { favoriteKey, favoriteListSchema, favoriteSchema, mergeFavorites, type Favorite } from './favorites-schema'

const KEY = 'mitiendapy:guest-favorites:v1'
const EMPTY = { items: [] as Favorite[], busy: true, error: '', account: false }
let snapshot = EMPTY
let accountId: string | null = null
let generation = 0
const listeners = new Set<() => void>()
function publish(next: typeof EMPTY) { snapshot = next; listeners.forEach(listener => listener()) }
function readGuest(): Favorite[] {
  try { const parsed = favoriteListSchema.safeParse(JSON.parse(localStorage.getItem(KEY) || '[]')); return parsed.success ? parsed.data : [] } catch { return [] }
}
async function request(method: string, body?: unknown) {
  const response = await fetch('/api/public/favorites', { method, cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Favorites-User': accountId || '' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const data = await response.json()
  if (!response.ok) throw new Error('No se pudieron sincronizar tus favoritos. Reintentá en unos momentos.')
  return data
}
export async function initializeFavorites(userId: string | null) {
  accountId = userId
  const version = ++generation
  const guest = readGuest()
  publish({ items: userId ? [] : guest, busy: !!userId, error: '', account: !!userId })
  if (!userId) return
  try {
    const data = await request('GET')
    const remote = favoriteSchema.array().parse(data.items)
    if (version !== generation) return
    if (guest.length) await request('POST', guest)
    if (version !== generation) return
    // Clear only after the authenticated merge succeeds; never persist account data locally.
    if (guest.length) localStorage.removeItem(KEY)
    publish({ items: mergeFavorites(remote, guest), busy: false, error: '', account: true })
  } catch {
    if (version === generation) publish({ items: [], busy: false, error: 'No se pudieron cargar los favoritos de tu cuenta. Los favoritos del navegador siguen guardados.', account: true })
  }
}
export async function toggleFavorite(raw: Favorite) {
  if (snapshot.busy || snapshot.error) return
  const parsed = favoriteSchema.safeParse(raw)
  if (!parsed.success) throw new Error('Este producto no se puede guardar como favorito.')
  const item = parsed.data
  const version = generation
  const previous = snapshot
  const exists = previous.items.some(row => favoriteKey(row) === favoriteKey(item))
  const items = exists ? previous.items.filter(row => favoriteKey(row) !== favoriteKey(item)) : mergeFavorites(previous.items, [item])
  if (!exists && items.length > 200) throw new Error('Podés guardar hasta 200 favoritos. Quitá alguno para agregar otro.')
  publish({ ...previous, busy: true })
  try {
    if (accountId) await request(exists ? 'DELETE' : 'POST', exists ? item : [item])
    else localStorage.setItem(KEY, JSON.stringify(items))
    if (version === generation) publish({ ...previous, items, busy: false })
  } catch (error) {
    if (version === generation) publish({ ...previous, busy: false })
    throw error
  }
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const useFavorites = () => useSyncExternalStore(subscribe, () => snapshot, () => EMPTY)
export function refreshGuestFavorites(event: StorageEvent) { if (!accountId && event.key === KEY) publish({ ...snapshot, items: readGuest() }) }
