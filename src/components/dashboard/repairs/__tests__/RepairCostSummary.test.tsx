import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RepairCostSummary } from '../RepairCostSummary'

vi.mock('@/hooks/use-can-view-cost', () => ({ useCanViewCost: () => true }))

describe('RepairCostSummary', () => {
  it('emphasizes total, payments, balance and included VAT', () => {
    render(<RepairCostSummary
      summary={{
        revisionId: 'revision-1', revisionNumber: 2, laborAmount: 110_000,
        partsSubtotal: 190_000, partsInternalCost: 150_000, additionalCharges: 20_000,
        servicesSubtotal: 120_000, chargedPartsSubtotal: 70_000,
        includedMaterialsInternalCost: 50_000,
        deductions: 0, discountAmount: 20_000, subtotalBeforeDiscount: 320_000,
        finalTotal: 300_000, paidAmount: 100_000, balance: 200_000,
        taxBreakdown: [{ rate: 10, grossAmount: 300_000, taxableBase: 272_727, taxAmount: 27_273 }],
      }}
      editable
      onEdit={vi.fn()}
    />)

    const region = screen.getByRole('region', { name: 'Resumen de costos' })
    expect(region).toHaveTextContent('Total final')
    expect(region).toHaveTextContent('300.000')
    expect(region).toHaveTextContent('Pagado')
    expect(region).toHaveTextContent('Pendiente')
    expect(region).toHaveTextContent('IVA incluido 10%')
    expect(region).toHaveTextContent('Servicios')
    expect(region).toHaveTextContent('Repuestos cobrados')
    expect(region).toHaveTextContent('Material incluido · interno')
    expect(screen.getByRole('button', { name: 'Editar costos y repuestos' })).toBeEnabled()
  })
})
