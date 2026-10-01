import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrganizationsDashboard, type SuperAdminOrganization } from '@/components/superadmin/organizations/organizations-dashboard'
import { planLabel } from '@/lib/superadmin/plan-names'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/superadmin/organizations',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/superadmin/EnterSupportButton', () => ({ EnterSupportButton: () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const AHORA = '2026-10-01T12:00:00.000Z'

const org = (over: Partial<SuperAdminOrganization>): SuperAdminOrganization => ({
  id: 'org-1', name: 'HCA Celular', slug: 'hca-celular', plan: 'BASIC', logo_url: null,
  owner_id: 'owner-1', owner_name: 'Hugo', owner_email: 'dueno@hca.com.py',
  created_at: '2025-02-14T10:00:00Z', updated_at: null,
  subscription_status: 'active', payment_status: 'paid', subscription_provider: null,
  trial_ends_at: null, current_period_ends_at: '2026-11-10T00:00:00Z', cancel_at_period_end: false,
  members_total: 4, members_active: 4, members_invited: 0, members_suspended: 0,
  staff_total: 3, staff_active: 2, staff_invited: 1, staff_suspended: 0, customers_total: 12,
  business_vertical: 'electronics', operating_model: 'retail', enabled_modules: ['pos'],
  last_access_known: true, last_access_at: AHORA, last_sale_at: AHORA, products_total: 10,
  ...over,
})

const planNames = { FREE: 'Gratis', BASIC: 'Pro', PRO: 'Pro Max', ENTERPRISE: 'ULTRA' }

describe('directorio de organizaciones', () => {
  it('buscar una sola organización no reemplaza la lista por otra ficha', () => {
    render(
      <OrganizationsDashboard
        organizations={[org({}), org({ id: 'org-2', name: 'Moda Sur', slug: 'moda-sur', plan: 'FREE' })]}
        referenceTime={AHORA}
        planNames={planNames}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('Buscar empresa, slug, owner...'), { target: { value: 'moda' } })
    expect(screen.queryByText(/Mostrando Ficha de Organización Seleccionada/)).not.toBeInTheDocument()
    // El nombre abre la ficha real de la organización.
    const link = screen.getAllByRole('link', { name: 'Moda Sur' })[0]
    expect(link).toHaveAttribute('href', '/superadmin/organizations/moda-sur')
  })

  it('muestra el nombre comercial del plan, no el código', () => {
    render(<OrganizationsDashboard organizations={[org({})]} referenceTime={AHORA} planNames={planNames} />)
    expect(screen.getAllByText('Pro').length).toBeGreaterThan(0)
    expect(screen.queryByText('BASIC')).not.toBeInTheDocument()
  })

  it('sin nombres cargados cae al código', () => {
    expect(planLabel('basic', {})).toBe('BASIC')
    expect(planLabel('BASIC', planNames)).toBe('Pro')
  })
})
