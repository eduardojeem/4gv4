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

describe('RepairRow financial visibility', () => {
  it('keeps payment status out of the table row', () => {
    renderRow(repair)

    expect(screen.queryByLabelText('Estado financiero de la reparación')).not.toBeInTheDocument()
    expect(screen.queryByText('Entregado con saldo pendiente')).not.toBeInTheDocument()
    expect(screen.queryByText(/Falta.*105[.]000/)).not.toBeInTheDocument()
    expect(screen.getByText('Entregado')).toBeVisible()
  })

  it('does not show an advance or a paid label in the table row', () => {
    renderRow({ ...repair, status: 'reparacion', finalCost: null, estimatedCost: 0, paidAmount: 95_000 })

    expect(screen.queryByText('Anticipo · precio pendiente')).not.toBeInTheDocument()
    expect(screen.queryByText('Pagado')).not.toBeInTheDocument()
    expect(screen.getByText('En Reparación')).toBeVisible()
  })
})
