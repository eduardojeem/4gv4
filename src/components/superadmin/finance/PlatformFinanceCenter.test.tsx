import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/app/superadmin/finanzas/actions', () => ({
  createExpenseAction: vi.fn(),
  updateExpenseAction: vi.fn(),
  deleteExpenseAction: vi.fn(),
}))

import { PlatformFinanceCenter } from './PlatformFinanceCenter'
import { summarizePlatformFinance, type PlatformExpense } from '@/lib/superadmin/platform-finance'

const HOY = '2026-09-15'
const vercel: PlatformExpense = {
  id: '00000000-0000-4000-8000-000000000001',
  provider: 'Vercel',
  category: 'infraestructura',
  description: null,
  amount: 20,
  currency: 'USD',
  fxRatePyg: 7500,
  recurrence: 'monthly',
  startsOn: '2026-01-01',
  endsOn: null,
  isActive: true,
}

describe('PlatformFinanceCenter', () => {
  it('muestra costos y punto de equilibrio, y deja el resultado al Resumen', () => {
    const summary = summarizePlatformFinance([vercel], { mrr: 400_000, payingOrgs: 2 }, HOY)
    render(<PlatformFinanceCenter expenses={[vercel]} summary={summary} today={HOY} unavailableReason={null} />)

    expect(screen.getByRole('heading', { name: 'Gastos' })).toBeInTheDocument()
    expect(screen.queryByText('Resultado mensual')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resumen' })).toHaveAttribute('href', '/superadmin/billing')
    expect(screen.getByText('1 tiendas')).toBeInTheDocument()
    expect(screen.getByText('Cubierto: tenés 2')).toBeInTheDocument()
    expect(screen.getAllByText('Vercel').length).toBeGreaterThan(0)
    expect(screen.getByText('Vigente')).toBeInTheDocument()
  })

  it('sin la migración aplicada avisa y no deja registrar gastos', () => {
    const summary = summarizePlatformFinance([], { mrr: 0, payingOrgs: 0 }, HOY)
    render(
      <PlatformFinanceCenter
        expenses={[]}
        summary={summary}
        today={HOY}
        unavailableReason="Falta la tabla de gastos: aplicar supabase/migrations/20260929230000_platform_expenses.sql en Supabase."
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Falta la tabla de gastos')
    expect(screen.getByRole('button', { name: /Registrar gasto/ })).toBeDisabled()
    expect(screen.getByText(/Todavía no hay gastos/)).toBeInTheDocument()
  })

  it('permite alternar entre pestañas y ver el catálogo de herramientas y planes', async () => {
    const summary = summarizePlatformFinance([vercel], { mrr: 400_000, payingOrgs: 2 }, HOY)
    const mockPlans = [
      {
        id: 'plan-pro',
        tier: 'pro',
        name: 'Pro Max',
        price: 250_000,
        description: 'Para empresas consolidadas',
        isActive: true,
        isPopular: true,
        features: [],
        subscribersCount: 5,
        activeCount: 4,
        monthlyRevenue: 1_000_000,
        includedFeaturesCount: 15,
        includedFeatureKeys: ['pos', 'ecommerce', 'inventory', 'repairs', 'services'],
      },
    ]

    render(
      <PlatformFinanceCenter
        expenses={[vercel]}
        summary={summary}
        today={HOY}
        unavailableReason={null}
        plans={mockPlans}
      />,
    )

    // Pestañas visibles
    expect(screen.getByRole('tab', { name: /Gastos y Rentabilidad/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Planes y Cobertura/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Herramientas/i })).toBeInTheDocument()

    // Selector de plan presente
    expect(screen.getByText('Inspección de Plan')).toBeInTheDocument()
  })
})
