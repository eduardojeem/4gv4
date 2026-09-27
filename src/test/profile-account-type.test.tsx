import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProfileAccountTypeBanner } from '@/components/profile/profile-account-type-banner'
import { ProfileQuickActions } from '@/components/profile/profile-quick-actions'
import { ProfileStats } from '@/components/profile/profile-stats'

describe('ProfileAccountTypeBanner', () => {
  it('diferencia y muestra el perfil de empresa con acceso a su dashboard y tienda', () => {
    const mockOrg = {
      id: 'org-1',
      name: 'MegaTech Store & Lab',
      slug: 'megatech',
      role: 'owner',
      plan: 'PRO',
      logoUrl: null,
    }

    render(
      <ProfileAccountTypeBanner
        organization={mockOrg}
        userRole="admin"
      />
    )

    expect(screen.getByText(/Cuenta comercial/i)).toBeInTheDocument()
    expect(screen.getByText('MegaTech Store & Lab')).toBeInTheDocument()
    expect(screen.getByText(/Plan PRO/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Administrar tienda/i })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: /Ver Mi Tienda/i })).toHaveAttribute('href', '/megatech/inicio')
  })

  it('diferencia y muestra el perfil de cliente comprador con invitación al SaaS', () => {
    render(
      <ProfileAccountTypeBanner
        organization={null}
        userRole="cliente"
      />
    )

    expect(screen.getByText(/Cuenta personal/i)).toBeInTheDocument()
    expect(screen.getByText(/Tus compras y servicios, en un solo perfil/i)).toBeInTheDocument()
    expect(screen.getByText(/¿Tenés un negocio o taller\?/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Conocer SaaS/i })).toHaveAttribute('href', '/saas')
  })
})

describe('ProfileQuickActions autorizaciones por tienda', () => {
  it('no muestra personas autorizadas en el perfil global del marketplace', () => {
    render(<ProfileQuickActions role="cliente" tenantPrefix="/marketplace" variant="marketplace" showAuthorizedPersons={false} />)
    expect(screen.queryByText('Personas autorizadas')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Rastrear equipo/i })).toHaveAttribute('href', '/marketplace/mis-reparaciones')
    expect(screen.getByRole('link', { name: /Créditos y cuotas/i })).toHaveAttribute('href', '#tiendas')
  })

  it('mantiene el acceso dentro del perfil de una tienda', () => {
    render(<ProfileQuickActions role="cliente" tenantPrefix="/tienda-demo" variant="marketplace" showAuthorizedPersons />)
    expect(screen.getByRole('link', { name: /Personas autorizadas/i })).toHaveAttribute('href', '/tienda-demo/perfil/autorizados')
  })

  it('presenta los accesos del marketplace como una navegacion compacta', () => {
    render(<ProfileQuickActions role="cliente" tenantPrefix="/marketplace" variant="marketplace" showAuthorizedPersons={false} />)

    expect(screen.getByRole('navigation', { name: /Accesos de mi actividad/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Favoritos/i })).toHaveAttribute('href', '#favoritos')
    expect(screen.getByRole('link', { name: /Carritos/i })).toHaveAttribute('href', '#carritos')
    expect(screen.queryByText('Productos guardados')).not.toBeInTheDocument()
  })
})

describe('ProfileStats', () => {
  it('en modo compacto prioriza actividad vigente y evita repetir historicos', () => {
    render(
      <ProfileStats
        totalRepairs={12}
        activeRepairs={2}
        readyRepairs={1}
        deliveredRepairs={9}
        totalOrders={4}
        variant="activity"
      />
    )

    expect(screen.getByText('En proceso')).toBeInTheDocument()
    expect(screen.getByText('Listos para retirar')).toBeInTheDocument()
    expect(screen.getByText('Pedidos')).toBeInTheDocument()
    expect(screen.queryByText('Total reparaciones')).not.toBeInTheDocument()
    expect(screen.queryByText('Entregados')).not.toBeInTheDocument()
  })
})
