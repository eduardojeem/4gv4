import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { initializeFavorites, toggleFavorite, useFavorites } from '@/lib/public/favorites-store'
const item = { productId: '00000000-0000-4000-8000-000000000001', slug: 'tienda', name: 'Remera', store: 'Tienda' }
const key = 'mitiendapy:guest-favorites:v1'
describe('persistencia de favoritos', () => {
  beforeEach(async () => {
    vi.unstubAllGlobals()
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
    await initializeFavorites(null)
  })
  it('guarda y quita sin sesión, sin tocar el servidor', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    await toggleFavorite(item)
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([item])
    await toggleFavorite(item)
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('combina con la cuenta y no deja los favoritos privados visibles al salir', async () => {
    await toggleFavorite(item)
    const remote = { ...item, productId: '00000000-0000-4000-8000-000000000002' }
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ items: [remote] }) }).mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetchMock)
    await initializeFavorites('user-a')
    expect(renderHook(() => useFavorites()).result.current.items).toHaveLength(2)
    expect(localStorage.getItem(key)).toBeNull()
    await initializeFavorites(null)
    expect(renderHook(() => useFavorites()).result.current.items).toEqual([])
  })
  it('no elimina favoritos locales cuando falla la sincronización', async () => {
    await toggleFavorite(item)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await initializeFavorites('user-a')
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([item])
    expect(renderHook(() => useFavorites()).result.current.error).not.toBe('')
  })
  it('ignora respuestas de una cuenta anterior después de cerrar sesión', async () => {
    let complete!: (response: unknown) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { complete = resolve })))
    const pending = initializeFavorites('user-a')
    await initializeFavorites(null)
    complete({ ok: true, json: async () => ({ items: [item] }) })
    await pending
    expect(renderHook(() => useFavorites()).result.current.items).toEqual([])
    expect(renderHook(() => useFavorites()).result.current.account).toBe(false)
  })
  it('impide guardar más de 30 productos favoritos arrojando un error descriptivo', async () => {
    for (let i = 1; i <= 30; i++) {
      await toggleFavorite({ ...item, productId: `prod-${i}` })
    }
    expect(renderHook(() => useFavorites()).result.current.items).toHaveLength(30)
    await expect(toggleFavorite({ ...item, productId: 'prod-31' })).rejects.toThrow(/30 productos como favoritos/)
    expect(renderHook(() => useFavorites()).result.current.items).toHaveLength(30)
  })
})

