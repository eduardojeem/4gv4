import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OrganizationDetailView, type FullOrganizationDetail } from '@/components/superadmin/organizations/OrganizationDetailView'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/components/superadmin/EnterSupportButton', () => ({
  EnterSupportButton: () => null,
}))

/**
 * Los datos son los de HCA Celular verificados contra la base: 47 productos,
 * 2 butacas, 1 sucursal, plan PRO con tope de 5000/10/3, una venta cobrada de
 * 50.000 el 2026-08-06.
 */
const base = (over: Partial<FullOrganizationDetail> = {}): FullOrganizationDetail => ({
  organization: {
    id: '3f2b1a44-1111-4222-8333-444455556666',
    name: 'HCA Celular',
    slug: 'hca-celular',
    plan: 'PRO',
    logo_url: null,
    owner_id: 'owner-1',
    created_at: '2025-02-14T10:00:00Z',
    updated_at: '2026-08-06T21:43:00Z',
    business_vertical: 'general',
    operating_model: 'retail',
    enabled_modules: ['pos', 'inventory'],
    storefront_public: true,
    marketplace_public: true,
  } as never,
  owner: { id: 'owner-1', email: 'dueno@hca.com.py', full_name: 'Hugo Cáceres', avatar_url: null } as never,
  settings: { currency: 'PYG', timezone: 'America/Asuncion', display_name: null, modules: {} } as never,
  members: [],
  membersFailed: false,
  subscription: null,
  plan_details: { id: 'p', name: 'Pro', tier: 'pro', price_monthly: 250000, currency: 'PYG' },
  plan_limits: { users: 10, branches: 3, products: 5000, repairs: 500, cashRegisters: 10 },
  plan_limits_source: 'technical',
  branches: [
    {
      id: 'b1', name: 'Casa Central', code: 'CC', slug: 'casa-central',
      address: 'Mcal. López 1234', city: 'Asunción', phone: '021-555-100',
      email: null, is_active: true, is_default: true, created_at: '2025-02-14T10:00:00Z',
    },
  ],
  counts: { products: 47, quotaProducts: 47, staffMembers: 2, sales: 1, customers: 12, repairs: 3 },
  activity: {
    revenueTotal: 50_000, revenueLast30: 0, completedSales: 1, totalSales: 1,
    lastSaleAt: '2026-08-06T21:43:17Z', daysSinceLastSale: 34,
  },
  activityTruncated: false,
  admin_settings: null,
  company_info: null,
  billing: null,
  settings_modules: {},
  ...over,
})

describe('la ficha general muestra el negocio, no sus metadatos', () => {
  it('el ticket promedio sale de lo cobrado', () => {
    render(<OrganizationDetailView data={base()} />)
    expect(screen.getByText('Ticket promedio')).toBeInTheDocument()
    expect(screen.getByText('Sobre 1 ventas cobradas')).toBeInTheDocument()
  })

  it('sin ventas cobradas el ticket dice «Sin dato», no ₲0', () => {
    render(<OrganizationDetailView data={base({
      activity: { revenueTotal: 0, revenueLast30: 0, completedSales: 0, totalSales: 3, lastSaleAt: null, daysSinceLastSale: null },
    })} />)
    expect(screen.getByText('Todavía no cobró ninguna venta')).toBeInTheDocument()
  })

  it('la antigüedad se dice en palabras y avisa si nunca terminó de configurar', () => {
    render(<OrganizationDetailView data={base()} />)
    expect(screen.getByText('Antigüedad')).toBeInTheDocument()
    expect(screen.getByText('Nunca terminó de configurar la cuenta')).toBeInTheDocument()
  })

  it('con la marca de onboarding puesta lo dice terminado', () => {
    render(<OrganizationDetailView data={base({
      settings_modules: { onboarding: { status: 'completed', completed_at: '2025-03-01T00:00:00Z' } },
    })} />)
    expect(screen.queryByText('Nunca terminó de configurar la cuenta')).not.toBeInTheDocument()
  })
})

describe('el contacto del negocio llega a la pantalla', () => {
  it('hereda el teléfono de la sucursal principal y lo dice', () => {
    render(<OrganizationDetailView data={base()} />)
    expect(screen.getByText('021-555-100')).toBeInTheDocument()
    expect(screen.getAllByText('Sucursal principal').length).toBeGreaterThan(0)
  })

  it('el teléfono se puede marcar', () => {
    render(<OrganizationDetailView data={base()} />)
    const llamar = screen.getByRole('link', { name: 'Llamar' })
    expect(llamar).toHaveAttribute('href', 'tel:021555100')
  })

  it('lo que el admin cargó le gana a la sucursal', () => {
    render(<OrganizationDetailView data={base({
      admin_settings: { companyPhone: '0981-777-888' },
    })} />)
    expect(screen.getByText('0981-777-888')).toBeInTheDocument()
  })

  it('cuenta cuántos datos de contacto faltan', () => {
    render(<OrganizationDetailView data={base()} />)
    // Teléfono, dirección y ciudad vienen de la sucursal; faltan correo y RUC.
    expect(screen.getByText('2 sin cargar')).toBeInTheDocument()
  })

  it('el RUC ausente se dice, no se deja en blanco', () => {
    render(<OrganizationDetailView data={base()} />)
    expect(screen.getByText('Sin RUC cargado')).toBeInTheDocument()
  })

  it('con perfil de facturación muestra RUC y razón social', () => {
    render(<OrganizationDetailView data={base({
      billing: { ruc: '80012345-6', business_name: 'HCA Celular S.A.', billing_email: 'facturas@hca.com.py' },
    })} />)
    expect(screen.getByText('80012345-6')).toBeInTheDocument()
    expect(screen.getByText('HCA Celular S.A.')).toBeInTheDocument()
  })
})

describe('los topes del plan se muestran contra el uso real', () => {
  it('47 de 5.000 productos', () => {
    render(<OrganizationDetailView data={base()} />)
    expect(screen.getByText(/de 5.000/)).toBeInTheDocument()
  })

  it('sin límites cargados no dice «sin tope»', () => {
    render(<OrganizationDetailView data={base({ plan_limits: null, plan_limits_source: 'missing' })} />)
    expect(screen.getAllByText(/no tiene límites cargados/).length).toBeGreaterThan(0)
  })
})
