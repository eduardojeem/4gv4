import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import SuperAdminPage from './page'
import { getSuperAdminOverview, type SuperAdminOverview } from '@/lib/superadmin/overview'

vi.mock('@/lib/superadmin/overview', () => ({ getSuperAdminOverview: vi.fn() }))

it('presents priorities before indicators in reading order and retains subscription values and actions', async () => {
  const overview: SuperAdminOverview = {
    counts: [{ key: 'organizations', label: 'Empresas', value: 12, available: true }],
    recentOrganizations: [],
    planDistribution: [{ plan: 'PRO', count: 12 }],
    subscriptionHealth: { total: 12, active: 8, trialing: 2, atRisk: 2, canceled: 0, canceling: 0, renewalsSoon: 3, estimatedMrr: 800000 },
    attentionItems: [{ id: 'sub-1', organization_id: 'org-1', organization_name: 'Tienda urgente', organization_slug: 'urgente', plan: 'PRO', status: 'past_due', current_period_ends_at: null, trial_ends_at: null, cancel_at_period_end: false, reason: 'Pago pendiente' }],
  }
  vi.mocked(getSuperAdminOverview).mockResolvedValue(overview)
  render(await SuperAdminPage())
  const priority = screen.getByRole('region', { name: 'Qué necesita atención' })
  const metrics = screen.getByRole('region', { name: 'Indicadores ejecutivos' })
  expect(priority.compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByText('Tienda urgente')).toBeInTheDocument()
  expect(screen.getByText('Pago pendiente')).toBeInTheDocument()
  expect(screen.getByText('8 activas · 3 renovaciones próximas')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /MRR confirmado/ })).toHaveAttribute('href', '/superadmin/billing')
  expect(screen.getByRole('link', { name: /Nueva organización/ })).toHaveAttribute('href', '/superadmin/organizations/create')
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
})
