import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { FinancialDashboard, type FinancialData } from './FinancialDashboard'

const base: FinancialData = {
  mrr: 400_000,
  arr: 4_800_000,
  billingSubscriptions: 2,
  unpricedSubscriptions: 0,
  potentialMrr: 200_000,
  churnedMrr: 0,
  churnRate: 0,
  collectedLast30: [{ amount: 350_000, currency: 'PYG' }],
  costs: { recurringMonthlyCost: 150_000, netMonthly: 250_000, marginPercent: 62.5 },
  counts: { trialing: 1, pastDue: 1, cancelingSoon: 0, renewalsSoon: 0, newLast30: 3, growthPercent: 50 },
  subsByPlan: [{ tier: 'PRO', planName: 'Pro', active: 2, trialing: 1, mrr: 400_000 }],
}

describe('Resumen de facturación', () => {
  it('pone ingresos, costos y resultado juntos, y manda el detalle a su sección', () => {
    render(<FinancialDashboard data={base} />)

    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeInTheDocument()
    expect(screen.getByText('Margen 62,5% sobre el MRR')).toBeInTheDocument()
    expect(screen.getByText('Costo mensual').closest('a')).toHaveAttribute('href', '/superadmin/finanzas')
    expect(screen.getByText('Cobrado (30 días)').closest('a')).toHaveAttribute('href', '/superadmin/invoices')
  })

  it('las alertas llevan a la lista de suscripciones ya filtrada', () => {
    render(<FinancialDashboard data={base} />)

    expect(screen.getByText('1 con pago vencido').closest('a')).toHaveAttribute('href', '/superadmin/subscriptions?tab=attention')
    expect(screen.getByText('1 en período de prueba').closest('a')).toHaveAttribute('href', '/superadmin/subscriptions?tab=trials')
  })

  it('avisa cuando el MRR está incompleto por planes sin precio', () => {
    render(<FinancialDashboard data={{ ...base, unpricedSubscriptions: 2 }} />)

    expect(screen.getByText('Incompleto: 2 con plan sin precio')).toBeInTheDocument()
    expect(screen.getByText('2 suscripciones con plan sin precio').closest('a')).toHaveAttribute('href', '/superadmin/plans')
  })

  it('sin tabla de gastos no inventa costo ni resultado', () => {
    render(<FinancialDashboard data={{ ...base, costs: null }} />)

    expect(screen.getByText('Sin datos de gastos todavía')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})
