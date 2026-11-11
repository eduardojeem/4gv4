import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminHome from './page'

const state = vi.hoisted(() => ({
  modules: ['analytics', 'pos', 'inventory_admin', 'finances', 'repairs'], admin: true,
  allowed: [] as string[], loading: false, error: null as string | null,
  metrics: { todaySalesTotal: 45000 as number | null, todaySalesCount: 1 as number | null,
    openCashRegisters: 1 as number | null, cashAlertsCount: 0 as number | null,
    lowStockCount: 0 as number | null, activeUsersCount: 2 as number | null },
  refresh: vi.fn(), repairError: null as Error | null,
}))
vi.mock('@/contexts/RepairsContext', () => ({ useRepairs: () => ({ repairs: [], isLoading: false, error: state.repairError, refreshRepairs: state.refresh }) }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: { profile: { name: 'Ana' } }, isAdmin: state.admin, isSuperAdmin: false, hasPermission: (p: string) => state.allowed.includes(p) }) }))
vi.mock('@/contexts/branch-context', () => ({ useBranch: () => ({ selectedBranchId: 'branch-1', selectedBranch: { name: 'Centro' } }) }))
vi.mock('@/contexts/SubscriptionStatusContext', () => ({ useSubscriptionStatus: () => ({ effectiveModules: state.modules }) }))
vi.mock('@/hooks/use-admin-overview-metrics', () => ({ useAdminOverviewMetrics: () => ({ metrics: state.metrics, loading: state.loading, error: state.error, errors: {}, updatedAt: new Date(), refresh: state.refresh }) }))
vi.mock('@/hooks/use-admin-nav-badges', () => ({ useAdminNavBadges: () => ({}) }))
vi.mock('@/components/admin/finances/FinanceSnapshot', () => ({ FinanceSnapshot: () => <div>Resumen financiero</div> }))
vi.mock('@/components/dashboard/sales-chart', () => ({ SalesChart: () => <div>Gráfico de ventas</div> }))
vi.mock('@/components/dashboard/repairs-chart', () => ({ RepairsChart: () => <div>Gráfico de reparaciones</div> }))

describe('admin overview user experience', () => {
  beforeEach(() => {
    state.modules = ['analytics', 'pos', 'inventory_admin', 'finances', 'repairs']; state.admin = true; state.allowed = []
    state.loading = false; state.error = null; state.repairError = null; state.refresh.mockClear()
    state.metrics = { todaySalesTotal: 45000, todaySalesCount: 1, openCashRegisters: 1, cashAlertsCount: 0, lowStockCount: 0, activeUsersCount: 2 }
  })
  it('shows unavailable instead of zero and offers a retry after a failed query', () => {
    state.error = 'Algunos indicadores no están disponibles.'; state.metrics.lowStockCount = null
    render(<AdminHome />)
    expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Sin alertas en los indicadores consultados/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar indicadores' }))
    expect(state.refresh).toHaveBeenCalled()
  })
  it('does not claim there are no alerts while the queries are loading', () => {
    state.loading = true
    render(<AdminHome />)
    expect(screen.queryByText(/Sin alertas en los indicadores consultados/)).not.toBeInTheDocument()
  })
  it('hides card links for modules outside the plan', () => {
    state.modules = []
    render(<AdminHome />)
    expect(document.querySelector('a[href="/admin/analytics"]')).toBeNull()
    expect(document.querySelector('a[href="/admin/inventory"]')).toBeNull()
    expect(document.querySelector('a[href="/admin/cash-monitor"]')).toBeNull()
    expect(document.querySelector('a[href="/admin/finances"]')).toBeNull()
  })
  it('applies the same permissions to quick links as to the navigation', () => {
    state.admin = false
    render(<AdminHome />)
    expect(document.querySelector('a[href="/admin/users"]')).toBeNull()
    expect(document.querySelector('a[href="/admin/settings"]')).toBeNull()
  })
  it('keeps an explicit scope and readable activity heading', () => {
    render(<AdminHome />)
    expect(screen.getByRole('heading', { name: 'Actividad de hoy' })).toBeInTheDocument()
    expect(screen.getAllByText(/Centro/).length).toBeGreaterThan(0)
  })
})