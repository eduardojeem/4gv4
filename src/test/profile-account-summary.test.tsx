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
    expect(screen.getByText(/Vencido:/i)).toHaveTextContent('Gs. 80.000')
    expect(screen.getByRole('link', { name: /Ver reparaciones/i })).toHaveAttribute(
      'href',
      '/4g-celulares/mis-reparaciones'
    )
    expect(screen.getByRole('link', { name: /Ver créditos y cuotas/i })).toHaveAttribute(
      'href',
      '/4g-celulares/perfil/creditos'
    )
  })

  const RESUMEN_VACIO = {
    equipment: { total: 0, active: 0, ready: 0, delivered: 0 },
    repairs: { pendingCount: 0, paidCount: 0, pendingAmount: 0 },
    orders: { pendingCount: 0, paidCount: 0, pendingAmount: 0 },
    financing: { pendingAmount: 0, overdueAmount: 0, overdueCount: 0 },
    storeCredit: 0,
    totalDue: 0,
    netBalance: 0,
  }

  // #tiendas solo existe en la pagina cuando hay mas de una tienda
  // (ProfileStores no se pinta con 0 o 1). El boton de creditos en
  // marketplace apuntaba ahi siempre, sin importar cuantas tiendas hubiera:
  // con una sola tienda el link no llevaba a ningun lado.
  it('en marketplace con una sola tienda va directo a sus creditos, no a #tiendas', () => {
    render(
      <ProfileAccountSummary
        tenantPrefix="/marketplace"
        summary={RESUMEN_VACIO}
        stores={[{
          organizationId: 'a',
          organization: { id: 'a', name: 'Tienda A', slug: 'tienda-a' },
          summary: RESUMEN_VACIO,
          needsAttention: false,
        }]}
      />
    )

    expect(screen.getByRole('link', { name: /Ver créditos y cuotas/i })).toHaveAttribute(
      'href',
      '/tienda-a/perfil/creditos'
    )
  })

  it('en marketplace con varias tiendas manda al selector #tiendas', () => {
    render(
      <ProfileAccountSummary
        tenantPrefix="/marketplace"
        summary={RESUMEN_VACIO}
        stores={[
          { organizationId: 'a', organization: { id: 'a', name: 'Tienda A', slug: 'tienda-a' }, summary: RESUMEN_VACIO, needsAttention: false },
          { organizationId: 'b', organization: { id: 'b', name: 'Tienda B', slug: 'tienda-b' }, summary: RESUMEN_VACIO, needsAttention: false },
        ]}
      />
    )

    expect(screen.getByRole('link', { name: /Elegir tienda para ver cuotas/i })).toHaveAttribute('href', '#tiendas')
  })

  it('en marketplace sin tiendas no ofrece un link roto', () => {
    render(<ProfileAccountSummary tenantPrefix="/marketplace" summary={RESUMEN_VACIO} stores={[]} />)

    expect(screen.queryByText(/creditos y cuotas/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/elegir tienda/i)).not.toBeInTheDocument()
  })
})
