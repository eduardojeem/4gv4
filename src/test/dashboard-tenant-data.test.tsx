import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RepairsProvider, useRepairs } from '@/contexts/RepairsContext'
import { QuotesList } from '@/components/dashboard/quotes/QuotesList'
import { usePromotions } from '@/hooks/use-promotions'

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/repairs' }))
vi.mock('@/contexts/branch-context', () => ({ useBranch: () => ({ selectedBranchId: null }) }))

const tenant = vi.hoisted(() => ({ scope: 'u:a', currentScope: { current: 'u:a' } }))
vi.mock('@/hooks/use-tenant-scope', () => ({ useTenantScope: () => tenant }))
const promo = (id: string) => ({ id, name: id, code: id, type: 'percentage', value: 10, is_active: true, usage_count: 0 })
const response = (promotions: unknown[], total: number) => ({ ok: true, json: async () => ({ promotions, pagination: { total } }) })
afterEach(() => { vi.unstubAllGlobals(); tenant.scope = 'u:a'; tenant.currentScope.current = 'u:a' })

describe('complete promotion data belongs to the active tenant', () => {
  it('loads beyond the first page before publishing totals', async () => {
    const first = Array.from({ length: 100 }, (_, i) => promo(String(i)))
    const fetch = vi.fn().mockResolvedValueOnce(response(first, 101)).mockResolvedValueOnce(response([promo('last')], 101))
    vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() => usePromotions())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.stats.total).toBe(101)
    expect(fetch.mock.calls[1][0]).toContain('page=2')
  })

  it('rejects a late old-tenant response after a switch', async () => {
    let resolveOld!: (value: unknown) => void
    const old = new Promise(resolve => { resolveOld = resolve })
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(old).mockResolvedValue(response([promo('new')], 1)))
    const { result, rerender } = renderHook(() => usePromotions())
    act(() => { tenant.scope = 'u:b'; tenant.currentScope.current = 'u:b'; rerender() })
    await waitFor(() => expect(result.current.promotions[0]?.id).toBe('new'))
    await act(async () => { resolveOld(response([promo('old')], 1)); await old })
    expect(result.current.promotions.map(p => p.id)).toEqual(['new'])
  })

  it('exposes failure instead of publishing partial totals', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response([promo('first')], 2)).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'offline' }) }))
    const { result } = renderHook(() => usePromotions())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()
    expect(result.current.allPromotions).toEqual([])
  })
})


describe('quotes full coverage failures', () => {
  it('shows an actionable error and hides indicators when a later page fails', async () => {
    const quote = { id: 'q1', number: 1, customer_name: 'Cliente', customer_phone: null, status: 'draft', total: 50, currency: 'PYG', valid_until: null, created_at: new Date().toISOString(), converted_at: null }
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ available: true, quotes: [quote], pagination: { total: 2 } }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Falló la segunda página' }) })
    vi.stubGlobal('fetch', fetch)
    render(<QuotesList />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Falló la segunda página'))
    expect(screen.queryByText('En negociación')).toBeNull()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(fetch.mock.calls[1][0]).toBe('/api/quotes?page=2')
  })
})


describe('repairs complete coverage', () => {
  it('continues beyond twenty pages using the server total', async () => {
    const fetch = vi.fn(async (url: string) => {
      const page = Number(new URL(url, 'https://test').searchParams.get('page'))
      return { ok: true, json: async () => ({ repairs: [{ id: `r${page}`, status: 'recibido', device_brand: 'A', device_model: 'B', created_at: new Date().toISOString() }], pagination: { total: 21 } }) }
    })
    vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() => useRepairs(), { wrapper: RepairsProvider })
    await waitFor(() => expect(result.current.repairs).toHaveLength(21))
    expect(fetch).toHaveBeenCalledTimes(21)
    expect(result.current.error).toBeNull()
  })

  it('does not publish a successful partial list after a later page fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ repairs: [{ id: 'r1' }], pagination: { total: 2 } }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'offline' }) }))
    const { result } = renderHook(() => useRepairs(), { wrapper: RepairsProvider })
    await waitFor(() => expect(result.current.error?.message).toBe('offline'))
    expect(result.current.repairs).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })
})
