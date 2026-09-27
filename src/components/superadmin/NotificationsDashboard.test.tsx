import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationsDashboard, type GlobalNotification, type OrgOption } from './NotificationsDashboard'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const mockNotifications: GlobalNotification[] = [
  {
    id: 'notif-1',
    title: 'Mantenimiento preventivo',
    body: 'Los servidores se actualizarán esta noche a las 02:00.',
    type: 'warning',
    target: 'all',
    target_org_ids: null,
    status: 'sent',
    scheduled_at: null,
    sent_at: '2026-09-01T10:00:00Z',
    created_at: '2026-09-01T09:00:00Z',
    read_count: 5,
    dismissed_count: 1,
  },
  {
    id: 'notif-2',
    title: 'Nueva funcionalidad de inventario',
    body: 'Ya está habilitado el escaneo por códigos QR.',
    type: 'success',
    target: 'specific',
    target_org_ids: ['org-1'],
    status: 'draft',
    scheduled_at: null,
    sent_at: null,
    created_at: '2026-09-05T12:00:00Z',
    read_count: 0,
    dismissed_count: 0,
  },
  {
    id: 'notif-3',
    title: 'Aviso de facturación mensual',
    body: 'Recordatorio para renovar el plan de suscripción.',
    type: 'info',
    target: 'all',
    target_org_ids: null,
    status: 'scheduled',
    scheduled_at: '2026-09-20T08:00:00Z',
    sent_at: null,
    created_at: '2026-09-08T15:00:00Z',
    read_count: 0,
    dismissed_count: 0,
  },
]

const mockOrgs: OrgOption[] = [
  { id: 'org-1', name: 'Farmacia Central', slug: 'farmacia-central' },
  { id: 'org-2', name: 'Distribuidora Este', slug: 'distribuidora-este' },
]

describe('NotificationsDashboard', () => {
  beforeEach(() => {
    refresh.mockReset()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })
    )
  })

  it('renderiza correctamente las métricas de KPI y el listado inicial', () => {
    render(
      <NotificationsDashboard
        notifications={mockNotifications}
        total={3}
        organizations={mockOrgs}
      />
    )

    // Check KPIs
    expect(screen.getByText('Total Comunicados')).toBeInTheDocument()
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
    expect(screen.getByText('5 lecturas registradas')).toBeInTheDocument()

    // Check Notifications in list
    expect(screen.getByText('Mantenimiento preventivo')).toBeInTheDocument()
    expect(screen.getByText('Nueva funcionalidad de inventario')).toBeInTheDocument()
    expect(screen.getByText('Aviso de facturación mensual')).toBeInTheDocument()
  })

  it('filtra en tiempo real por término de búsqueda en título o cuerpo', () => {
    render(
      <NotificationsDashboard
        notifications={mockNotifications}
        total={3}
        organizations={mockOrgs}
      />
    )

    const searchInput = screen.getByPlaceholderText(/Buscar por título/i)
    fireEvent.change(searchInput, { target: { value: 'escaneo' } })

    expect(screen.getByText('Nueva funcionalidad de inventario')).toBeInTheDocument()
    expect(screen.queryByText('Mantenimiento preventivo')).not.toBeInTheDocument()
    expect(screen.queryByText('Aviso de facturación mensual')).not.toBeInTheDocument()
  })

  it('permite alternar entre vista Tabla y vista Tarjetas', () => {
    render(
      <NotificationsDashboard
        notifications={mockNotifications}
        total={3}
        organizations={mockOrgs}
      />
    )

    const cardsButton = screen.getByRole('button', { name: /Tarjetas/i })
    fireEvent.click(cardsButton)

    // In cards view, card headers and action footers are rendered
    expect(screen.getAllByText('Detalles').length).toBeGreaterThan(0)

    const tableButton = screen.getByRole('button', { name: /Tabla/i })
    fireEvent.click(tableButton)

    expect(screen.getByText('Tipo & Estado')).toBeInTheDocument()
  })

  it('abre el modal de previsualización en vivo al hacer clic en un registro', () => {
    render(
      <NotificationsDashboard
        notifications={mockNotifications}
        total={3}
        organizations={mockOrgs}
      />
    )

    const row = screen.getByText('Mantenimiento preventivo')
    fireEvent.click(row)

    expect(screen.getByText('Detalle de Notificación')).toBeInTheDocument()
    expect(screen.getByText('Así la ven los usuarios:')).toBeInTheDocument()
    expect(screen.getByText('5 usuarios leyeron')).toBeInTheDocument()
  })

  it('abre el diálogo de confirmación para Enviar ahora', () => {
    render(
      <NotificationsDashboard
        notifications={mockNotifications}
        total={3}
        organizations={mockOrgs}
      />
    )

    // Draft notification has "Enviar ahora" button
    const sendButtons = screen.getAllByTitle('Enviar ahora')
    expect(sendButtons.length).toBeGreaterThan(0)

    fireEvent.click(sendButtons[0])
    expect(screen.getByText('¿Enviar notificación ahora?')).toBeInTheDocument()
    expect(screen.getByText('Sí, enviar ahora')).toBeInTheDocument()
  })
})
