import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ReportsCreditsTab } from './ReportsCreditsTab'

describe('ReportsCreditsTab', () => {
  it('separates period movement from the current portfolio', () => {
    render(
      <ReportsCreditsTab
        loading={false}
        error={null}
        report={{
          period: {
            grantedCount: 2,
            principalGranted: 300_000,
            financedTotal: 330_000,
            scheduledInterest: 30_000,
            paymentsReceived: 80_000,
            averageInterestRate: 10,
          },
          portfolio: {
            activeCredits: 3,
            outstandingAmount: 250_000,
            overdueAmount: 50_000,
            overdueInstallments: 1,
            overdueCustomers: 1,
            dueSoonAmount: 100_000,
            collectionRate: 40,
          },
          paymentTrend: [{ date: '2026-08-20', amount: 80_000 }],
          statusDistribution: [
            { status: 'active', count: 2 },
            { status: 'overdue', count: 1 },
          ],
        }}
      />,
    )

    expect(screen.getByText('Movimiento del período')).toBeInTheDocument()
    expect(screen.getByText('Cartera actual')).toBeInTheDocument()
    expect(screen.getByText('Gs. 300.000')).toBeInTheDocument()
    expect(screen.getByText('Gs. 250.000')).toBeInTheDocument()
    expect(screen.getByText('1 cuota vencida · 1 cliente')).toBeInTheDocument()
  })

  it('shows a useful empty state', () => {
    render(<ReportsCreditsTab loading={false} error={null} report={null} />)
    expect(screen.getByText('No hay créditos para analizar')).toBeInTheDocument()
  })
})
