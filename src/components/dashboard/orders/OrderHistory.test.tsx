import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OrderHistory } from './OrdersDashboard'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

const events = [
  {
    id: 'status:1',
    kind: 'STATUS',
    from: null,
    to: 'PENDING',
    note: null,
    amount: null,
    actor: 'Ana Duarte',
    createdAt: '2026-08-14T13:00:00.000Z',
  },
  {
    id: 'payment:1',
    kind: 'PAYMENT',
    from: 'PENDING',
    to: 'PAID',
    note: null,
    amount: 250_000,
    actor: 'Ana Duarte',
    createdAt: '2026-08-14T14:30:00.000Z',
  },
  {
    id: 'status:2',
    kind: 'STATUS',
    from: 'PENDING',
    to: 'CANCELLED',
    note: 'Expirada automaticamente por falta de pago (72h).',
    amount: null,
    actor: null,
    createdAt: '2026-08-17T13:00:00.000Z',
  },
]

describe('OrderHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders status and payment events with their author', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: true, data: { events } })))

    render(<OrderHistory orderId="order-1" />)

    expect(await screen.findByText('Pendiente')).toBeInTheDocument()
    expect(screen.getByText('Pago: Pagado')).toBeInTheDocument()
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
    expect(screen.getAllByText(/Ana Duarte/)).toHaveLength(2)
  })

  // La expiración automática a 72h no tiene autor: se registra sin usuario y
  // debe leerse como acción del sistema, no como un cambio sin responsable.
  it('attributes author-less entries to the system and shows their note', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: true, data: { events } })))

    render(<OrderHistory orderId="order-1" />)

    expect(await screen.findByText(/Sistema/)).toBeInTheDocument()
    expect(screen.getByText('Expirada automaticamente por falta de pago (72h).')).toBeInTheDocument()
  })

  it('explains an empty history instead of rendering nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: true, data: { events: [] } })))

    render(<OrderHistory orderId="order-1" />)

    expect(await screen.findByText('Todavía no hay cambios registrados para este pedido.')).toBeInTheDocument()
  })

  it('surfaces a load failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: false, error: 'No se pudo cargar el historial.' }, 500)))

    render(<OrderHistory orderId="order-1" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el historial.')
  })
})
