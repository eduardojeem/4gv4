import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { FinanceSummaryReport } from '@/lib/finance/server'

const mockUseAdminFinances = vi.fn()
const setDateRange = vi.fn()
const refresh = vi.fn()

vi.mock('@/hooks/use-admin-finances', () => ({
  useAdminFinances: () => mockUseAdminFinances(),
}))

import { FinanceSnapshot } from './FinanceSnapshot'

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
  complete: true,
  coverageWarnings: [],
  generatedAt: '2026-08-16T12:00:00.000Z',
  filters: { startDate: '2026-08-01', endDate: '2026-08-31', branchId: null },
  comparison: {
    accrued: {
      revenue: 800_000,
      directCosts: 200_000,
      grossProfit: 600_000,
      operatingExpenses: 100_000,
      payrollCost: 175_000,
      netProfit: 325_000,
    },
    cash: { collected: 700_000, paid: 250_000, netCashFlow: 450_000 },
    complete: true,
    coverageWarnings: [],
  },
  upcomingDue: [],
  overdue: [],
}

const baseState = {
  summary,
  filters: summary.filters,
  setDateRange,
  isLoading: false,
  isRefreshing: false,
  error: null,
  refresh,
  organizationId: 'org-1',
}

describe('FinanceSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAdminFinances.mockReturnValue(baseState)
  })

  it('shows the organization figures for the selected period', () => {
    render(<FinanceSnapshot />)

    expect(screen.getByText('Finanzas de la organización')).toBeInTheDocument()
    expect(screen.getByText('Ingresos')).toBeInTheDocument()
    expect(screen.getByText('Ganancia neta')).toBeInTheDocument()
    expect(screen.getByText('Cobrado')).toBeInTheDocument()
    expect(screen.getByText('Flujo de caja neto')).toBeInTheDocument()
  })

  it('offers day, week, month and year presets with the month active by default', () => {
    render(<FinanceSnapshot />)

    for (const label of ['Hoy', 'Semana', 'Mes', 'Año']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Mes' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('requests a single-day range when the day preset is chosen', async () => {
    const user = userEvent.setup()
    render(<FinanceSnapshot />)
    setDateRange.mockClear()

    await user.click(screen.getByRole('button', { name: 'Hoy' }))

    await waitFor(() => expect(setDateRange).toHaveBeenCalledTimes(1))
    const range = setDateRange.mock.calls[0][0] as { from: Date; to: Date }
    expect(range.from.toDateString()).toBe(range.to.toDateString())
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('compares each figure against the previous period', () => {
    render(<FinanceSnapshot />)

    // Ingresos: 1.000.000 contra 800.000 del período anterior.
    expect(screen.getAllByText('25.0%').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/vs período anterior/).length).toBe(4)
  })

  it('does not invent a percentage when the previous period is zero', () => {
    mockUseAdminFinances.mockReturnValue({
      ...baseState,
      summary: {
        ...summary,
        comparison: {
          ...summary.comparison,
          accrued: { ...summary.comparison.accrued, revenue: 0 },
        },
      },
    })

    render(<FinanceSnapshot />)

    expect(screen.getAllByText('Sin base de comparación').length).toBe(1)
  })

  it('flags provisional profit and overdue obligations', () => {
    mockUseAdminFinances.mockReturnValue({
      ...baseState,
      summary: {
        ...summary,
        complete: false,
        overdue: [{ id: 'rent', dueDate: '2026-08-10', amount: 90_000 }],
      },
    })

    render(<FinanceSnapshot />)

    expect(screen.getByText('Faltan costos: la ganancia es provisoria')).toBeInTheDocument()
    expect(screen.getByText('1 obligación vencida')).toBeInTheDocument()
  })

  it('offers a retry when the summary cannot be loaded', async () => {
    const user = userEvent.setup()
    mockUseAdminFinances.mockReturnValue({
      ...baseState,
      summary: null,
      error: new Error('No disponible'),
    })

    render(<FinanceSnapshot />)

    expect(screen.getByRole('alert')).toHaveTextContent('No disponible')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(refresh).toHaveBeenCalled()
  })
})
