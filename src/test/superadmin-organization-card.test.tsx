import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrganizationsDashboard, type SuperAdminOrganization } from '@/components/superadmin/organizations/organizations-dashboard'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/superadmin/organizations',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/superadmin/EnterSupportButton', () => ({ EnterSupportButton: () => null }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const AHORA = '2026-09-16T12:00:00.000Z'
const hace = (dias: number) => new Date(new Date(AHORA).getTime() - dias * 86_400_000).toISOString()
const en = (dias: number) => new Date(new Date(AHORA).getTime() + dias * 86_400_000).toISOString()

const org = (over: Partial<SuperAdminOrganization>): SuperAdminOrganization => ({
  id: 'org-1', name: 'HCA Celular', slug: 'hca-celular', plan: 'PRO', logo_url: null,
  owner_id: 'owner-1', owner_name: 'Hugo Cáceres', owner_email: 'dueno@hca.com.py',
  created_at: '2025-02-14T10:00:00Z', updated_at: null,
  subscription_status: 'active', payment_status: 'paid', subscription_provider: null,
  trial_ends_at: null, current_period_ends_at: en(40), cancel_at_period_end: false,
  members_total: 4, members_active: 4, members_invited: 0, members_suspended: 0,
  staff_total: 3, staff_active: 2, staff_invited: 1, staff_suspended: 0, customers_total: 12,
  business_vertical: 'electronics', operating_model: 'retail', enabled_modules: ['pos', 'repairs'],
  last_access_known: true, last_access_at: hace(2), last_sale_at: hace(0), products_total: 1480,
  ...over,
})

function renderGrid(organizations: SuperAdminOrganization[]) {
  render(<OrganizationsDashboard organizations={organizations} referenceTime={AHORA} />)
  fireEvent.click(screen.getByRole('button', { name: 'Vista de Cuadrícula' }))
}

describe('tarjeta de organización', () => {
  /** Para abrir la ficha había que adivinar que el nombre era un enlace. */
  it('tiene un botón «Ver detalle» que lleva a la ficha', () => {
    renderGrid([org({})])
    const card = within(screen.getByTestId('org-card-hca-celular'))
    expect(card.getByRole('link', { name: /Ver detalle/ })).toHaveAttribute('href', '/superadmin/organizations/hca-celular')
  })

  it('muestra dueño, último acceso, última venta, equipo y productos', () => {
    renderGrid([org({})])
    const card = within(screen.getByTestId('org-card-hca-celular'))
    expect(card.getByText('Hugo Cáceres')).toBeInTheDocument()
    expect(card.getByText('Hace 2 días')).toBeInTheDocument()
    expect(card.getByText('Hoy')).toBeInTheDocument()
    expect(card.getByText('2/3')).toBeInTheDocument()
    expect(card.getByText(/12 clientes web/)).toBeInTheDocument()
    expect(card.getByText('1.480')).toBeInTheDocument()
  })

  /** Una empresa que dejó de entrar se veía igual que una que entró hoy. */
  it('señala a la que no entra hace más de un mes', () => {
    renderGrid([org({ last_access_at: hace(100), last_sale_at: null })])
    const card = within(screen.getByTestId('org-card-hca-celular'))
    expect(card.getByRole('list', { name: 'Requiere atención' })).toHaveTextContent('Sin entrar: hace 3 meses')
    expect(card.getByText('Sin ventas')).toBeInTheDocument()
  })

  it('señala un problema de cobro', () => {
    renderGrid([org({ subscription_status: 'past_due', payment_status: 'failed' })])
    const card = within(screen.getByTestId('org-card-hca-celular'))
    expect(card.getByRole('list', { name: 'Requiere atención' })).toHaveTextContent('Problema de cobro')
  })

  /** Sin el dato no se afirma «nunca entró». */
  it('si no se pudo leer el acceso, no inventa uno', () => {
    renderGrid([org({ last_access_known: false, last_access_at: null, products_total: null })])
    const card = within(screen.getByTestId('org-card-hca-celular'))
    expect(card.getAllByText('Sin dato')).toHaveLength(2)
    expect(card.queryByRole('list', { name: 'Requiere atención' })).not.toBeInTheDocument()
  })
})
