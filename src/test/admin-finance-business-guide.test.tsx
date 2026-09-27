import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FinanceSummaryReport } from '@/lib/finance/server'
import { FinanceBusinessGuideModal } from '@/components/admin/finances/FinanceBusinessGuideModal'

const mockSummary: FinanceSummaryReport = {
  accrued: {
    revenue: 1_000_000,
    directCosts: 250_000,
    grossProfit: 750_000,
    operatingExpenses: 125_000,
    payrollCost: 200_000,
    netProfit: 425_000,
  },
  cash: { collected: 800_000, paid: 225_000, netCashFlow: 575_000 },
  complete: true,
  coverageWarnings: [],
  generatedAt: '2026-08-12T12:00:00.000Z',
  filters: { startDate: '2026-08-01', endDate: '2026-08-12', branchId: null },
  upcomingDue: [],
  overdue: [],
}

const mockUseAdminFinances = vi.fn()

vi.mock('@/hooks/use-admin-finances', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-admin-finances')>()
  return {
    ...actual,
    useAdminFinances: () => mockUseAdminFinances(),
  }
})

vi.mock('@/contexts/branch-context', () => ({
  useBranch: () => ({
    branches: [],
    selectedBranchId: null,
    selectedBranch: null,
    loading: false,
    setSelectedBranchId: vi.fn(),
  }),
}))

import { FinancesSystem } from '@/components/admin/finances/FinancesSystem'

describe('FinanceBusinessGuideModal standalone component', () => {
  it('renders all 5 core finance sections plus tips with business explanations and examples', async () => {
    const user = userEvent.setup()
    render(<FinanceBusinessGuideModal open={true} initialTab="resumen" />)

    expect(screen.getByRole('heading', { name: 'Manual Práctico de Gestión Financiera' })).toBeInTheDocument()
    expect(screen.getByText(/Manual Práctico de Gestión/i)).toBeInTheDocument()

    // 1. Resumen tab
    expect(screen.getByText(/Cómo administrar la sección Resumen/i)).toBeInTheDocument()
    expect(screen.getByText(/Rutina Diaria/i)).toBeInTheDocument()

    // 2. Gastos tab
    await user.click(screen.getByRole('tab', { name: /Gastos y Cuentas/i }))
    expect(screen.getByText(/Cómo administrar la sección Gastos y Cuentas por Pagar/i)).toBeInTheDocument()
    expect(screen.getByText(/Compra de Repuestos a Crédito/i)).toBeInTheDocument()

    // 3. Nómina tab
    await user.click(screen.getByRole('tab', { name: /Nómina y Sueldos/i }))
    expect(screen.getByText(/Cómo administrar la Nómina y Salarios/i)).toBeInTheDocument()
    expect(screen.getByText(/El Ciclo de Nómina en 4 Pasos/i)).toBeInTheDocument()
    expect(screen.getByText(/Liquidación de Técnico de Taller/i)).toBeInTheDocument()

    // 4. Rentabilidad tab
    await user.click(screen.getByRole('tab', { name: /^Rentabilidad$/i }))
    expect(screen.getByText(/Cómo administrar la sección Rentabilidad/i)).toBeInTheDocument()
    expect(screen.getByText(/Ejemplo: Reparación de Pantalla iPhone 13/i)).toBeInTheDocument()

    // 5. Configuración tab
    await user.click(screen.getByRole('tab', { name: /^Configuración$/i }))
    expect(screen.getByText(/Cómo administrar la sección Configuración/i)).toBeInTheDocument()
    expect(screen.getByText(/Personal y Sueldos Base/i)).toBeInTheDocument()
    expect(screen.getByText(/Creación de Reglas de Comisión/i)).toBeInTheDocument()

    // 6. Tips tab
    await user.click(screen.getByRole('tab', { name: /Tips y Errores/i }))
    expect(screen.getByText(/Los 5 Tips de Oro para una Administración Financiera Exitosa/i)).toBeInTheDocument()
    expect(screen.getByText(/Solución a Errores Comunes/i)).toBeInTheDocument()
  })

  it('opens directly to the specified initialTab', () => {
    render(<FinanceBusinessGuideModal open={true} initialTab="gastos" />)
    expect(screen.getByText(/Cómo administrar la sección Gastos y Cuentas por Pagar/i)).toBeInTheDocument()
  })
})

describe('FinancesSystem integration with business guide across all sections', () => {
  it('offers Guía de Administración button in header and opens modal', async () => {
    mockUseAdminFinances.mockReturnValue({
      summary: mockSummary,
      filters: mockSummary.filters,
      isLoading: false,
      refresh: vi.fn(),
    })

    const user = userEvent.setup()
    render(<FinancesSystem />)

    const guideButton = screen.getByRole('button', { name: /Guía de Administración/i })
    expect(guideButton).toBeInTheDocument()

    await user.click(guideButton)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Manual Práctico de Gestión Financiera' })).toBeInTheDocument()
  })

  it('allows opening the business guide from FinanceSummary quick actions', async () => {
    mockUseAdminFinances.mockReturnValue({
      summary: mockSummary,
      filters: mockSummary.filters,
      isLoading: false,
      refresh: vi.fn(),
    })

    const user = userEvent.setup()
    render(<FinancesSystem />)

    const guideSummaryBtn = screen.getByRole('button', { name: /Guía de Gestión/i })
    expect(guideSummaryBtn).toBeInTheDocument()

    await user.click(guideSummaryBtn)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Manual Práctico de Gestión Financiera' })).toBeInTheDocument()
  })

  it('allows opening detailed section guide from FinanceSectionHelp in any active tab', async () => {
    mockUseAdminFinances.mockReturnValue({
      summary: mockSummary,
      filters: mockSummary.filters,
      isLoading: false,
      refresh: vi.fn(),
    })

    const user = userEvent.setup()
    render(<FinancesSystem />)

    // Open section help in Resumen
    const trigger = screen.getByText(/Cómo funciona esta sección: Resumen/i)
    await user.click(trigger)

    const sectionLink = screen.getByRole('button', { name: /Ver Guía Detallada de Resumen/i })
    expect(sectionLink).toBeInTheDocument()

    await user.click(sectionLink)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Cómo administrar la sección Resumen/i)).toBeInTheDocument()
  })
})
