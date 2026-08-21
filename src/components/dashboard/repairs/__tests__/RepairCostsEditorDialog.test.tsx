import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Repair } from '@/types/repairs'
import { RepairCostsEditorDialog } from '../RepairCostsEditorDialog'

vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ isAdmin: false }) }))

const repair = {
  id: 'repair-1', customer: { name: 'Ana', phone: '', email: '' }, device: 'Teléfono',
  deviceType: 'smartphone', brand: 'Marca', model: 'Modelo', issue: 'Pantalla', description: '',
  status: 'reparacion', priority: 'medium', urgency: 'normal', estimatedCost: 200_000,
  finalCost: 200_000, laborCost: 100_000, paidAmount: 0, technician: null, location: 'Taller',
  warranty: null, createdAt: '2026-08-20T00:00:00Z', estimatedCompletion: null,
  completedAt: null, lastUpdate: '2026-08-20T00:00:00Z', progress: 50,
  customerRating: null, notes: [], images: [], notifications: { customer: false, technician: false, manager: false },
  parts: [{ id: 1, name: 'Pantalla', quantity: 1, cost: 100_000, internalCost: 80_000, supplier: '', partNumber: '', taxRate: 10, discountAmount: 0 }],
} satisfies Repair

describe('RepairCostsEditorDialog', () => {
  it('recalculates immediately and shows a consolidated preview', async () => {
    const user = userEvent.setup()
    render(<RepairCostsEditorDialog open repair={repair} onOpenChange={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByRole('dialog')).toHaveClass('max-w-[1400px]', 'h-[96dvh]')
    expect(screen.getByText('Ana · Marca Modelo')).toBeVisible()
    expect(screen.getByText('Paso 1 de 2')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled()
    expect(screen.getByText('Subtotal antes de descuentos')).toBeVisible()
    expect(screen.getByText('IVA incluido')).toBeVisible()

    const labor = screen.getByLabelText('Mano de obra fija')
    await user.clear(labor)
    await user.type(labor, '120000')
    expect(screen.getByTestId('editor-final-total')).toHaveTextContent('220.000')

    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }))
    expect(screen.getByRole('heading', { name: 'Vista previa de costos' })).toBeVisible()
    expect(screen.getByText('Paso 2 de 2')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirmar costos' })).toBeEnabled()
    expect(screen.getByText('Monto total final')).toBeVisible()
    expect(screen.getByText('Monto total final').parentElement).toHaveTextContent('220.000')
  })

  it('blocks a part price below inventory cost for a normal user', async () => {
    const user = userEvent.setup()
    render(<RepairCostsEditorDialog open repair={repair} onOpenChange={vi.fn()} onSaved={vi.fn()} />)

    const price = screen.getAllByLabelText('Precio cobrado de Pantalla')[0]
    await user.clear(price)
    await user.type(price, '50000')

    expect(screen.getByRole('alert')).toHaveTextContent('debajo del costo de inventario')
    expect(screen.getByRole('button', { name: 'Revisar y confirmar' })).toBeDisabled()
  })

  it('identifies a wholesale service repair', () => {
    render(<RepairCostsEditorDialog open repair={{ ...repair, customer: { ...repair.customer, is_wholesale: true } }} onOpenChange={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByText('Cliente mayorista')).toBeVisible()
    expect(screen.getByText('Servicio técnico')).toBeVisible()
    expect(screen.getByText('La mano de obra fue precargada para este servicio.')).toBeVisible()
  })

  it('identifies a parts-only repair and keeps labor optional at zero', () => {
    render(<RepairCostsEditorDialog open repair={{ ...repair, laborCost: 0 }} onOpenChange={vi.fn()} onSaved={vi.fn()} />)

    expect(screen.getByText('Solo repuestos')).toBeVisible()
    expect(screen.getByText('Esta reparación no tiene mano de obra cargada. Podés dejarla en cero.')).toBeVisible()
    expect(screen.getByLabelText('Mano de obra opcional')).toHaveValue(0)
  })

  it('adds a manual service as labor when it is not in the catalog', async () => {
    const user = userEvent.setup()
    render(<RepairCostsEditorDialog open repair={{ ...repair, laborCost: 0 }} onOpenChange={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Agregar servicio' }))
    expect(screen.getByText('Agregar servicio manual')).toBeVisible()
    await user.type(screen.getByLabelText('Monto del servicio'), '75000')
    await user.click(screen.getByRole('button', { name: 'Aplicar servicio' }))

    expect(screen.getByLabelText('Mano de obra fija')).toHaveValue(75000)
    expect(screen.getByText('Servicio técnico')).toBeVisible()
  })

  it('adds an editable manual part without linking inventory', async () => {
    const user = userEvent.setup()
    render(<RepairCostsEditorDialog open repair={repair} onOpenChange={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Agregar repuesto' }))

    expect(screen.getAllByLabelText('Nombre del repuesto manual')[0]).toBeVisible()
    expect(screen.getAllByText('Carga manual · no descuenta stock')[0]).toBeVisible()
  })
})
