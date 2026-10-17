import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCatalogCollection, useCatalogSync } from './use-catalog-sync'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth } from '@/contexts/auth-context'
import { useTenantScope } from '@/hooks/use-tenant-scope'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: () => {
  const query = {
    select: () => query, eq: () => query, order: () => query, range: () => query, abortSignal: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], count: 0, error: null }).then(resolve),
  }
  return query
} }) }))

vi.mock('@/contexts/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('@/hooks/use-tenant-scope', () => ({ useTenantScope: vi.fn() }))
afterEach(() => vi.unstubAllGlobals())

describe('catalog API source', () => {
  it('collects all brand pages instead of exporting a truncated catalog', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [{ id: 'a', name: 'A' }], count: 2 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [{ id: 'b', name: 'B' }], count: 2 }) })
    vi.stubGlobal('fetch', fetch)
    expect((await fetchCatalogCollection('brands')).map(row => row.id)).toEqual(['a', 'b'])
    expect(fetch.mock.calls[1][0]).toContain('page=2')
  })
  it('uses zero-based supplier pagination', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [], count: 0 }) })
    vi.stubGlobal('fetch', fetch)
    await fetchCatalogCollection('suppliers')
    expect(fetch.mock.calls[0][0]).toContain('page=0')
  })
  it('rejects missing later pages instead of claiming complete export', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [{ id: 'a', name: 'A' }], count: 2 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [], count: 2 }) }))
    await expect(fetchCatalogCollection('brands')).rejects.toThrow('incompleto')
  })
  it('propagates authorization failures without demo fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ success: false, error: 'Sin permiso' }) }))
    await expect(fetchCatalogCollection('brands')).rejects.toThrow('Sin permiso')
  })
})


it('hides the prior tenant snapshot immediately on an organization switch', async () => {
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'user' }, loading: false } as ReturnType<typeof useAuth>)
  const currentScope = { current: 'user:one' }
  let tenant = { scope: 'user:one', currentScope, organizationId: 'one', userId: 'user' }
  vi.mocked(useTenantScope).mockImplementation(() => tenant)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [{ id: 'old', name: 'Old tenant record' }], count: 1 }) }))
  const { result, rerender } = renderHook(() => useCatalogSync())
  await waitFor(() => expect(result.current.ready).toBe(true))
  expect(result.current.brands[0].id).toBe('old')
  currentScope.current = 'user:two'
  tenant = { ...tenant, scope: 'user:two', organizationId: 'two' }
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
  rerender()
  expect(result.current.ready).toBe(false)
  expect(result.current.brands).toEqual([])
  expect(() => result.current.exportData()).toThrow('todavía')
})
