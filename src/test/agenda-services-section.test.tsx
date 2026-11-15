vi.mock('@/hooks/use-tenant-scope', () => ({ useTenantScope: () => ({ scope: 'test:org' }) }))
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('@/contexts/SubscriptionStatusContext', () => ({
  useSubscriptionStatus: () => ({ businessVertical: 'barbershop', serviceSpecialties: [] }),
}))
vi.mock('@/components/dashboard/agenda/ProfessionalsManager', () => ({ ProfessionalsManager: () => null }))
vi.mock('@/components/dashboard/agenda/TimeOffEditor', () => ({ TimeOffEditor: () => null }))
vi.mock('@/components/dashboard/agenda/SuggestedServicesCard', () => ({ SuggestedServicesCard: () => null }))
vi.mock('@/components/dashboard/agenda/NewServiceDialog', () => ({ NewServiceDialog: () => null }))

import { AgendaSettingsPanel } from '@/components/dashboard/agenda/AgendaSettingsPanel'

const sampleConfig = {
  available: true,
  settingsRevision: 12,
  capabilities: { professionalBooking: true },
  settings: {
    slot_minutes: 30,
    opening_hours: { 1: [['09:00', '18:00']] },
    online_booking: true,
    require_confirmation: false,
    min_notice_minutes: 60,
    max_days_ahead: 30,
    booking_message: null,
    notify_email: true,
    professional_selection: 'optional',
  },
  services: [
    {
      product_id: 'srv-1',
      name: 'Corte Clásico',
      price: 50000,
      hide_price: false,
      duration_minutes: 40,
      buffer_minutes: 10,
      online: true,
      configured: true,
      catalog_visible: true,
      image_url: 'https://example.com/corte.webp',
      images: ['https://example.com/corte.webp'],
    },
    {
      product_id: 'srv-2',
      name: 'Diagnóstico Capilar',
      price: 0,
      hide_price: false,
      duration_minutes: 20,
      buffer_minutes: 0,
      online: false,
      configured: true,
      catalog_visible: false,
      image_url: null,
      images: [],
    },
  ],
  professionals: [{ id: 'pro-1', name: 'Juan', color: '#000000', phone: null, is_active: true, sort_order: 0 }],
  professionalCount: 1,
  currency: 'PYG',
  timeZone: 'America/Asuncion',
  bookingUrl: 'https://example.com/juanbarber/turnos',
  bookingContext: { storefrontPublic: true, notificationEmail: 'juan@barber.test' },
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.location.hash = ''
})

describe('AgendaSettingsPanel #servicios', () => {
  it('muestra resumen, miniaturas de portada, estados, filtros rápidos y búsqueda', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => sampleConfig }))
    window.location.hash = '#servicios'
    render(<AgendaSettingsPanel />)

    expect(await screen.findByLabelText('Resumen de servicios')).toHaveTextContent('2 servicios')
    expect(screen.getByLabelText('Resumen de servicios')).toHaveTextContent('1 sin foto')
    expect(screen.getAllByAltText('Portada de Corte Clásico').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('50 min totales (40+10)')).toBeInTheDocument()
    expect(screen.getByText('Gratuito')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Permitir reservar online: Diagnóstico Capilar' })).toBeDisabled()

    // Filtra por "Sin portada"
    fireEvent.click(screen.getByRole('button', { name: /Sin portada/ }))
    expect(screen.queryByRole('heading', { name: 'Corte Clásico' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Diagnóstico Capilar' })).toBeInTheDocument()

    // Búsqueda sin coincidencias y reseteo rápido
    fireEvent.change(screen.getByLabelText('Buscar servicio'), { target: { value: 'Inexistente' } })
    expect(screen.getByRole('status')).toHaveTextContent('No hay servicios que coincidan')
    fireEvent.click(screen.getByRole('button', { name: /Ver todos/ }))
    expect(screen.getByRole('heading', { name: 'Corte Clásico' })).toBeInTheDocument()
  })

  it('permite editar duración y preparación marcando cambios sin guardar y enviando el payload correcto', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => sampleConfig })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => sampleConfig })
    vi.stubGlobal('fetch', fetchMock)
    window.location.hash = '#servicios'
    render(<AgendaSettingsPanel />)

    const durationInput = await screen.findByLabelText('Duración de Corte Clásico')
    fireEvent.change(durationInput, { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText('Margen de Corte Clásico'), { target: { value: '15' } })

    expect(screen.getByRole('region', { name: 'Cambios sin guardar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const putPayload = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)
    expect(putPayload.services).toEqual([
      { product_id: 'srv-1', duration_minutes: 45, online: true, buffer_minutes: 15 },
      { product_id: 'srv-2', duration_minutes: 20, online: false, buffer_minutes: 0 },
    ])
  })
})
