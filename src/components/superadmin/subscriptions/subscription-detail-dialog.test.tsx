import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SubscriptionDetailDialog } from './subscription-detail-dialog'
import type { SuperAdminSubscription, EditForm } from './types'

const mockSub: SuperAdminSubscription = {
  id: 'sub-123',
  organization_id: 'org-456',
  organization_name: 'Tech Store Paraguay',
  organization_slug: 'tech-store',
  organization_plan: 'PRO',
  owner_id: 'owner-789',
  owner_name: 'Carlos Benítez',
  owner_email: 'carlos@techstore.com',
  plan: 'PRO',
  plan_details: {
    code: 'PRO',
    name: 'Plan Profesional',
    price_monthly: 250000,
    currency: 'PYG',
    limits: { max_users: 10, max_products: 5000 },
    modules: ['repairs', 'inventory', 'pos'],
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
  members_count: 5,
  products_count: 120,
  sales_count: 450,
  storefront_public: true,
  marketplace_public: false,
}

const mockEditForm: EditForm = {
  plan: 'PRO',
  status: 'active',
  trial_ends_at: '',
  current_period_starts_at: '2026-09-01T00:00',
  current_period_ends_at: '2026-10-01T00:00',
  cancel_at_period_end: false,
  storefront_public: true,
  marketplace_public: false,
}

describe('SubscriptionDetailDialog - Public Store Features', () => {
  it('renders public store badge in header and summary strip', () => {
    render(
      <SubscriptionDetailDialog
        subscription={mockSub}
        editForm={mockEditForm}
        isSaving={false}
        planOptions={['FREE', 'BASIC', 'PRO', 'ENTERPRISE']}
        saveError={null}
        onClose={vi.fn()}
        onEditFormChange={vi.fn()}
        onSave={vi.fn()}
        onCopyValue={vi.fn()}
      />
    )

    // Header badge
    expect(screen.getByText('Tienda Pública')).toBeInTheDocument()
    // Summary strip tile
    expect(screen.getByText('PÚBLICA')).toBeInTheDocument()
    // Direct store link button in header
    expect(screen.getByRole('link', { name: /^Tienda$/i })).toHaveAttribute('href', '/tech-store/inicio')
  })

  it('renders storefront and marketplace switches in edit tab and handles toggles', () => {
    const onEditFormChange = vi.fn()

    render(
      <SubscriptionDetailDialog
        subscription={mockSub}
        editForm={mockEditForm}
        isSaving={false}
        planOptions={['FREE', 'BASIC', 'PRO', 'ENTERPRISE']}
        saveError={null}
        onClose={vi.fn()}
        onEditFormChange={onEditFormChange}
        onSave={vi.fn()}
        onCopyValue={vi.fn()}
      />
    )

    expect(screen.getByText('Página Pública & Presencia Online')).toBeInTheDocument()
    expect(screen.getByText('Habilitar Tienda Pública')).toBeInTheDocument()
    expect(screen.getByText('Visible en Marketplace')).toBeInTheDocument()

    const storefrontSwitch = screen.getByLabelText(/Habilitar Tienda Pública/i)
    fireEvent.click(storefrontSwitch)

    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({
      storefront_public: false,
    }))

    const marketplaceSwitch = screen.getByLabelText(/Visible en Marketplace/i)
    fireEvent.click(marketplaceSwitch)

    expect(onEditFormChange).toHaveBeenCalledWith(expect.objectContaining({
      marketplace_public: true,
    }))
  })

  it('shows Presencia Web details in details tab', () => {
    render(
      <SubscriptionDetailDialog
        subscription={mockSub}
        editForm={mockEditForm}
        isSaving={false}
        planOptions={['FREE', 'BASIC', 'PRO', 'ENTERPRISE']}
        saveError={null}
        onClose={vi.fn()}
        onEditFormChange={vi.fn()}
        onSave={vi.fn()}
        onCopyValue={vi.fn()}
      />
    )

    // Switch to details tab
    const detailsTabBtn = screen.getByText('Ficha del Tenant & Límites')
    fireEvent.click(detailsTabBtn)

    expect(screen.getByText('Presencia Web & Tienda Pública')).toBeInTheDocument()
    expect(screen.getByText('Habilitada (Pública)')).toBeInTheDocument()
    expect(screen.getByText('Oculto en marketplace')).toBeInTheDocument()
    expect(screen.getByText('/tech-store/inicio')).toBeInTheDocument()
  })
})
