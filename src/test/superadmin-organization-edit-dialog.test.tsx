import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditOrganizationDialog } from '@/components/superadmin/organizations/EditOrganizationDialog'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
afterEach(() => vi.unstubAllGlobals())
const organization = { id: 'demo-org', name: 'Empresa Demo', slug: 'empresa-demo', plan: 'PRO', subscription_status: 'active', enabled_modules: null }
describe('revisión de cambios de organización', () => {
  it('no propone guardar al abrir una empresa con funciones heredadas', () => {
    render(<EditOrganizationDialog organization={organization} open onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Revisar cambios' })).toBeDisabled()
    expect(screen.getByText('Conservar las funciones del plan')).toBeInTheDocument()
  })
  it('guarda solo el nombre y conserva las funciones y configuración existentes', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', fetcher)
    const user = userEvent.setup()
    render(<EditOrganizationDialog organization={organization} open onClose={() => {}} />)
    const name = screen.getByLabelText(/Nombre de la Empresa/)
    await user.clear(name); await user.type(name, 'Empresa Nueva')
    await user.click(screen.getByRole('button', { name: 'Revisar cambios' }))
    expect(screen.getByText('Empresa Nueva')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ name: 'Empresa Nueva' })
  })
  it('un error de guardado conserva el nombre editado y permite reintentar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'No se pudo guardar' }) }))
    const user = userEvent.setup()
    render(<EditOrganizationDialog organization={organization} open onClose={() => {}} />)
    const name = screen.getByLabelText(/Nombre de la Empresa/)
    await user.clear(name); await user.type(name, 'Nuevo intento')
    await user.click(screen.getByRole('button', { name: 'Revisar cambios' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))
    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nombre de la Empresa/)).toHaveValue('Nuevo intento')
    expect(screen.getByRole('button', { name: 'Revisar cambios' })).toBeEnabled()
  })
})
