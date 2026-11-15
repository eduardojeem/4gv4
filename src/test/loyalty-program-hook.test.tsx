import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLoyalty, DEFAULT_LOYALTY_SETTINGS } from '@/hooks/use-loyalty'
vi.mock('@/hooks/use-tenant-scope', () => ({
  useTenantScope: () => ({ organizationId: 'org-one' }),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
afterEach(() => vi.unstubAllGlobals())
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
describe('carga y guardado de fidelización', () => {
  it('un error de permisos no se presenta como programa vacío o desactivado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'No tenés permiso' }, 403))
    )
    const { result } = renderHook(() => useLoyalty())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.loadError).toBe('No tenés permiso')
    expect(result.current.moduleInstalled).toBe(true)
  })
  it('incluye la organización activa y no inventa soporte de turnos', async () => {
    const fetcher = vi.fn(async (url: string) =>
      json(
        url.endsWith('/settings')
          ? { settings: { ...DEFAULT_LOYALTY_SETTINGS, organization_id: 'org-one' } }
          : url.endsWith('/rules')
            ? { rules: [] }
            : { raffles: [] }
      )
    )
    vi.stubGlobal('fetch', fetcher)
    const { result } = renderHook(() => useLoyalty())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.serviceVisitsReady).toBe(false)
    expect(fetcher).toHaveBeenCalledWith(
      '/api/loyalty/settings',
      expect.objectContaining({ headers: { 'x-organization-id': 'org-one' } })
    )
  })
  it('un fallo de red al guardar devuelve error y conserva la configuración', async () => {
    const fetcher = vi.fn(async (url: string) =>
      json(
        url.endsWith('/settings')
          ? {
              settings: { ...DEFAULT_LOYALTY_SETTINGS, organization_id: 'org-one' },
              capabilities: { serviceVisits: true },
            }
          : url.endsWith('/rules')
            ? { rules: [] }
            : { raffles: [] }
      )
    )
    vi.stubGlobal('fetch', fetcher)
    const { result } = renderHook(() => useLoyalty())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const previous = result.current.settings
    fetcher.mockRejectedValueOnce(new Error('Network error'))
    let saved = true
    await act(async () => {
      saved = await result.current.saveSettings({ ...DEFAULT_LOYALTY_SETTINGS, enabled: true })
    })
    expect(saved).toBe(false)
    expect(result.current.settings).toBe(previous)
  })
})
