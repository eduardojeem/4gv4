import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Repair } from '@/types/repairs'
import { RepairCostsEditorDialog } from '../RepairCostsEditorDialog'

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ isAdmin: true, hasPermission: () => true })
}))

vi.mock('@/hooks/use-can-view-cost', () => ({
  useCanViewCost: () => true
}))

const mockRepair: Repair = {
  id: 'repair-finance-1',
  customer: { name: 'Cliente Finanzas', phone: '0981123456', email: '' },
  device: 'Samsung Galaxy A54',
  deviceType: 'smartphone',
  brand: 'Samsung',
  model: 'Galaxy A54',
  issue: 'Cambio de pantalla y pin de carga',
  description: '',
  status: 'reparacion',
  priority: 'medium',
  urgency: 'normal',
  estimatedCost: 350000,
  finalCost: 350000,
  laborCost: 150000,
  paidAmount: 100000,
  technician: null,
  location: 'Taller Central',
  warranty: null,
  createdAt: '2026-08-20T00:00:00Z',
  estimatedCompletion: null,
  completedAt: null,
  lastUpdate: '2026-08-20T00:00:00Z',
  progress: 50,
  customerRating: null,
  notes: [],
  images: [],
  notifications: { customer: false, technician: false, manager: false },
  parts: [
    {
      id: 1,
      name: 'Pantalla OLED Original',
      quantity: 1,
      cost: 200000,
      internalCost: 120000,
      supplier: 'Proveedor Central',
      partNumber: 'OLED-SAM-A54',
      taxRate: 10,
      discountAmount: 0
    }
  ]
}

describe('RepairCostsEditorDialog - Financial Impact and Numbers Input', () => {
  it('displays the financial guide button in header', () => {
    render(
      <RepairCostsEditorDialog
        open={true}
        repair={mockRepair}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /¿Cómo funciona y cómo impacta en las finanzas\?/i })).toBeVisible()
  })

  it('provides quick preset buttons (+10k, +50k, +100k, 0 Gs.) and currency helpers to easily add numbers', async () => {
    const user = userEvent.setup()
    render(
      <RepairCostsEditorDialog
        open={true}
        repair={mockRepair}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    const labor = screen.getByLabelText('Mano de obra adicional opcional')
    expect(labor).toHaveValue(150000)

    const laborSection = labor.closest('section')!
    const plus50kButton = within(laborSection).getByRole('button', { name: '+50k' })
    await user.click(plus50kButton)

    expect(labor).toHaveValue(200000)

    // Reset with 0 Gs. button
    const clearButton = within(laborSection).getByRole('button', { name: '0 Gs.' })
    await user.click(clearButton)
    expect(labor).toHaveValue(0)
  })

  it('displays financial impact cards, gross profit, and margin in real-time summary', () => {
    render(
      <RepairCostsEditorDialog
        open={true}
        repair={mockRepair}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.getByText('Impacto en Finanzas')).toBeVisible()
    expect(screen.getByText('Costo Reposición')).toBeVisible()
    expect(screen.getByText('Utilidad Bruta')).toBeVisible()
    expect(screen.getByText(/% Margen/i)).toBeVisible()
  })

  it('includes detailed financial impact in confirmation preview (Step 2)', async () => {
    const user = userEvent.setup()
    render(
      <RepairCostsEditorDialog
        open={true}
        repair={mockRepair}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Revisar y confirmar' }))

    expect(screen.getByText('Impacto Financiero y Rentabilidad de la Orden')).toBeVisible()
    expect(screen.getByText('Ingreso Facturado')).toBeVisible()
    expect(screen.getByText('Costo Interno (Piezas)')).toBeVisible()
    expect(screen.getByText('Utilidad Bruta Estimada')).toBeVisible()
  })

  it('opens the finance guide modal with practical real-world examples when clicking the button', async () => {
    const user = userEvent.setup()
    render(
      <RepairCostsEditorDialog
        open={true}
        repair={mockRepair}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />
    )

    const guideButton = screen.getByRole('button', { name: /¿Cómo funciona y cómo impacta en las finanzas\?/i })
    await user.click(guideButton)

    expect(screen.getByText('Guía práctica y ejemplos con cifras reales en Guaraníes (Gs.) para talleres técnicos')).toBeVisible()
    expect(screen.getByText(/Caso A: Cambio de Módulo \/ Pantalla Samsung/i)).toBeVisible()
    expect(screen.getAllByText(/Gs\. 150\.000/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Gs\. 280\.000/i).length).toBeGreaterThan(0)
    expect(screen.getByText('3. Semáforo de Rentabilidad del Taller')).toBeVisible()
    expect(screen.getByText('4. Tres Reglas de Oro para la Caja y Flujo de Fondos')).toBeVisible()

    // Test tab switching
    await user.click(screen.getByRole('button', { name: 'Caso B: Placa/Pin' }))
    expect(screen.getByText(/Caso B: Reparación de Placa \/ Pin de Carga \/ Reballing/i)).toBeVisible()
    expect(screen.getByText(/Excelente Rentabilidad \(94%\)/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Caso C: Error de Margen' }))
    expect(screen.getByText(/Caso C: Descuento Excesivo o Repuesto Muy Caro/i)).toBeVisible()
    expect(screen.getByText(/Alerta Crítica \(5\.8%\)/i)).toBeVisible()
  })
})
