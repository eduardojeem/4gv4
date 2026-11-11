import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RepairsProvider, useRepairs } from './RepairsContext'
import type { ReactNode } from 'react'
const state = vi.hoisted(() => ({ pathname: '/admin', modules: ['repairs'], scope: 'org-1', currentScope: { current: 'org-1' } }))
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }))
vi.mock('@/contexts/SubscriptionStatusContext', () => ({ useSubscriptionStatus: () => ({ effectiveModules: state.modules }) }))
vi.mock('@/hooks/use-tenant-scope', () => ({ useTenantScope: () => ({ scope: state.scope, currentScope: state.currentScope }) }))
vi.mock('@/contexts/branch-context', () => ({ useBranch: () => ({ selectedBranchId: 'branch-1' }) }))
vi.mock('@/utils/repair-mapping', () => ({ mapSupabaseRepairToUi: (value: unknown) => value }))
const wrapper = ({ children }: { children: ReactNode }) => <RepairsProvider loadOnOverview>{children}</RepairsProvider>
describe('repairs on the admin overview', () => {
  beforeEach(() => {
    state.pathname = '/admin'; state.modules = ['repairs']
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ repairs: [{ id: 'r1', status: 'recibido' }], pagination: { total: 1 } }) }))
  })
  afterEach(() => vi.unstubAllGlobals())
  it('loads the current branch repairs when opening /admin directly', async () => {
    const { result } = renderHook(() => useRepairs(), { wrapper })
    await waitFor(() => expect(result.current.repairs).toHaveLength(1))
    expect(fetch).toHaveBeenCalledWith('/api/repairs?page=1&pageSize=100', expect.objectContaining({ headers: { 'x-branch-id': 'branch-1' } }))
  })
  it('does not query repairs for a business without that module', async () => {
    state.modules = []
    const { result } = renderHook(() => useRepairs(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetch).not.toHaveBeenCalled()
  })
})