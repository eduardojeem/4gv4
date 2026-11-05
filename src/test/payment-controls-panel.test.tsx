import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaymentControlsPanel } from '@/components/payments/PaymentControlsPanel'
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: { id: 'user', organization: { id: 'org' } } }) }))
const method = { id: 'cash', title: 'Efectivo', description: 'Caja y permisos existentes.', channels: ['POS'], enabled: true, configured: true, available: true, editable: true }
const snapshot = { scope: 'commerce', organizationId: 'org', canEdit: true, revision: 'r1', methods: [method] }
afterEach(() => vi.unstubAllGlobals())
const panel = () => render(<PaymentControlsPanel scope="commerce" endpoint="/api/admin/payment-controls" title="Medios de cobro" description="Tu comercio" />)
describe('payment controls panel', () => {
  it('allows disabling an enabled method even when its credentials are missing', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ...snapshot, methods: [{ ...method, configured: false, available: false }] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ ...snapshot, methods: [{ ...method, configured: false, available: false, enabled: false }] }) })
    vi.stubGlobal('fetch', fetch)
    panel()
    const toggle = await screen.findByRole('switch')
    expect(toggle).toBeEnabled()
    fireEvent.click(toggle)
    await screen.findByText('Efectivo: deshabilitado para operaciones nuevas.')
    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByRole('switch')).toBeDisabled()
  })
  it('separates implemented methods from pending integrations and shows payment evidence and requirements', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...snapshot, methods: [
      { ...method, history: { confirmed: true, detail: 'Cobros registrados en POS.' } },
      { ...method, id: 'stripe', title: 'Stripe', configured: false, available: false, enabled: false, nextSteps: ['Configurar las claves y el webhook.'], history: { confirmed: false, detail: 'Solo pagos confirmados.' } },
      { ...method, id: 'apple', title: 'Apple IAP', editable: false, configured: false, available: false, implementation: 'pending', nextSteps: ['Desarrollar la integración.'] },
    ] }) }))
    panel()
    expect(await screen.findByRole('region', { name: 'Medios implementados' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Integraciones por desarrollar' })).toBeInTheDocument()
    expect(screen.getByText('Con cobros registrados')).toBeInTheDocument()
    expect(screen.getByText('Sin cobros en los registros consultados')).toBeInTheDocument()
    expect(screen.getByText('Configurar las claves y el webhook.')).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Habilitar Apple IAP' })).not.toBeInTheDocument()
  })
  it('sends a versioned org-scoped change and reflects only the confirmed state', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => snapshot }).mockResolvedValueOnce({ ok: true, json: async () => ({ ...snapshot, revision: 'r2', methods: [{ ...method, enabled: false, available: false }] }) })
    vi.stubGlobal('fetch', fetch)
    panel()
    fireEvent.click(await screen.findByRole('switch', { name: 'Habilitar Efectivo' }))
    await screen.findByText('Efectivo: deshabilitado para operaciones nuevas.')
    expect(fetch.mock.calls[1][1].headers['X-Organization-ID']).toBe('org')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ id: 'cash', enabled: false, revision: 'r1' })
    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByText('No hay medios disponibles para iniciar cobros nuevos.')).toBeInTheDocument()
  })
  it('keeps the confirmed value after a conflict instead of pretending the switch saved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => snapshot }).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Otro administrador cambió la configuración.' }) }))
    panel()
    fireEvent.click(await screen.findByRole('switch'))
    await screen.findByRole('alert')
    expect(screen.getByText('No se guardó el cambio: Otro administrador cambió la configuración.')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeChecked()
  })
  it('shows the pending database protection and cannot toggle until ready', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...snapshot, configurationNotice: 'Configuración pendiente.' }) })
    vi.stubGlobal('fetch', fetch)
    panel()
    expect(await screen.findByRole('switch')).toBeDisabled()
    expect(screen.getByText(/Configuración pendiente/)).toBeInTheDocument()
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  })
})
