import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Repair } from '@/types/repairs'
import { Table, TableBody } from '@/components/ui/table'
import { RepairRow } from '../RepairRow'

vi.mock('@/hooks/useWhatsApp', () => ({
  useWhatsApp: () => ({
    notifyRepairStatus: vi.fn(),
    notifyRepairReady: vi.fn(),
    sendPaymentReminder: vi.fn(),
  }),
}))

vi.mock('@/lib/repair-receipt', () => ({ printRepairReceipt: vi.fn() }))

const repair = {
  id: 'repair-payment-row',
  ticketNumber: 'R-100',
  customer: { id: 'customer-1', name: 'Ana Pérez', phone: '0981' },
  device: 'Teléfono',
  deviceType: 'smartphone',
  brand: 'Marca',
  model: 'Modelo',
  issue: 'Pantalla',
  description: 'Pantalla rota',
  status: 'entregado',
  priority: 'medium',
  urgency: 'normal',
  estimatedCost: 200_000,
  finalCost: 200_000,
  paidAmount: 95_000,
  laborCost: 0,
  technician: null,
  location: 'Taller',
  warranty: null,
  createdAt: '2026-09-07T12:00:00.000Z',
  estimatedCompletion: null,
  completedAt: null,
  lastUpdate: '2026-09-07T12:00:00.000Z',
  progress: 100,
  customerRating: null,
  notes: [],
  parts: [],
  images: [],
  notifications: { customer: false, technician: false, manager: false },
} satisfies Repair

function renderRow(value: Repair) {
  return render(
    <Table>
      <TableBody>
        <RepairRow repair={value} onEdit={vi.fn()} />
      </TableBody>
    </Table>,
  )
}

describe('RepairRow payment status', () => {
  it('identifies a delivered repair that still has an outstanding balance', () => {
    renderRow(repair)

    expect(screen.getByText('Entregado con saldo pendiente')).toBeVisible()
    expect(screen.getByText(/Falta.*105[.]000/)).toBeVisible()
  })

  it('does not treat an advance without a final price as a fully paid repair', () => {
    renderRow({ ...repair, status: 'reparacion', finalCost: null, estimatedCost: 0, paidAmount: 95_000 })

    expect(screen.getByText('Anticipo · precio pendiente')).toBeVisible()
    expect(screen.queryByText('Pagado')).not.toBeInTheDocument()
  })

  it('refreshes the financial indicator when a payment changes', () => {
    const view = renderRow({ ...repair, status: 'reparacion' })

    expect(screen.getByText('Pago parcial')).toBeVisible()
    view.rerender(
      <Table>
        <TableBody>
          <RepairRow repair={{ ...repair, status: 'reparacion', paidAmount: 200_000 }} onEdit={vi.fn()} />
        </TableBody>
      </Table>,
    )

    expect(screen.getByText('Pagado')).toBeVisible()
    expect(screen.queryByText('Pago parcial')).not.toBeInTheDocument()
  })
})
