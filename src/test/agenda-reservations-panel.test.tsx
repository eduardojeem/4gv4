import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/contexts/SubscriptionStatusContext', () => ({ useSubscriptionStatus: () => ({ businessVertical: 'barbershop', serviceSpecialties: [] }) }))
vi.mock('@/components/dashboard/agenda/ProfessionalsManager', () => ({ ProfessionalsManager: () => null }))
vi.mock('@/components/dashboard/agenda/TimeOffEditor', () => ({ TimeOffEditor: () => null }))
vi.mock('@/components/dashboard/agenda/SuggestedServicesCard', () => ({ SuggestedServicesCard: () => null }))
vi.mock('@/components/dashboard/agenda/NewServiceDialog', () => ({ NewServiceDialog: () => null }))
import { AgendaSettingsPanel } from '@/components/dashboard/agenda/AgendaSettingsPanel'
const config = {
  available: true, settingsRevision: 7, capabilities: { professionalBooking: true },
  settings: { slot_minutes: 30, opening_hours: { 1: [['09:00', '18:00']] }, online_booking: false, require_confirmation: false, min_notice_minutes: 60, max_days_ahead: 30, booking_message: null, notify_email: true, professional_selection: 'optional' },
  services: [{ product_id: 'f53119c8-f097-46d7-97d7-71a36b2faf23', name: 'Corte', price: 50000, online: true, duration_minutes: 30 }],
  professionals: [], professionalCount: 0, currency: 'PYG', timeZone: 'America/Asuncion', bookingUrl: 'https://example.com/barber/turnos', bookingContext: { storefrontPublic: true, notificationEmail: null },
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.location.hash = '' })
describe('reservas: borrador y guardado seguro', () => {
  it('no habilita el enlace al activar solamente el borrador, y permite editar días sin forzar 1', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => config }))
    window.location.hash = '#reservas'
    render(<AgendaSettingsPanel />)
    expect(await screen.findByText('Estado de las reservas')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'Aceptar reservas desde la tienda' }))
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeDisabled()
    expect(screen.getByText(/No hay un email de contacto válido/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Mensaje para el cliente/)).toHaveAttribute('maxlength', '500')
    const days = screen.getByLabelText('Hasta cuántos días adelante')
    fireEvent.change(days, { target: { value: '' } })
    expect(days).toHaveValue('')
    expect(days).toHaveAttribute('aria-invalid', 'true')
  })
  it('envía la revisión y conserva el borrador si el servidor detecta un conflicto', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => config }).mockResolvedValueOnce({ ok: false, json: async () => ({ code: 'AGENDA_SETTINGS_CHANGED', error: 'Conflicto' }) })
    vi.stubGlobal('fetch', fetchMock)
    window.location.hash = '#reservas'
    render(<AgendaSettingsPanel />)
    const message = await screen.findByLabelText(/Mensaje para el cliente/)
    fireEvent.change(message, { target: { value: 'Mi borrador' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(screen.getByText(/Otra persona modificó la agenda/)).toBeInTheDocument())
    expect(message).toHaveValue('Mi borrador')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ expected_revision: 7, booking_message: 'Mi borrador' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
