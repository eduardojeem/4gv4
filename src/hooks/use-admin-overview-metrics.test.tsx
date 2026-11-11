import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminOverviewMetrics } from './use-admin-overview-metrics'

const fixture = vi.hoisted(() => ({
  org: 'org-1' as string | null, branch: 'branch-1' as string | null,
  rows: {} as Record<string, Record<string, unknown>[]>, failures: new Set<string>(),
  calls: [] as { table: string; filters: Record<string, unknown>; from: number }[],
  pause: null as Promise<void> | null,
}))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useActiveOrganization: () => ({ organization: fixture.org ? { id: fixture.org } : null }) }))
vi.mock('@/contexts/branch-context', () => ({ useBranch: () => ({ selectedBranchId: fixture.branch }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: (table: string) => {
  const filters: Record<string, unknown> = {}
  let start = 0; let end = Infinity
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters[key] = value; return query },
    is: (key: string, value: unknown) => { filters[key] = value; return query },
    gte: () => query, lt: () => query, order: () => query, in: () => query,
    limit: (n: number) => { end = n - 1; return query },
    range: (from: number, to: number) => { start = from; end = to; return query },
    abortSignal: () => query,
    then: async (resolve: (value: unknown) => unknown) => {
      fixture.calls.push({ table, filters: { ...filters }, from: start })
      const rows = fixture.rows[table] ?? []; const fail = fixture.failures.has(table); const pause = fixture.pause
      if (pause) await pause
      return resolve({ data: fail ? null : rows.slice(start, end + 1), count: rows.length, error: fail ? { message: 'sin conexión' } : null })
    },
  }
  return query
} }) }))

describe('admin overview metrics', () => {
  beforeEach(() => {
    fixture.org = 'org-1'; fixture.branch = 'branch-1'; fixture.failures.clear(); fixture.calls = []; fixture.pause = null
    fixture.rows = {
      sales: [{ id: 's1', total_amount: 45000, status: 'completed' }],
      cash_closures: [{ id: 'cash' }], cash_alerts: [],
      products: [{ id: 'p1', stock_quantity: 50, min_stock: 5 }],
      branch_inventory: [{ product_id: 'p1', stock_quantity: 2, min_stock: 3 }],
      organization_members: [{ user_id: 'u1' }],
    }
  })
  it('uses branch stock and its threshold instead of global product stock', async () => {
    const { result } = renderHook(() => useAdminOverviewMetrics())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.metrics.lowStockCount).toBe(1)
    expect(fixture.calls.find(call => call.table === 'branch_inventory')?.filters.branch_id).toBe('branch-1')
  })
  it('shows unavailable metrics after partial failures without hiding successful sales', async () => {
    fixture.failures.add('products'); fixture.failures.add('cash_alerts')
    const { result } = renderHook(() => useAdminOverviewMetrics())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.metrics.lowStockCount).toBeNull()
    expect(result.current.metrics.cashAlertsCount).toBeNull()
    expect(result.current.metrics.todaySalesTotal).toBe(45000)
    expect(result.current.error).toBeTruthy()
  })
  it('reads all products beyond the first 1000 rows', async () => {
    fixture.branch = null
    fixture.rows.products = Array.from({ length: 1005 }, (_, i) => ({ id: `p${i}`, stock_quantity: i < 1000 ? 20 : 0, min_stock: 5 }))
    const { result } = renderHook(() => useAdminOverviewMetrics())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.metrics.lowStockCount).toBe(5)
  })
  it('paginates sales and excludes cancelled sales', async () => {
    fixture.rows.sales = Array.from({ length: 1005 }, (_, i) => ({ id: `s${i}`, total_amount: 10, status: i === 0 ? 'cancelled' : 'completed' }))
    const { result } = renderHook(() => useAdminOverviewMetrics())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.metrics.todaySalesCount).toBe(1004)
    expect(result.current.metrics.todaySalesTotal).toBe(10040)
  })
  it('waits for an organization instead of sending unscoped requests', async () => {
    fixture.org = null
    const { result } = renderHook(() => useAdminOverviewMetrics())
    await act(async () => {})
    expect(fixture.calls).toHaveLength(0)
    expect(result.current.metrics.todaySalesTotal).toBeNull()
  })
  it('skips disabled modules', async () => {
    const { result } = renderHook(() => useAdminOverviewMetrics({ sales: false, cash: false, inventory: false, team: true }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fixture.calls.map(call => call.table)).toEqual(['organization_members'])
  })
  it('discards a late response after changing organization', async () => {
    let release!: () => void
    fixture.pause = new Promise<void>(resolve => { release = resolve })
    const { result, rerender } = renderHook(() => useAdminOverviewMetrics())
    await waitFor(() => expect(fixture.calls.length).toBeGreaterThan(0))
    fixture.org = 'org-2'; fixture.pause = null; fixture.rows.sales = []
    rerender()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.metrics.todaySalesTotal).toBe(0)
    await act(async () => release())
    expect(result.current.metrics.todaySalesTotal).toBe(0)
  })
  it('retries failed queries and restores a confirmed zero', async () => {
    fixture.failures.add('sales')
    const { result } = renderHook(() => useAdminOverviewMetrics())
    await waitFor(() => expect(result.current.error).toBeTruthy())
    fixture.failures.clear(); fixture.rows.sales = []
    await act(async () => { await result.current.refresh() })
    expect(result.current.error).toBeNull()
    expect(result.current.metrics.todaySalesTotal).toBe(0)
  })
})