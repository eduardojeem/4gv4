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
})
