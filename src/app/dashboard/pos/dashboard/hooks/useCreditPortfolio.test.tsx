import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
const ctx = vi.hoisted(() => ({ org: 'org-a', branch: 'branch-a', current: { current: 'user:org-a' } }))
vi.mock('@/hooks/use-tenant-scope', () => ({ useTenantScope: () => ({ scope: `user:${ctx.org}`, currentScope: ctx.current, organizationId: ctx.org }) }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useActiveOrganization: () => ({ organization: { id: ctx.org }, isLoading: false }) }))
vi.mock('@/contexts/branch-context', () => ({ useBranch: () => ({ selectedBranchId: ctx.branch }) }))
import { useCreditPortfolio } from './useCreditPortfolio'
const range = { from: new Date(2026, 10, 17), to: new Date(2026, 10, 17) }
const response = (marker: string) => ({ ok: true, json: async () => ({ success: true, data: { marker } }) })
beforeEach(() => { ctx.org='org-a'; ctx.branch='branch-a'; ctx.current.current='user:org-a'; vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('a'))) })
it('envía la sucursal y vuelve a cargar al cambiar empresa', async () => {
 const { result, rerender } = renderHook(() => useCreditPortfolio(range, true))
 await waitFor(() => expect(result.current.state.status).toBe('ready'))
 expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ 'x-branch-id': 'branch-a' })
 ctx.org='org-b'; ctx.current.current='user:org-b'; rerender()
 await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
 ctx.branch='branch-b'; rerender()
 await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
})
it('descarta una recarga manual tardía de otra sucursal', async () => {
 const { result, rerender } = renderHook(() => useCreditPortfolio(range, true))
 await waitFor(() => expect(result.current.state.status).toBe('ready'))
 let finish!: (value: ReturnType<typeof response>) => void
 vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish=resolve as typeof finish }))
 let refresh!: Promise<unknown>
 act(() => { refresh=result.current.refetch() })
 ctx.branch='branch-b'; vi.mocked(fetch).mockResolvedValue(response('b') as Response); rerender()
 await waitFor(() => expect(result.current.state).toMatchObject({ report: { marker: 'b' } }))
 await act(async () => { finish(response('old')); await refresh })
 expect(result.current.state).toMatchObject({ report: { marker: 'b' } })
})
