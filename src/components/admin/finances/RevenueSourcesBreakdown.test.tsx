import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/finances/finance-reports-pdf-exporter', () => ({ exportFinanceSummaryPdf: vi.fn() }))

import { RevenueSourcesBreakdown } from '@/components/admin/finances/FinanceSummary'
import { groupFinanceWarnings } from '../../../../mobile/src/lib/finance-model'
import { reconciliationGuidance } from '@/lib/finance/reconciliation-guidance'

const breakdown = {
  merchandise: 600,
  services: 400,
  repairs: { total: 500, labor: 200, parts: 300, count: 2 },
  orders: 0,
  refunds: 50,
  grossRevenue: 1_500,
}

describe('¿De dónde vienen los ingresos?', () => {
  it('muestra cada fuente con su parte y abre las reparaciones en mano de obra y repuestos', () => {
    render(<RevenueSourcesBreakdown breakdown={breakdown} />)
    const repairs = screen.getByTestId('revenue-source-repairs')
    expect(within(repairs).getByText('Reparaciones')).toBeInTheDocument()
    expect(within(repairs).getByText('2 entregadas en el período')).toBeInTheDocument()
    expect(within(repairs).getByText('33%')).toBeInTheDocument()
    expect(within(repairs).getByText('Mano de obra')).toBeInTheDocument()
    expect(within(repairs).getByText('Repuestos y materiales')).toBeInTheDocument()
    expect(within(screen.getByTestId('revenue-source-services')).getByText('27%')).toBeInTheDocument()
    expect(screen.getByText(/Menos devoluciones del período/)).toBeInTheDocument()
    // Sin pedidos web en el período, esa fuente no aparece.
    expect(screen.queryByTestId('revenue-source-orders')).not.toBeInTheDocument()
  })
})

describe('aviso de reparación entregada sin precio', () => {
  it('tiene guía en la web y título claro en la app', () => {
    expect(reconciliationGuidance('MISSING_REPAIR_PRICE')).toMatch(/cargá el precio/)
    const [group] = groupFinanceWarnings([
      { code: 'MISSING_REPAIR_PRICE', message: 'x', sourceType: 'repair' },
      { code: 'MISSING_REPAIR_PRICE', message: 'x', sourceType: 'repair' },
    ])
    expect(group.title).toBe('2 reparaciones entregadas sin precio')
  })
})
