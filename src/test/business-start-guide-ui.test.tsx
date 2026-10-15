// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ id: 'org', role: 'owner', branch: null as string | null }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useOptionalActiveOrganization: () => ({ organization: { id: state.id, role: state.role }, isLoading: false }) }))
vi.mock('@/contexts/branch-context', () => ({ useBranch: () => ({ selectedBranchId: state.branch }) }))
import { useBusinessStartGuide } from '@/hooks/use-business-start-guide'
import { BusinessStartGuide } from '@/components/dashboard/onboarding/BusinessStartGuide'
const payload = (id = 'org', postponed = false) => ({ organizationId: id, branchId: null, preferences: { version: 1, teamMode: null, postponed }, limitations: [], guide: { tasks: [{ id: 'catalog', label: 'Prepará tu primer producto', description: 'Producto válido', href: '/dashboard/products', required: true, state: 'pending' }], completed: 2, total: 3, nextTaskId: 'catalog', operationMilestones: { sale: false, collection: null } } })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); state.id = 'org'; state.role = 'owner'; state.branch = null })
describe('business start guide UI', () => {
  it('reloads persisted evidence after onboarding configuration changes', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => payload() })
    vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() => useBusinessStartGuide())
    await waitFor(() => expect(result.current.data).not.toBeNull())
    await act(async () => { window.dispatchEvent(new Event('business-start-guide:changed')) })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('shows the next task and real readiness instead of claiming a first sale', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload() }))
    render(<BusinessStartGuide />)
    expect(await screen.findByRole('link', { name: 'Siguiente paso: Prepará tu primer producto' })).toBeTruthy()
    expect(screen.getByText(/2 de 3/)).toBeTruthy()
    expect(screen.queryByText('Primera venta completada')).toBeNull()
  })
  it('does not show administrative actions to a seller', () => {
    state.role = 'seller'; const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    render(<BusinessStartGuide />)
    expect(screen.queryByText('Preparar mi negocio')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('lets a postponed guide be reopened', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload('org', true) }))
    render(<BusinessStartGuide />)
    expect(await screen.findByRole('button', { name: 'Continuar preparación' })).toBeTruthy()
  })
  it('shows errors instead of completing unavailable evidence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'No se pudo comprobar' }) }))
    render(<BusinessStartGuide />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText(/2 de 3/)).toBeNull()
  })
  it('masks a previous organization and ignores its late response', async () => {
    let resolve!: (value: unknown) => void
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done })).mockResolvedValue({ ok: true, json: async () => payload('other') }))
    const { result, rerender } = renderHook(() => useBusinessStartGuide())
    state.id = 'other'; rerender()
    await waitFor(() => expect(result.current.data?.organizationId).toBe('other'))
    await act(async () => resolve({ ok: true, json: async () => payload() }))
    expect(result.current.data?.organizationId).toBe('other')
  })
  it('preference changes send only the guide fields with organization scope', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => payload() }); vi.stubGlobal('fetch', fetch)
    const { result } = renderHook(() => useBusinessStartGuide())
    await waitFor(() => expect(result.current.data).not.toBeNull())
    await act(async () => { await result.current.savePreferences({ version: 1, teamMode: 'solo', postponed: true }) })
    const write = fetch.mock.calls.find(call => call[1]?.method === 'PATCH')!
    expect(JSON.parse(write[1].body)).toEqual({ version: 1, teamMode: 'solo', postponed: true })
    expect(new Headers(write[1].headers).get('x-organization-id')).toBe('org')
  })
})
