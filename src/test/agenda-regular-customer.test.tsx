import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AppointmentDialog } from '@/components/dashboard/agenda/AppointmentDialog'
import type { AgendaData, Appointment } from '@/components/dashboard/agenda/types'

const mockData: AgendaData = {
  available: true,
  date: '2026-11-12',
  days: 1,
  appointments: [],
  professionals: [
    {
      id: 'prof-carlos',
      name: 'Carlos Barbero',
      color: '#3b82f6',
      is_active: true,
      remuneration_type: 'commission',
      commission_rate_services: 50,
      commission_rate_products: 10,
      commission_fixed_deduction: 0,
    },
  ],
  services: [
    {
      product_id: 'srv-corte',
      name: 'Corte Degradé',
      price: 45000,
      duration_minutes: 30,
      unit: 'servicio',
      buffer_minutes: 0,
      is_active: true,
    },
    {
      product_id: 'srv-barba',
      name: 'Perfilado de Barba',
      price: 25000,
      duration_minutes: 20,
      unit: 'servicio',
      buffer_minutes: 0,
      is_active: true,
    },
  ],
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

describe('Gestión de clientes habituales en Nuevo Turno', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn())
  })

  it('muestra la ficha de cliente habitual y permite repetir el último corte con un clic', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/agenda/lookup?customerId=cust-123')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            customer: { id: 'cust-123', name: 'Marcos Benítez', phone: '0981 111 222' },
            stats: {
              totalVisits: 6,
              completedVisits: 5,
              lastAppointment: {
                id: 'apt-old-1',
                service_name: 'Corte Degradé',
                service_product_id: 'srv-corte',
                professional_id: 'prof-carlos',
                price: 45000,
                notes: 'Degradé con navaja al 1',
                starts_at: '2026-10-25T15:00:00Z',
                status: 'completed',
              },
              history: [
                {
                  id: 'apt-old-1',
                  service_name: 'Corte Degradé',
                  professional_id: 'prof-carlos',
                  price: 45000,
                  starts_at: '2026-10-25T15:00:00Z',
                  status: 'completed',
                  notes: 'Degradé con navaja al 1',
                },
              ],
            },
          }),
        })
      }

      if (url.includes('/api/agenda/lookup?q=Mar')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            results: [{ id: 'cust-123', name: 'Marcos Benítez', phone: '0981 111 222', whatsapp: '0981 111 222' }],
          }),
        })
      }

      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    vi.stubGlobal('fetch', fetchMock)

    const onClose = vi.fn()
    const onSaved = vi.fn()
    const onEdit = vi.fn()

    render(
      <AppointmentDialog
        state={{ mode: 'create', date: '2026-11-12', time: '16:00', professionalId: 'prof-carlos' }}
        data={mockData}
        onClose={onClose}
        onSaved={onSaved}
        onEdit={onEdit}
      />
    )

    // Buscar el cliente
    const inputCustomer = screen.getByPlaceholderText(/Nombre \(buscá un cliente o escribí uno nuevo\)/i)
    fireEvent.change(inputCustomer, { target: { value: 'Mar' } })
    fireEvent.focus(inputCustomer)

    await waitFor(() => {
      expect(screen.getByText('Marcos Benítez')).toBeInTheDocument()
    })

    // Seleccionar cliente de la lista
    fireEvent.click(screen.getByText('Marcos Benítez'))

    // Debe cargar la ficha de cliente habitual
    await waitFor(() => {
      expect(screen.getByText('Cliente Habitual')).toBeInTheDocument()
      expect(screen.getByText(/6 turnos/i)).toBeInTheDocument()
      expect(screen.getByText(/Repetir último servicio/i)).toBeInTheDocument()
      expect(screen.getByText(/«Degradé con navaja al 1»/i)).toBeInTheDocument()
    })

    // Tocar "Repetir último servicio"
    fireEvent.click(screen.getByRole('button', { name: /Repetir último servicio/i }))

    // El precio debe quedar cargado en 45000
    const priceInput = screen.getByLabelText(/Precio/i) as HTMLInputElement
    expect(priceInput.value).toBe('45000')
  })

  it('permite registrar un nuevo cliente habitual directamente desde el diálogo', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/agenda/lookup' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            customer: { id: 'cust-new-999', name: 'Esteban Gómez', phone: '0985 777 888' },
          }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({ results: [] }) })
    })

    vi.stubGlobal('fetch', fetchMock)

    const onClose = vi.fn()
    const onSaved = vi.fn()
    const onEdit = vi.fn()

    render(
      <AppointmentDialog
        state={{ mode: 'create', date: '2026-11-12', time: '17:00', professionalId: 'prof-carlos' }}
        data={mockData}
        onClose={onClose}
        onSaved={onSaved}
        onEdit={onEdit}
      />
    )

    // Tipear nombre y teléfono de nuevo cliente
    const inputCustomer = screen.getByPlaceholderText(/Nombre \(buscá un cliente o escribí uno nuevo\)/i)
    fireEvent.change(inputCustomer, { target: { value: 'Esteban Gómez' } })

    const inputPhone = screen.getByPlaceholderText('0981 123 456')
    fireEvent.change(inputPhone, { target: { value: '0985 777 888' } })

    // Debe aparecer la sugerencia de guardar como habitual
    await waitFor(() => {
      expect(screen.getByText(/¿Es un cliente nuevo que querés fidelizar\?/i)).toBeInTheDocument()
    })

    const saveHabitualBtn = screen.getByRole('button', { name: /Guardar como cliente habitual/i })
    fireEvent.click(saveHabitualBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/agenda/lookup',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'Esteban Gómez',
            phone: '0985 777 888',
          }),
        })
      )
    })
  })

  it('detecta automáticamente al cliente habitual por su número de teléfono y permite cargar sus datos', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/agenda/lookup?phone=0981111222')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            found: true,
            matchType: 'customer',
            customer: { id: 'cust-123', name: 'Marcos Benítez', phone: '0981 111 222' },
            stats: {
              totalVisits: 6,
              completedVisits: 5,
              lastAppointment: {
                id: 'apt-old-1',
                service_name: 'Corte Degradé',
                service_product_id: 'srv-corte',
                professional_id: 'prof-carlos',
                price: 45000,
                notes: 'Degradé con navaja al 1',
                starts_at: '2026-10-25T15:00:00Z',
                status: 'completed',
              },
              history: [],
            },
          }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({ results: [] }) })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(
      <AppointmentDialog
        state={{ mode: 'create', date: '2026-11-12', time: '18:00', professionalId: 'prof-carlos' }}
        data={mockData}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    // Tipear teléfono de cliente conocido
    const phoneInput = screen.getByPlaceholderText('0981 123 456')
    fireEvent.change(phoneInput, { target: { value: '0981 111 222' } })

    // Debe aparecer la sugerencia inteligente con el nombre del cliente
    await waitFor(() => {
      expect(screen.getByText(/Teléfono reconocido:/i)).toBeInTheDocument()
      expect(screen.getByText('Marcos Benítez')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /⚡ Cargar datos/i })).toBeInTheDocument()
    })

    // Click en "⚡ Cargar datos"
    fireEvent.click(screen.getByRole('button', { name: /⚡ Cargar datos/i }))

    // El nombre del cliente debe quedar autocompletado en el input
    await waitFor(() => {
      const customerInput = screen.getByPlaceholderText(/Nombre \(buscá un cliente o escribí uno nuevo\)/i) as HTMLInputElement
      expect(customerInput.value).toBe('Marcos Benítez')
    })
  })

  it('detecta homónimos cuando hay varios clientes llamados igual y permite diferenciarlos', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('checkHomonyms=true')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            homonyms: [
              { id: 'cust-juan-1', name: 'Juan Gómez', phone: '0981 111 222', ruc: '3.456.789', notes: 'Mecánico' },
              { id: 'cust-juan-2', name: 'Juan Silva', phone: '0971 333 444', ruc: null, notes: 'Primo de Carlos' },
            ],
          }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({ results: [] }) })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(
      <AppointmentDialog
        state={{ mode: 'create', date: '2026-11-12', time: '14:00', professionalId: 'prof-carlos' }}
        data={mockData}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    // Tipear "Juan"
    const customerInput = screen.getByPlaceholderText(/Nombre \(buscá un cliente o escribí uno nuevo\)/i)
    fireEvent.change(customerInput, { target: { value: 'Juan' } })

    // Debe mostrar la alerta de homónimos
    await waitFor(() => {
      expect(screen.getByText(/Clientes parecidos encontrados en tu base de datos:/i)).toBeInTheDocument()
      expect(screen.getByText(/Juan Gómez/i)).toBeInTheDocument()
      expect(screen.getByText(/CI: 3.456.789/i)).toBeInTheDocument()
      expect(screen.getByText(/Juan Silva/i)).toBeInTheDocument()
    })

    // Click en elegir Juan Gómez
    const chooseBtn = screen.getByText(/Juan Gómez/i).closest('button')
    expect(chooseBtn).not.toBeNull()
    if (chooseBtn) fireEvent.click(chooseBtn)

    // El input debe quedar con Juan Gómez y el teléfono cargado
    await waitFor(() => {
      expect((customerInput as HTMLInputElement).value).toBe('Juan Gómez')
    })
  })

  it('permite registrar cliente habitual con Cédula / RUC y Apodo distintivo', async () => {
    let savedPayload: unknown = null

    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/agenda/lookup' && opts?.method === 'POST') {
        savedPayload = JSON.parse(opts.body as string)
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            customer: {
              id: 'cust-juan-new',
              name: 'Juan Pérez',
              phone: '0981 999 888',
              ruc: '4.123.456',
              notes: 'Degradé fino',
            },
            created: true,
          }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({ results: [] }) })
    })

    vi.stubGlobal('fetch', fetchMock)

    render(
      <AppointmentDialog
        state={{ mode: 'create', date: '2026-11-12', time: '14:00', professionalId: 'prof-carlos' }}
        data={mockData}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    // Tipear nombre y teléfono
    const customerInput = screen.getByPlaceholderText(/Nombre \(buscá un cliente o escribí uno nuevo\)/i)
    fireEvent.change(customerInput, { target: { value: 'Juan Pérez' } })

    const phoneInput = screen.getByPlaceholderText('0981 123 456')
    fireEvent.change(phoneInput, { target: { value: '0981 999 888' } })

    // Abrir formulario ampliado con Cédula / Apodo
    const expandBtn = await screen.findByRole('button', { name: /\+ Cédula \/ Apodo/i })
    fireEvent.click(expandBtn)

    // Cargar Cédula y Apodo
    const rucInput = screen.getByPlaceholderText('ej: 4.567.890')
    fireEvent.change(rucInput, { target: { value: '4.123.456' } })

    const nickInput = screen.getByPlaceholderText('ej: Juancho - Mecánico')
    fireEvent.change(nickInput, { target: { value: 'Degradé fino' } })

    // Guardar
    const saveBtn = screen.getByRole('button', { name: /Guardar como cliente habitual/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(savedPayload).toEqual({
        name: 'Juan Pérez',
        phone: '0981 999 888',
        ruc: '4.123.456',
        notes: 'Degradé fino',
      })
    })
  })

  it('detecta disponibilidad de horario en tiempo real y alerta de conflictos con horarios sugeridos', async () => {
    // Agenda con un turno existente de 15:00 a 15:30 con Carlos
    const startsAtIso = new Date(Date.UTC(2026, 10, 12, 18, 0, 0)).toISOString() // 15:00 hs en Asunción (UTC-3)
    const endsAtIso = new Date(Date.UTC(2026, 10, 12, 18, 30, 0)).toISOString()

    const dataWithAppt: AgendaData = {
      ...mockData,
      appointments: [
        {
          id: 'appt-carlos-1',
          number: 101,
          customer_id: 'cust-1',
          customer_name: 'Lucas Galeano',
          customer_phone: '0981 000 111',
          service_product_id: 'srv-corte',
          service_name: 'Corte Degradé',
          price: 45000,
          professional_id: 'prof-carlos',
          starts_at: startsAtIso,
          ends_at: endsAtIso,
          status: 'confirmed',
          source: 'dashboard',
          notes: null,
          cancel_reason: null,
          public_token: 'tok-1',
          sale_id: null,
          confirmed_at: null,
          reminder_sent_at: null,
          created_at: '2026-11-12T10:00:00Z',
        },
      ],
    }

    // 1. Horario libre a las 16:00
    const { rerender } = render(
      <AppointmentDialog
        state={{ mode: 'create', date: '2026-11-12', time: '16:00', professionalId: 'prof-carlos' }}
        data={dataWithAppt}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    // Debe mostrar indicador de horario disponible
    expect(screen.getByText(/Sin cruces en turnos cargados · Carlos Barbero/i)).toBeInTheDocument()
    expect(screen.getByText(/✓ Sin cruces/i)).toBeInTheDocument()

    // 2. Si se cambia la hora a las 15:00 (en conflicto con Lucas Galeano)
    const timeInput = screen.getByLabelText(/Hora/i)
    fireEvent.change(timeInput, { target: { value: '15:00' } })

    // Debe mostrar alerta de horario ocupado y sugerencias
    await waitFor(() => {
      expect(screen.getByText(/Horario ocupado con Carlos Barbero/i)).toBeInTheDocument()
      expect(screen.getByText(/Lucas Galeano/i)).toBeInTheDocument()
      expect(screen.getByText(/⚡ Horarios libres sugeridos hoy:/i)).toBeInTheDocument()
    })

    // Click en una sugerencia libre (por ejemplo 15:30 hs)
    const suggestedBtn = screen.getByRole('button', { name: '⚡ 15:30 hs' })
    fireEvent.click(suggestedBtn)

    // El horario debe volver a estar disponible
    await waitFor(() => {
      expect(screen.getByText(/Sin cruces en turnos cargados · Carlos Barbero/i)).toBeInTheDocument()
      expect(screen.getByText(/✓ Sin cruces/i)).toBeInTheDocument()
    })
  })
})
