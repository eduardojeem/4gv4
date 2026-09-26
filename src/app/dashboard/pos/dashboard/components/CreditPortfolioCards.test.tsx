import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CreditPortfolioCards } from './CreditPortfolioCards'
import type { CreditPortfolioState } from '../hooks/useCreditPortfolio'
import type { CreditReport } from '@/lib/reports/credit-report'

const reporte = (over: { portfolio?: Partial<CreditReport['portfolio']>; period?: Partial<CreditReport['period']> } = {}): CreditReport => ({
  period: {
    grantedCount: 4,
    principalGranted: 2_000_000,
    financedTotal: 2_300_000,
    scheduledInterest: 300_000,
    paymentsReceived: 450_000,
    averageInterestRate: 10,
    ...over.period,
  },
  portfolio: {
    activeCredits: 12,
    outstandingAmount: 5_400_000,
    overdueAmount: 700_000,
    overdueInstallments: 3,
    overdueCustomers: 2,
    dueSoonAmount: 900_000,
    collectionRate: 57.6,
    ...over.portfolio,
  },
  paymentTrend: [],
  statusDistribution: [],
})

const pintar = (
  state: CreditPortfolioState,
  repairCredits: { totalAmount: number; count: number; pendingAmount: number } | null = null,
  refetch = vi.fn(async () => {})
) => {
  render(<CreditPortfolioCards portfolio={{ state, refetch }} repairCredits={repairCredits} />)
  return refetch
}

describe('la cartera de créditos', () => {
  it('muestra saldo, mora, próximo a vencer y cobranza', () => {
    pintar({ status: 'ready', report: reporte() })
    expect(screen.getByText('Saldo por cobrar')).toBeInTheDocument()
    expect(screen.getByText('12 créditos con saldo')).toBeInTheDocument()
    expect(screen.getByText('3 cuotas de 2 clientes')).toBeInTheDocument()
    expect(screen.getByText('Vence en 30 días')).toBeInTheDocument()
    expect(screen.getByText('58%')).toBeInTheDocument()
  })

  it('separa lo del período de lo de toda la cartera', () => {
    pintar({ status: 'ready', report: reporte() })
    expect(screen.getByText('Otorgados en el período')).toBeInTheDocument()
    expect(screen.getByText('Cobrado en el período')).toBeInTheDocument()
    expect(screen.getByText(/al día de hoy/)).toBeInTheDocument()
  })

  it('sin cuotas vencidas lo dice en vez de mostrar un cero sin contexto', () => {
    pintar({ status: 'ready', report: reporte({ portfolio: { overdueAmount: 0, overdueInstallments: 0, overdueCustomers: 0 } }) })
    expect(screen.getByText('Ninguna cuota vencida')).toBeInTheDocument()
  })

  it('una organización sin créditos no ve una grilla de ceros', () => {
    pintar({
      status: 'ready',
      report: reporte({
        portfolio: { activeCredits: 0, outstandingAmount: 0 },
        period: { grantedCount: 0, paymentsReceived: 0 },
      }),
    })
    expect(screen.getByText(/no tiene créditos con saldo ni movimientos/)).toBeInTheDocument()
    expect(screen.queryByText('Saldo por cobrar')).not.toBeInTheDocument()
  })

  it('un error se dice y se puede reintentar, sin mostrar ceros', async () => {
    const refetch = pintar({ status: 'error', message: 'No se pudo cargar la cartera de créditos.' })
    expect(screen.getByText('No se pudo cargar la cartera de créditos.')).toBeInTheDocument()
    expect(screen.queryByText('Saldo por cobrar')).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /Reintentar/ }))
    expect(refetch).toHaveBeenCalled()
  })

  it('mientras carga lo avisa', () => {
    pintar({ status: 'loading' })
    expect(screen.getByText(/Cargando cartera de créditos/)).toBeInTheDocument()
  })

  it('menciona los créditos de taller solo si hay taller y hubo alguno', () => {
    pintar({ status: 'ready', report: reporte() }, { totalAmount: 750_000, count: 1, pendingAmount: 300_000 })
    expect(screen.getByText(/1 crédito por reparaciones/)).toBeInTheDocument()
  })

  it('sin taller no los menciona', () => {
    pintar({ status: 'ready', report: reporte() }, null)
    expect(screen.queryByText(/por reparaciones/)).not.toBeInTheDocument()
  })
})
