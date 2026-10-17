import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
type Sale = { id: string; total_amount: number; created_at: string; status: string }
const control = vi.hoisted(() => ({ rows: [] as Sale[], failPage: false, calls: [] as Array<{ offset: number; signal?: AbortSignal }>, tenant: { scope: 'org', organizationId: 'org', currentScope: { current: 'org' } } }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useOptionalActiveOrganization: () => ({ organization: { id: control.tenant.organizationId } }) }))
vi.mock('@/hooks/use-tenant-scope', () => ({ useTenantScope: () => control.tenant }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: () => {
 let offset = 0; let end = 999; let signal: AbortSignal | undefined
 const query: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => {
  control.calls.push({ offset, signal })
  return Promise.resolve(control.failPage && offset > 0 ? { data: null, error: { message: 'page 2 failed' }, count: null } : { data: control.rows.slice(offset, end + 1), error: null, count: control.rows.length }).then(resolve)
 } }
 for (const method of ['select', 'eq', 'gte', 'lte', 'order']) query[method] = () => query
 query.range = (from: number, to: number) => { offset = from; end = to; return query }
 query.abortSignal = (value: AbortSignal) => { signal = value; return query }
 return query
} }) }))
import { useCustomerMetrics } from '@/hooks/use-customer-metrics'
beforeEach(() => { control.rows = Array.from({ length: 1250 }, (_, i) => ({ id: String(i), total_amount: 10, created_at: new Date().toISOString(), status: 'completed' })); control.failPage = false; control.calls = []; control.tenant.scope = 'org'; control.tenant.organizationId = 'org'; control.tenant.currentScope.current = 'org' })
describe('complete customer monthly sales', () => {
 it('includes sales beyond the PostgREST 1000-row boundary', async () => {
  const { result } = renderHook(() => useCustomerMetrics([]))
  await waitFor(() => expect(result.current.monthlyLoading).toBe(false))
  expect(result.current.monthlyData.reduce((sum, m) => sum + m.totalRevenue, 0)).toBe(12500)
  expect(control.calls.length).toBeGreaterThan(1)
 })
 it('does not publish the first page as a complete month when a later page fails', async () => {
  control.failPage = true
  const { result } = renderHook(() => useCustomerMetrics([]))
  await waitFor(() => expect(result.current.monthlyLoading).toBe(false))
  expect(result.current.monthlyError).toBeTruthy()
  expect(result.current.monthlyData).toEqual([])
 })
 it('aborts its request on unmount', async () => {
  const { unmount } = renderHook(() => useCustomerMetrics([]))
  await waitFor(() => expect(control.calls.length).toBeGreaterThan(0))
  await act(async () => unmount())
  expect(control.calls[0].signal?.aborted).toBe(true)
 })
})
