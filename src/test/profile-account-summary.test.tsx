import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProfileAccountSummary } from '@/components/profile/profile-account-summary'

describe('ProfileAccountSummary', () => {
  it('renders the net position, payment breakdown and tenant links', () => {
    render(
      <ProfileAccountSummary
        tenantPrefix="/4g-celulares"
        summary={{
          equipment: { total: 4, active: 1, ready: 1, delivered: 2 },
          repairs: { pendingCount: 1, paidCount: 2, pendingAmount: 100_000 },
          orders: { pendingCount: 1, paidCount: 3, pendingAmount: 50_000 },
          financing: { pendingAmount: 200_000, overdueAmount: 80_000, overdueCount: 1 },
          storeCredit: 25_000,
          totalDue: 350_000,
          netBalance: -325_000,
        }}
      />
    )

    expect(screen.getByText('Saldo neto por pagar')).toBeInTheDocument()
    expect(screen.getByText('1 cuota vencida')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver reparaciones/i })).toHaveAttribute(
      'href',
      '/4g-celulares/mis-reparaciones'
    )
    expect(screen.getByRole('link', { name: /Ver créditos y cuotas/i })).toHaveAttribute(
      'href',
      '/4g-celulares/perfil/creditos'
    )
  })
})
