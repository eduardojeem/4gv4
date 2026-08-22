import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Repair } from '@/types/repairs'
import { RepairQuickPriceDialog } from '../RepairQuickPriceDialog'

const repair: Repair = {
  id: 'repair-quick-price-1',
  ticketNumber: 'R-100',
  customer: { id: 'customer-1', name: 'Ana Pérez', phone: '0981', email: 'ana@example.com' },
  device: 'Teléfono',
  deviceType: 'smartphone',
  brand: 'Marca',
  model: 'Modelo',
  issue: 'Pantalla',
  description: 'Pantalla rota',
  status: 'listo',
  priority: 'medium',
  urgency: 'normal',
  estimatedCost: 300000,
  finalCost: 300000,
  laborCost: 150000,
  pricingMode: 'budget',
  discountAmount: 0,
  paidAmount: 100000,
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
  parts: [{ id: 1, name: 'Pantalla', cost: 50000, quantity: 1, supplier: '', partNumber: '' }],
  images: [],
  notifications: { customer: false, technician: false, manager: false },
}

describe('RepairQuickPriceDialog', () => {
  it('shows the amount already paid and the resulting balance', () => {
    render(
      <RepairQuickPriceDialog
        open
        repair={repair}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Editar precio de reparación' })).toBeInTheDocument()
    expect(screen.getByText('Ya pagado')).toBeInTheDocument()
    expect(screen.getByText('Saldo resultante')).toBeInTheDocument()
    expect(screen.getByText(/100\.000/)).toBeInTheDocument()
    expect(screen.getByText(/200\.000/)).toBeInTheDocument()
  })

  it('blocks a budget below the amount already paid', async () => {
    const user = userEvent.setup()
    render(
      <RepairQuickPriceDialog
        open
        repair={repair}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Presupuesto acordado' }))
    await user.type(screen.getByLabelText('Precio al cliente'), '90000')

    expect(screen.getByText('El precio no puede ser menor que lo ya pagado.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar precio' })).toBeDisabled()
  })

  it('submits a valid agreed budget and closes only after persistence succeeds', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(true)
    const onOpenChange = vi.fn()
    render(
      <RepairQuickPriceDialog
        open
        repair={repair}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Presupuesto acordado' }))
    await user.type(screen.getByLabelText('Precio al cliente'), '320000')
    await user.click(screen.getByRole('button', { name: 'Guardar precio' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      pricingMode: 'budget',
      finalCost: 320000,
      laborCost: 270000,
    }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('stays open when persistence fails', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <RepairQuickPriceDialog
        open
        repair={repair}
        onOpenChange={onOpenChange}
        onSave={vi.fn().mockResolvedValue(false)}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Presupuesto acordado' }))
    await user.type(screen.getByLabelText('Precio al cliente'), '320000')
    await user.click(screen.getByRole('button', { name: 'Guardar precio' }))

    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
