import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Repair } from '@/types/repairs'
import { RepairCard } from '../RepairCard'

const repair = {
  id: 'repair-payment-card',
  ticketNumber: 'R-200',
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

describe('RepairCard payment status', () => {
  it('shows the financial status on cards', () => {
    render(<RepairCard repair={repair} />)

    expect(screen.getByLabelText('Estado financiero de la reparación')).toBeVisible()
    expect(screen.getByText('Entregado con saldo pendiente')).toBeVisible()
  })

  it('keeps the generic unverified message out of the card list', () => {
    render(<RepairCard repair={{ ...repair, status: 'listo', qualityCheck: null }} />)

    expect(screen.queryByText('Sin verificar')).not.toBeInTheDocument()
  })

  /** El resultado técnico se ve en el detalle, no en la tarjeta. */
  it('does not show the technical result on the card', () => {
    const { rerender } = render(<RepairCard repair={{ ...repair, status: 'listo', qualityCheck: { id: 'q1', result: 'passed', checklist: { powersOn: true, reportedIssueResolved: true, basicFunctions: true, physicalCondition: true, accessoriesVerified: true }, checkedAt: '2026-09-13T20:00:00Z' } }} />)
    expect(screen.queryByText('Probado · Funciona')).not.toBeInTheDocument()

    rerender(<RepairCard repair={{ ...repair, status: 'entregado', qualityCheck: { id: 'q2', result: 'unrepairable', checklist: { powersOn: false, reportedIssueResolved: false, basicFunctions: false, physicalCondition: true, accessoriesVerified: true }, checkedAt: '2026-09-13T20:00:00Z' } }} />)
    expect(screen.queryByText('No fue posible reparar')).not.toBeInTheDocument()
  })

  it('renders correctly in compact mode for kanban boards', () => {
    render(<RepairCard repair={repair} compact />)
    expect(screen.getByLabelText('Estado financiero de la reparación')).toBeVisible()
    expect(screen.getByText('Teléfono')).toBeVisible()
    expect(screen.getByText('#R-200')).toBeVisible()
  })

  it('shows Entregado · sin costo for delivered repairs with price 0 and no debt', () => {
    render(<RepairCard repair={{ ...repair, finalCost: 0, estimatedCost: 0, paidAmount: 0 }} />)
    expect(screen.getByText('Entregado · sin costo')).toBeVisible()
    expect(screen.queryByText('Entregado con saldo pendiente')).not.toBeInTheDocument()
    expect(screen.queryByText(/Falta/)).not.toBeInTheDocument()
  })
})
