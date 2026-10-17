import { describe, expect, it, vi } from 'vitest'
import { fetchCatalogCategories } from '@/hooks/use-catalog-sync'

const db = vi.hoisted(() => ({ pages: [] as Array<{ data: Array<{id: string; name: string; is_active: boolean}> | null; count: number | null; error: unknown }>, scopes: [] as unknown[][], ranges: [] as unknown[][] }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: () => {
  const q = {
    select: () => q,
    eq: (...args: unknown[]) => { db.scopes.push(args); return q },
    order: () => q,
    range: (...args: unknown[]) => { db.ranges.push(args); return q },
    abortSignal: () => q,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(db.pages.shift()).then(resolve),
  }
  return q
} }) }))

describe('catalog category coverage', () => {
  it('reads beyond the PostgREST default cap with explicit tenant and exact coverage', async () => {
    db.scopes = []; db.ranges = []
    db.pages = Array.from({ length: 11 }, (_, page) => ({
      data: Array.from({ length: page === 10 ? 1 : 100 }, (_, i) => ({ id: `${page * 100 + i}`, name: 'Categoría', is_active: true })), count: 1001, error: null,
    }))
    const categories = await fetchCatalogCategories('org-active')
    expect(categories).toHaveLength(1001)
    expect(db.ranges).toHaveLength(11)
    expect(db.ranges.at(-1)).toEqual([1000, 1099])
    expect(db.scopes.every(args => args[0] === 'organization_id' && args[1] === 'org-active')).toBe(true)
  })
  it('rejects a truncated later page instead of returning a partial catalog', async () => {
    db.pages = [
      { data: [{ id: 'one', name: 'Una', is_active: true }], count: 2, error: null },
      { data: [], count: 2, error: null },
    ]
    await expect(fetchCatalogCategories('org-active')).rejects.toThrow('Catálogo incompleto')
  })
  it('does not treat absent server count as complete', async () => {
    db.pages = [{ data: [], count: null, error: null }]
    await expect(fetchCatalogCategories('org-active')).rejects.toThrow('cobertura')
  })
})
