import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import type { Repair } from '@/types/repairs'
import { server } from '@/test/mocks/server'
import { RepairDetailDialog } from '../RepairDetailDialog'

vi.mock('@/hooks/use-shared-settings', () => ({
  useSharedSettings: () => ({ settings: {} }),
}))

vi.mock('@/components/dashboard/after-sales/CreateAfterSalesCaseDialog', () => ({
  CreateAfterSalesCaseDialog: () => null,
}))

vi.mock('../RepairWarrantyCase', () => ({ RepairWarrantyCase: () => null }))

const baseRepair = {
  id: 'repair-1',
  ticketNumber: 'R-1',
  customer: { id: 'customer-1', name: 'Ana Pérez', phone: '0981', email: 'ana@example.com' },
  device: 'Teléfono',
  deviceType: 'smartphone',
  brand: 'Marca',
  model: 'Modelo',
  issue: 'Pantalla',
  description: 'Pantalla rota',
  priority: 'medium',
  urgency: 'normal',
  estimatedCost: 100,
  finalCost: 100,
  laborCost: 60,
  technician: null,
  location: 'Taller',
  warranty: null,
  createdAt: '2026-08-14T12:00:00.000Z',
  estimatedCompletion: null,
  completedAt: null,
  lastUpdate: '2026-08-14T12:00:00.000Z',
  progress: 100,
  customerRating: null,
  notes: [],
  parts: [],
  images: [],
  notifications: { customer: false, technician: false, manager: false },
} satisfies Omit<Repair, 'status'>

describe('RepairDetailDialog payment summary', () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    server.use(http.post('/api/repairs/sign', () => HttpResponse.json({ success: false })))
  })

  it('shows the total, paid amount and zero pending balance for a paid repair', () => {
    render(
      <RepairDetailDialog
        open
        repair={{ ...baseRepair, status: 'entregado', paidAmount: 100 }}
        onClose={vi.fn()}
      />,
    )

    const summary = screen.getByRole('region', { name: 'Estado del pago' })
    expect(within(summary).getByText('Pago completado')).toBeInTheDocument()
    expect(within(summary).getByText('Total')).toBeInTheDocument()
    expect(within(summary).getByText('Pagado')).toBeInTheDocument()
    expect(within(summary).getByText('Pendiente')).toBeInTheDocument()
  })

  it('shows the outstanding amount and collection action after delivery', () => {
    render(
      <RepairDetailDialog
        open
        repair={{ ...baseRepair, status: 'entregado', paidAmount: 40 }}
        onClose={vi.fn()}
        onQuickPay={vi.fn()}
      />,
    )

    expect(screen.getByText('Pago parcial')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cobrar saldo' })).toBeEnabled()
  })

  it('opens quick price editing from the costs section', async () => {
    const user = userEvent.setup()
    render(
      <RepairDetailDialog
        open
        repair={{ ...baseRepair, status: 'listo', paidAmount: 40 }}
        onClose={vi.fn()}
        onQuickPriceSave={vi.fn().mockResolvedValue(true)}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Costos y Piezas' }))
    await user.click(screen.getByRole('button', { name: 'Editar precio' }))

    expect(screen.getByRole('heading', { name: 'Editar precio de reparación' })).toBeInTheDocument()
  })

  it('does not offer quick price editing for a cancelled repair', async () => {
    const user = userEvent.setup()
    render(
      <RepairDetailDialog
        open
        repair={{ ...baseRepair, status: 'cancelado', paidAmount: 0 }}
        onClose={vi.fn()}
        onQuickPriceSave={vi.fn().mockResolvedValue(true)}
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Costos y Piezas' }))

    expect(screen.queryByRole('button', { name: 'Editar precio' })).not.toBeInTheDocument()
  })
})
