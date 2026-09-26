import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RepairOperationsOverview } from '../RepairOperationsOverview'
import type { Repair } from '@/types/repairs'

const mockRepairs: Repair[] = [
  {
    id: 'rep-1',
    ticketNumber: 'T-001',
    device: 'iPhone 13',
    deviceType: 'smartphone',
    brand: 'Apple',
    model: '13',
    issue: 'Batería degradada',
    description: 'Cambio de batería',
    status: 'listo',
    priority: 'high',
    urgency: 'urgent',
    estimatedCost: 200000,
    finalCost: 200000,
    laborCost: 50000,
    technician: { id: 'tech-1', name: 'Carlos Técnico', email: 'carlos@test.com', role: 'technician' },
    location: 'Taller',
    warranty: null,
    createdAt: new Date().toISOString(),
    estimatedCompletion: null,
    completedAt: null,
    lastUpdate: new Date().toISOString(),
    parts: [],
    customer: { id: 'c1', name: 'Mario López', phone: '0981111' },
  },
  {
    id: 'rep-2',
    ticketNumber: 'T-002',
    device: 'Samsung A52',
    deviceType: 'smartphone',
    brand: 'Samsung',
    model: 'A52',
    issue: 'Pantalla partida',
    description: 'Módulo completo',
    status: 'pausado',
    priority: 'medium',
    urgency: 'normal',
    estimatedCost: 350000,
    finalCost: 350000,
    laborCost: 80000,
    technician: null,
    location: 'Taller',
    warranty: null,
    createdAt: new Date().toISOString(),
    estimatedCompletion: null,
    completedAt: null,
    lastUpdate: new Date().toISOString(),
    parts: [],
    customer: { id: 'c2', name: 'Lucía Benítez', phone: '0982222' },
  },
]

describe('RepairOperationsOverview', () => {
  it('renders the header with operational title and count of visible orders', () => {
    render(
      <RepairOperationsOverview
        repairs={mockRepairs}
        filteredCount={2}
        selectedBranchName="Casa Central"
      />
    )

    expect(screen.getByText('Resumen de Atención Diaria')).toBeInTheDocument()
    expect(screen.getByText('Casa Central')).toBeInTheDocument()
    expect(screen.getByText(/2 de 2 órdenes visibles/i)).toBeInTheDocument()
  })

  it('displays the 4 key operational signal cards with correct counts', () => {
    render(
      <RepairOperationsOverview
        repairs={mockRepairs}
        filteredCount={2}
      />
    )

    expect(screen.getByText('Urgentes')).toBeInTheDocument()
    expect(screen.getByText('Sin Técnico')).toBeInTheDocument()
    expect(screen.getByText('Listas para Entrega')).toBeInTheDocument()
    expect(screen.getByText('En Pausa / Espera')).toBeInTheDocument()
  })

  it('triggers filter callback when clicking on a filterable card like Listas para Entrega', () => {
    const onFilter = vi.fn()
    render(
      <RepairOperationsOverview
        repairs={mockRepairs}
        filteredCount={2}
        onStatusFilterSelect={onFilter}
      />
    )

    const readyCard = screen.getByRole('button', { name: /Listas para Entrega/i })
    fireEvent.click(readyCard)
    expect(onFilter).toHaveBeenCalledWith('listo')
  })

  it('allows expanding and collapsing the detailed operational view', () => {
    render(
      <RepairOperationsOverview
        repairs={mockRepairs}
        filteredCount={2}
      />
    )

    expect(screen.queryByText('Cola de Atención Prioritaria')).not.toBeInTheDocument()

    const toggleBtn = screen.getByRole('button', { name: /Ver detalle/i })
    fireEvent.click(toggleBtn)

    expect(screen.getByText('Cola de Atención Prioritaria')).toBeInTheDocument()
    expect(screen.getByText('Carga de Trabajo por Técnico')).toBeInTheDocument()
    expect(screen.getByText('Mario López')).toBeInTheDocument()
  })
})
