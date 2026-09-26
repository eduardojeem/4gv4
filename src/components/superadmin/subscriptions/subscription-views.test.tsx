import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SubscriptionTable } from './subscription-table'
import { SubscriptionCard } from './subscription-card'
import type { SuperAdminSubscription } from './types'

const mockSub: SuperAdminSubscription = {
  id: 'sub-table-001',
  organization_id: 'org-001',
  organization_name: 'Electro Tech Paraguay',
  organization_slug: 'electrotech',
  organization_plan: 'PRO',
  owner_id: 'usr-001',
  owner_name: 'Juan Perez',
  owner_email: 'juan@electrotech.com.py',
  plan: 'PRO',
  plan_details: {
    code: 'PRO',
    name: 'Plan Pro',
    price_monthly: 350000,
    currency: 'PYG',
    limits: { max_users: 10, max_products: 5000 },
    modules: ['repairs', 'inventory'],
    is_active: true,
  },
  status: 'active',
  provider: 'manual',
  provider_customer_id: null,
  provider_subscription_id: null,
  trial_ends_at: null,
  current_period_starts_at: '2026-09-01T00:00:00Z',
  current_period_ends_at: '2026-10-01T00:00:00Z',
  cancel_at_period_end: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  members_count: 8,
  products_count: 240,
  sales_count: 1120,
  storefront_public: true,
  marketplace_public: true,
}

describe('SubscriptionTable Component', () => {
  it('renders tenant name, initials, badges and metrics correctly', () => {
    const onOpenDetail = vi.fn()
    const onCopyValue = vi.fn()

    render(
      <SubscriptionTable
        items={[mockSub]}
        onOpenDetail={onOpenDetail}
        onCopyValue={onCopyValue}
      />
    )

    expect(screen.getByText('Electro Tech Paraguay')).toBeDefined()
    expect(screen.getByText('ET')).toBeDefined()
    expect(screen.getByText('/electrotech')).toBeDefined()
    expect(screen.getByText('Pública')).toBeDefined()
    expect(screen.getByText('Juan Perez')).toBeDefined()

    // Trigger row click
    const row = screen.getByLabelText('Ver suscripción de Electro Tech Paraguay')
    fireEvent.click(row)
    expect(onOpenDetail).toHaveBeenCalledWith(mockSub)
  })

  it('renders empty state when no items match', () => {
    render(
      <SubscriptionTable
        items={[]}
        onOpenDetail={vi.fn()}
        onCopyValue={vi.fn()}
      />
    )

    expect(
      screen.getByText('No hay suscripciones que coincidan con los filtros seleccionados.')
    ).toBeDefined()
  })
})

describe('SubscriptionCard Component', () => {
  it('renders tenant details and handles detail click', () => {
    const onOpenDetail = vi.fn()

    render(
      <SubscriptionCard
        subscription={mockSub}
        onOpenDetail={onOpenDetail}
      />
    )

    expect(screen.getByText('Electro Tech Paraguay')).toBeDefined()
    expect(screen.getByText('/electrotech')).toBeDefined()
    expect(screen.getByText('Gestionar')).toBeDefined()

    fireEvent.click(screen.getByText('Gestionar'))
    expect(onOpenDetail).toHaveBeenCalledWith(mockSub)
  })
})
