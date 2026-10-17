import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Customer } from '@/hooks/use-customer-state'
type RepairFixture = { id: string; createdAt: string; dbStatus: string; finalCost?: number; estimatedCost?: number; completedAt?: string; technician?: { name: string } }
const state = vi.hoisted(() => ({ repairs: [] as RepairFixture[], response: { data: null, error: { message: 'offline' } } }))
const tenant = vi.hoisted(() => ({ scope: 'org', currentScope: { current: 'org' }, organizationId: 'org' }))
vi.mock('@/hooks/use-tenant-scope', () => ({ useTenantScope: () => tenant }))
vi.mock('@/contexts/RepairsContext', () => ({ useRepairs: () => ({ repairs: state.repairs }) }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useOptionalActiveOrganization: () => ({ organization: { id: 'org' } }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: () => { const q: Record<string, unknown> = { then: (resolve: (value: typeof state.response) => unknown) => Promise.resolve(state.response).then(resolve) }; for (const method of ['select', 'eq', 'gte', 'lte', 'order', 'range', 'abortSignal']) q[method] = () => q; return q } }) }))
import { useRepairAnalytics } from '@/hooks/use-repair-analytics'
import { useCustomerMetrics } from '@/hooks/use-customer-metrics'
describe('dashboard financial honesty', () => {
 it('uses one period and delivered revenue, preserving free repairs', () => {
  const createdAt = new Date().toISOString()
  state.repairs = [{ id: 'free', createdAt, dbStatus: 'entregado', finalCost: 0, estimatedCost: 500 }, { id: 'cancel', createdAt, dbStatus: 'cancelado', estimatedCost: 800 }, { id: 'paid', createdAt, dbStatus: 'entregado', finalCost: 100 }, { id: 'old', createdAt: '2020-01-01', dbStatus: 'entregado', finalCost: 900 }]
  const { result } = renderHook(() => useRepairAnalytics('6months'))
  expect(result.current.metrics.totalRepairs).toBe(3)
  expect(result.current.metrics.totalRevenue).toBe(100)
  expect(result.current.monthlyData.reduce((sum, m) => sum + m.revenue, 0)).toBe(100)
  expect(result.current.dailyTrend.reduce((sum, m) => sum + m.revenue, 0)).toBe(100)
 })
 it('honors a confirmed zero debt and never fabricates monthly revenue on query failure', async () => {
  const { result } = renderHook(() => useCustomerMetrics([{ id: 'c', current_balance: 500, lifetime_value: 1200 } as Customer], { creditSummaries: { c: { total_pending: 0 } } }))
  expect(result.current.totalDebt).toBe(0)
  await waitFor(() => expect(result.current.monthlyError).toBeTruthy())
  expect(result.current.monthlyData).toEqual([])
 })
})

import { deliveredRepairRevenue, deliveryPromiseOutcome } from '@/lib/repairs/analytics-values'
it('delivery timeliness uses an actual recorded promise and excludes missing or invalid dates', () => {
 expect(deliveryPromiseOutcome({ dbStatus: 'entregado', completedAt: '2026-10-10', estimatedCompletion: '2026-10-09' })).toBe(false)
 expect(deliveryPromiseOutcome({ dbStatus: 'entregado', completedAt: '2026-10-10', estimatedCompletion: '2026-10-11' })).toBe(true)
 expect(deliveryPromiseOutcome({ dbStatus: 'entregado', completedAt: '2026-10-10' })).toBeNull()
 expect(deliveryPromiseOutcome({ dbStatus: 'entregado', completedAt: 'invalid', estimatedCompletion: '2026-10-11' })).toBeNull()
 expect(deliveredRepairRevenue({ dbStatus: 'cancelado', estimatedCost: 900 })).toBe(0)
 expect(deliveredRepairRevenue({ dbStatus: 'entregado', finalCost: 0, estimatedCost: 900 })).toBe(0)
})

it('segment revenues sum their own customer values instead of allocating by headcount', () => {
 const { result } = renderHook(() => useCustomerMetrics([{ id: 'vip', segment: 'vip', lifetime_value: 900 }, { id: 'regular', segment: 'regular', lifetime_value: 100 }] as Customer[]))
 expect(result.current.segmentDistribution.find(s => s.name === 'vip')?.revenue).toBe(900)
})

it('uses only completed repairs with valid dates for technician and monthly duration averages', () => {
 const createdAt = new Date(Date.now() - 3 * 86400000).toISOString()
 const completedAt = new Date(Date.now() - 86400000).toISOString()
 state.repairs = [{ id: 'dated', dbStatus: 'entregado', createdAt, completedAt, technician: { name: 'Ana' } }, { id: 'undated', dbStatus: 'entregado', createdAt, technician: { name: 'Ana' } }]
 const { result } = renderHook(() => useRepairAnalytics('6months'))
 expect(result.current.metrics.avgRepairTime).toBe(2)
 expect(result.current.technicianAnalysis[0].avgTime).toBe(2)
 expect(result.current.monthlyData.find(m => m.completedRepairs > 0)?.avgRepairTime).toBe(2)
})
