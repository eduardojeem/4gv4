import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { FinanceSummaryReport } from '@/lib/finance/server'

const summary: FinanceSummaryReport = {
  accrued: {
    revenue: 1_000_000,
    directCosts: 250_000,
    grossProfit: 750_000,
    operatingExpenses: 125_000,
    payrollCost: 200_000,
    netProfit: 425_000,
  },
  cash: { collected: 800_000, paid: 225_000, netCashFlow: 575_000 },
  complete: false,
  coverageWarnings: [{ code: 'MISSING_DIRECT_COST', message: 'Faltan costos de compra.' }],
  generatedAt: '2026-08-12T12:00:00.000Z',
  filters: { startDate: '2026-08-01', endDate: '2026-08-12', branchId: null },
  comparison: {
    accrued: {
      revenue: 900_000,
      directCosts: 200_000,
      grossProfit: 700_000,
      operatingExpenses: 100_000,
      payrollCost: 175_000,
      netProfit: 425_000,
    },
    cash: { collected: 700_000, paid: 250_000, netCashFlow: 450_000 },
    complete: true,
    coverageWarnings: [],
  },
  upcomingDue: [{ id: 'rent', dueDate: '2026-08-15', amount: 200_000 }],
  overdue: [{ id: 'internet', dueDate: '2026-08-10', amount: 90_000 }],
}

const mockUseAdminFinances = vi.fn()

vi.mock('@/hooks/use-admin-finances', () => ({
  useAdminFinances: () => mockUseAdminFinances(),
}))

vi.mock('@/contexts/branch-context', () => ({
  useBranch: () => ({
    branches: [],
    selectedBranchId: null,
    selectedBranch: null,
    loading: false,
    setSelectedBranchId: vi.fn(),
  }),
}))

import { FinancesSystem } from './FinancesSystem'

describe('FinancesSystem', () => {
  it('renders the executive summary, finance tabs, and coverage alert', () => {
    mockUseAdminFinances.mockReturnValue({
      summary,
      filters: summary.filters,
      setFilters: vi.fn(),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<FinancesSystem />)

    expect(screen.getByRole('heading', { name: 'Finanzas' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Resumen' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Gastos' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Nómina' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Rentabilidad' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Configuración' })).toBeInTheDocument()
    expect(screen.getByText('Ganancia neta devengada')).toBeInTheDocument()
    expect(screen.getByText('Flujo de caja')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Faltan costos')
  })

  it('offers a retry action when the finance summary cannot be loaded', () => {
    mockUseAdminFinances.mockReturnValue({
      summary: null,
      filters: summary.filters,
      setFilters: vi.fn(),
      isLoading: false,
      error: new Error('No disponible'),
      refresh: vi.fn(),
    })

    render(<FinancesSystem />)

    expect(screen.getByRole('heading', { name: 'No pudimos cargar Finanzas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
