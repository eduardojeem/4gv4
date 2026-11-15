import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AntiNoShowReminderCard } from '@/components/dashboard/agenda/AntiNoShowReminderCard'
import { BarberProductivityModal } from '@/components/dashboard/agenda/BarberProductivityModal'
import type { AgendaData, Appointment } from '@/components/dashboard/agenda/types'
import type { AgendaProfessional } from '@/lib/agenda/agenda-server'

const mockProfessionals: AgendaProfessional[] = [
  {
    id: 'p-1',
    name: 'Carlos Barbero',
    color: '#3b82f6',
    specialty: 'Cortes clásicos',
    is_active: true,
    remuneration_type: 'commission',
    commission_rate_services: 60,
    commission_rate_products: 10,
    commission_fixed_deduction: 0,
  },
  {
    id: 'p-2',
    name: 'Lucas Fade',
    color: '#10b981',
    specialty: 'Degradé y barba',
    is_active: true,
    remuneration_type: 'chair_rental',
    commission_rate_services: 0,
    commission_rate_products: 0,
    commission_fixed_deduction: 350000,
  },
]

const mockAppointments: Appointment[] = [
  {
    id: 'apt-1',
    number: 101,
    professional_id: 'p-1',
    customer_id: 'c-1',
    customer_name: 'Marcos Benítez',
    customer_phone: '0981 111 222',
    service_product_id: 'srv-1',
    service_name: 'Corte Degradé',
    price: 45000,
    starts_at: '2026-11-12T17:00:00Z',
    ends_at: '2026-11-12T17:40:00Z',
    status: 'confirmed',
    source: 'online',
    notes: null,
    cancel_reason: null,
    public_token: 'tok-1',
    sale_id: null,
    confirmed_at: '2026-11-12T10:00:00Z',
    reminder_sent_at: null,
    created_at: '2026-11-12T09:00:00Z',
  },
  {
    id: 'apt-2',
    number: 102,
    professional_id: 'p-2',
    customer_id: 'c-2',
    customer_name: 'Juan Silva',
    customer_phone: '0982 333 444',
    service_product_id: 'srv-2',
    service_name: 'Corte + Barba',
    price: 70000,
    starts_at: '2026-11-12T18:00:00Z',
    ends_at: '2026-11-12T19:00:00Z',
    status: 'completed',
    source: 'dashboard',
    notes: null,
    cancel_reason: null,
    public_token: 'tok-2',
    sale_id: null,
    confirmed_at: '2026-11-12T10:00:00Z',
    reminder_sent_at: '2026-11-12T16:00:00Z',
    created_at: '2026-11-12T09:00:00Z',
  },
]

const mockAgendaData: AgendaData = {
  available: true,
  date: '2026-11-12',
  days: 1,
  appointments: mockAppointments,
  professionals: mockProfessionals,
  services: [],
  settings: {
    slot_minutes: 30,
    opening_hours: {
      0: [],
      1: [['08:00', '20:00']],
      2: [['08:00', '20:00']],
      3: [['08:00', '20:00']],
      4: [['08:00', '20:00']],
      5: [['08:00', '20:00']],
      6: [['08:00', '20:00']],
    },
    online_booking: true,
    advance_days: 14,
    min_notice_hours: 1,
  },
  pendingCount: 0,
  timeZone: 'America/Asuncion',
  currency: 'PYG',
  storeName: 'Barber Shop Prime',
  storeSlug: 'barbershop-prime',
  canConfigure: true,
}

describe('AntiNoShowReminderCard', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn())
  })

  it('muestra el banner anti no-show con el contador de turnos por recordar', () => {
    const onUpdate = vi.fn()
    render(
      <AntiNoShowReminderCard
        data={mockAgendaData}
        date="2026-11-12"
        onAppointmentUpdated={onUpdate}
      />
    )

    expect(screen.getByText(/Disparador Anti No-Show/i)).toBeInTheDocument()
    expect(screen.getByText(/1 por preparar/i)).toBeInTheDocument()
  })

  it('permite abrir los detalles y enviar recordatorio con WhatsApp', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        appointment: { ...mockAppointments[0], reminder_sent_at: '2026-11-12T16:30:00Z' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const onUpdate = vi.fn()
    render(
      <AntiNoShowReminderCard
        data={mockAgendaData}
        date="2026-11-12"
        onAppointmentUpdated={onUpdate}
      />
    )

    // Expandir
    fireEvent.click(screen.getByRole('button', { name: /Ver detalles/i }))

    expect(screen.getByText('Marcos Benítez')).toBeInTheDocument()
    expect(screen.getByText('Carlos Barbero')).toBeInTheDocument()

    // Clic en Recordar
    const remindButtons = screen.getAllByRole('button', { name: /Recordar/i })
    fireEvent.click(remindButtons[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/agenda/apt-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ action: 'reminder_sent' }),
        })
      )
      expect(window.open).toHaveBeenCalled()
      expect(onUpdate).toHaveBeenCalled()
    })
  })
})

describe('BarberProductivityModal', () => {
  it('renderiza el modal de productividad y calcula el ranking de barberos', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        appointments: mockAppointments,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const onOpenChange = vi.fn()
    render(
      <BarberProductivityModal
        open={true}
        onOpenChange={onOpenChange}
        professionals={mockProfessionals}
        currency="PYG"
        timeZone="America/Asuncion"
        storeName="Barber Shop Prime"
      />
    )

    expect(screen.getByText(/Ranking y Productividad del Equipo/i)).toBeInTheDocument()

    await waitFor(() => {
      // Lucas Fade tiene 1 corte completado (70.000 Gs)
      expect(screen.getByText('Lucas Fade')).toBeInTheDocument()
      expect(screen.getByText('Carlos Barbero')).toBeInTheDocument()
    })

    // Debe mostrar KPI de turnos atendidos
    expect(screen.getByText(/Cortes completados/i)).toBeInTheDocument()
    expect(screen.getByText(/Producido en sillón/i)).toBeInTheDocument()
    expect(screen.getByText(/Consejo Estratégico para el Dueño/i)).toBeInTheDocument()
  })
})
