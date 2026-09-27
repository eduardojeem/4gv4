import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { FinanceSummaryReport } from '@/lib/finance/server'
import { getAdminFinancesKey } from '@/hooks/use-admin-finances'
import { FinanceFilters } from './FinanceFilters'

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

import { FinancesSystem } from './FinancesSystem'

describe('FinancesSystem', () => {
  it('provides collapsed section-specific help and examples in every tab', async () => {
    mockUseAdminFinances.mockReturnValue({ summary, filters: summary.filters, isLoading: false, refresh: vi.fn() })
    render(<FinancesSystem />)
    const user = userEvent.setup()
    for (const name of ['Resumen', 'Gastos', 'Nómina', 'Rentabilidad', 'Configuración']) {
      await user.click(screen.getByRole('tab', { name, exact: true }))
      const trigger = screen.getByText(`Cómo funciona esta sección: ${name}`)
      expect(trigger.closest('details')).not.toHaveAttribute('open')
      await user.click(trigger)
      expect(trigger.closest('details')).toHaveAttribute('open')
      expect(trigger.closest('details')).toHaveTextContent('Ejemplo en guaraníes')
      expect(trigger.closest('details')).toHaveTextContent('Gs.')
    }
  })

  it('offers concrete finance examples on demand', async () => {
    mockUseAdminFinances.mockReturnValue({ summary, filters: summary.filters, isLoading: false, refresh: vi.fn() })
    render(<FinancesSystem />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Cómo funciona/ }))
    expect(screen.getByRole('dialog', { name: /Cómo funciona Finanzas/ })).toBeInTheDocument()
    expect(screen.getByText(/Registrar un gasto no significa pagarlo/)).toBeInTheDocument()
  })

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
    expect(screen.getByText(/Tomá decisiones con una vista clara del negocio/)).toBeInTheDocument()
    expect(screen.getByText('Qué querés administrar')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Resumen' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Gastos' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Nómina' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Rentabilidad' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Configuración' })).toBeInTheDocument()
    expect(screen.getByText('Ganancia neta devengada')).toBeInTheDocument()
    // Las métricas de caja viven detrás de su propia solapa: acá alcanza con
    // que la vía de acceso esté presente.
    expect(screen.getByRole('tab', { name: 'Caja' })).toBeInTheDocument()
    expect(screen.getByText('Qué requiere atención hoy')).toBeInTheDocument()
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

  it('keeps a cost-only period out of the empty state', () => {
    mockUseAdminFinances.mockReturnValue({
      summary: {
        ...summary,
        accrued: {
          ...summary.accrued,
          revenue: 0,
          directCosts: 50_000,
          grossProfit: -50_000,
          operatingExpenses: 0,
          payrollCost: 0,
          netProfit: -50_000,
        },
        cash: { collected: 0, paid: 0, netCashFlow: 0 },
        coverageWarnings: [],
        upcomingDue: [],
        overdue: [],
      },
      filters: summary.filters,
      setFilters: vi.fn(),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<FinancesSystem />)

    expect(screen.queryByText('Todavía no hay movimientos financieros')).not.toBeInTheDocument()
    expect(screen.getByText('Ganancia neta devengada')).toBeInTheDocument()
  })

  it('marks cached figures as stale and exposes a retry when the refresh fails', () => {
    mockUseAdminFinances.mockReturnValue({
      summary,
      filters: summary.filters,
      setFilters: vi.fn(),
      isLoading: false,
      error: new Error('No disponible'),
      refresh: vi.fn(),
    })

    render(<FinancesSystem />)

    expect(screen.getByText(/Mostrando datos del 12\/08\/2026/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar datos' })).toBeInTheDocument()
  })

  it('groups repeated coverage messages into one clear warning', () => {
    mockUseAdminFinances.mockReturnValue({
      summary: {
        ...summary,
        coverageWarnings: [
          { code: 'MISSING_DIRECT_COST', message: 'El ingreso no tiene un costo directo registrado.', sourceId: 'sale-a' },
          { code: 'MISSING_DIRECT_COST', message: 'El ingreso no tiene un costo directo registrado.', sourceId: 'sale-b' },
        ],
      },
      filters: summary.filters,
      setFilters: vi.fn(),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<FinancesSystem />)

    expect(screen.getAllByText('El ingreso no tiene un costo directo registrado.')).toHaveLength(1)
  })

  // Agrupar no puede significar esconder: el aviso decia que faltaba algo pero
  // no cual registro, y no habia forma de saber que ir a completar.
  it('names the records behind a grouped coverage warning', () => {
    mockUseAdminFinances.mockReturnValue({
      summary: {
        ...summary,
        coverageWarnings: [
          {
            code: 'MISSING_DIRECT_COST',
            message: 'El ingreso no tiene un costo directo registrado.',
            sourceId: 'sale-a',
            sourceLabel: 'Venta V-0012',
          },
          {
            code: 'MISSING_DIRECT_COST',
            message: 'El ingreso no tiene un costo directo registrado.',
            sourceId: 'rep-b',
            sourceLabel: 'Reparación REP-77',
          },
        ],
      },
      filters: summary.filters,
      setFilters: vi.fn(),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<FinancesSystem />)

    expect(screen.getByText(/2 registros/)).toBeInTheDocument()
    expect(screen.getByText(/Venta V-0012/)).toBeInTheDocument()
    expect(screen.getByText(/Reparación REP-77/)).toBeInTheDocument()
  })

  it('switches between devengado and caja metrics with accessible tabs', async () => {
    const user = userEvent.setup()
    mockUseAdminFinances.mockReturnValue({
      summary,
      filters: summary.filters,
      setFilters: vi.fn(),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<FinancesSystem />)

    expect(screen.getByRole('tab', { name: 'Devengado' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText('Resultado devengado')).toBeInTheDocument()
    expect(screen.queryByText('Flujo de caja')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Caja' }))

    expect(screen.getByRole('tab', { name: 'Caja' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText('Flujo de caja')).toBeInTheDocument()
    expect(screen.getByText('Flujo de caja neto')).toBeInTheDocument()
    expect(screen.queryByText('Resultado devengado')).not.toBeInTheDocument()
  })

  it('keys summary cache entries by active organization', () => {
    expect(getAdminFinancesKey(summary.filters, 'organization-a')).toContain('organizationId=organization-a')
    expect(getAdminFinancesKey(summary.filters, 'organization-b')).not.toBe(
      getAdminFinancesKey(summary.filters, 'organization-a'),
    )
  })

  it('offers a quick range for the current month', async () => {
    const user = userEvent.setup()
    const onDateRangeChange = vi.fn()

    render(<FinanceFilters filters={summary.filters} isRefreshing={false} onDateRangeChange={onDateRangeChange} onRefresh={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Este mes' }))
    expect(onDateRangeChange).toHaveBeenCalledWith(expect.objectContaining({ from: expect.any(Date), to: expect.any(Date) }))
  })
})
