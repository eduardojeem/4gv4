import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  isStaffRole,
  memberStatusLabel,
  partitionMembers,
  roleLabel,
  sortStaff,
} from '@/lib/organization/member-roles'
import { OrganizationDetailView, type FullOrganizationDetail } from '@/components/superadmin/organizations/OrganizationDetailView'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const VISTA = leer('src/components/superadmin/organizations/OrganizationDetailView.tsx')

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/components/superadmin/EnterSupportButton', () => ({ EnterSupportButton: () => null }))

/**
 * `organization_members` guarda al tecnico que repara y al cliente que se
 * registro solo desde la tienda publica en la misma tabla. La pestaña los
 * listaba juntos bajo «Colaboradores de la Empresa», asi que una organizacion
 * con 3 empleados y 37 clientes web figuraba con «40 usuarios».
 */
describe('el equipo se separa de los clientes de la web', () => {
  it('`customer` es lo único que no es equipo', () => {
    expect(isStaffRole('owner')).toBe(true)
    expect(isStaffRole('technician')).toBe(true)
    expect(isStaffRole('seller')).toBe(true)
    expect(isStaffRole('CUSTOMER')).toBe(false)
  })

  it('una fila sin rol cuenta como equipo, no como cliente', () => {
    // `neq('role','customer')` la descarta en SQL —`NULL <> 'customer'` es
    // NULL— pero es un miembro real cargado mal, no un cliente.
    expect(isStaffRole(null)).toBe(true)
    const r = partitionMembers([{ role: null, status: 'active' }])
    expect(r.staff).toHaveLength(1)
    expect(r.staffWithoutRole).toBe(1)
  })

  it('separa y cuenta por estado', () => {
    const r = partitionMembers([
      { role: 'owner', status: 'active' },
      { role: 'technician', status: 'active' },
      { role: 'seller', status: 'suspended' },
      { role: 'seller', status: 'invited' },
      { role: 'customer', status: 'active' },
      { role: 'customer', status: 'active' },
    ])
    expect(r.staff).toHaveLength(4)
    expect(r.customers).toHaveLength(2)
    expect(r.staffActive).toBe(2)
    expect(r.staffSuspended).toBe(1)
    expect(r.staffInvited).toBe(1)
  })

  it('el propietario encabeza la lista', () => {
    const orden = sortStaff([
      { role: 'technician', status: 'active' },
      { role: 'owner', status: 'active' },
      { role: 'seller', status: 'active' },
    ])
    expect(orden.map((m) => m.role)).toEqual(['owner', 'seller', 'technician'])
  })
})

describe('los roles se dicen en castellano', () => {
  it('no se muestra el valor crudo de la columna', () => {
    expect(roleLabel('owner')).toBe('Propietario')
    expect(roleLabel('technician')).toBe('Técnico')
    expect(roleLabel('seller')).toBe('Vendedor')
    expect(roleLabel('cashier')).toBe('Cajero')
    expect(roleLabel('customer')).toBe('Cliente')
    expect(memberStatusLabel('suspended')).toBe('Suspendido')
    expect(memberStatusLabel('invited')).toBe('Invitado')
  })

  it('un rol desconocido se muestra tal cual en vez de desaparecer', () => {
    expect(roleLabel('rol_nuevo')).toBe('rol_nuevo')
    expect(roleLabel(null)).toBe('Sin rol')
  })
})

// ── La pantalla ─────────────────────────────────────────────────────────────

const miembro = (role: string, status = 'active', nombre?: string) => ({
  id: `${role}-${nombre ?? status}-${Math.random().toString(36).slice(2, 8)}`,
  user_id: 'u',
  role,
  status,
  created_at: '2025-03-01T00:00:00Z',
  profiles: nombre ? { id: 'p', email: `${nombre}@hca.com.py`, full_name: nombre, avatar_url: null } : null,
})

const base = (over: Partial<FullOrganizationDetail> = {}): FullOrganizationDetail => ({
  organization: {
    id: '3f2b1a44-1111-4222-8333-444455556666',
    name: 'HCA Celular', slug: 'hca-celular', plan: 'PRO', logo_url: null, owner_id: 'owner-1',
    created_at: '2025-02-14T10:00:00Z', updated_at: '2026-08-06T21:43:00Z',
    business_vertical: 'general', operating_model: 'retail',
    enabled_modules: ['pos', 'inventory'], storefront_public: true, marketplace_public: true,
  } as never,
  owner: { id: 'owner-1', email: 'dueno@hca.com.py', full_name: 'Hugo Cáceres', avatar_url: null } as never,
  settings: { currency: 'PYG', timezone: 'America/Asuncion', display_name: null, modules: {} } as never,
  members: [
    miembro('owner', 'active', 'Hugo Cáceres'),
    miembro('technician', 'active', 'Ana Villalba'),
    miembro('seller', 'suspended', 'Beto Ramírez'),
    miembro('customer', 'active', 'Cliente Uno'),
    miembro('customer', 'active', 'Cliente Dos'),
  ],
  membersFailed: false,
  subscription: null,
  plan_details: { id: 'p', name: 'Pro', tier: 'pro', price_monthly: 250_000, currency: 'PYG' },
  plan_limits: { users: 10, branches: 3, products: 5000, repairs: 500 },
  plan_limits_source: 'technical',
  branches: [{
    id: 'b1', name: 'Casa Central', code: 'CC', slug: 'casa-central',
    address: 'Mcal. López 1234', city: 'Asunción', phone: '021-555-100',
    email: null, is_active: true, is_default: true, created_at: '2025-02-14T10:00:00Z',
  }],
  counts: { products: 47, quotaProducts: 47, staffMembers: 2, sales: 1, customers: 12, repairs: 3 },
  activity: {
    revenueTotal: 50_000, revenueLast30: 0, completedSales: 1, totalSales: 1,
    lastSaleAt: '2026-08-06T21:43:17Z', daysSinceLastSale: 34,
  },
  activityTruncated: false,
  admin_settings: null, company_info: null, billing: null, settings_modules: {},
  repair_summary: {
    total: 3, open: 1, completed: 2, cancelled: 0,
    collected: 180_000, pendingBalance: 0, lastRepairAt: null,
  },
  online_summary: { total: 0, paid: 0, revenue: 0, partial: 0, open: 0, cancelled: 0, lastOrderAt: null },
  credit_summary: {
    total: 1, active: 1, completed: 0, defaulted: 0, cancelled: 0,
    principal: 750_000, outstanding: 300_000, overdueInstallments: 0, overdueAmount: 0,
    byOrigin: { repair: 1 }, averageTerm: 3, lastCreditAt: null, installmentsTruncated: false,
  },
  billing_summary: {
    paidTotal: 0, paidCount: 0, pendingCount: 0, failedCount: 0, refundedCount: 0,
    lastPaidAt: null, lastPaidAmount: null, lastPaidMethod: null, currency: null, mixedCurrency: false,
  },
  ...over,
})

const abrirEquipo = async () => {
  const usuario = userEvent.setup()
  await usuario.click(screen.getByRole('tab', { name: /Equipo/ }))
}

describe('la pestaña dice quién trabaja y quién compra', () => {
  it('el rótulo de la pestaña cuenta al equipo, no a los clientes', () => {
    render(<OrganizationDetailView data={base()} />)
    expect(screen.getByRole('tab', { name: /Equipo \(3\)/ })).toBeInTheDocument()
  })

  it('son dos listas con títulos distintos', async () => {
    render(<OrganizationDetailView data={base()} />)
    await abrirEquipo()
    expect(screen.getByText('Equipo de trabajo')).toBeInTheDocument()
    expect(screen.getByText('Clientes de la tienda pública')).toBeInTheDocument()
  })

  it('explica qué es cada grupo', async () => {
    render(<OrganizationDetailView data={base()} />)
    await abrirEquipo()
    expect(screen.getByText(/Se registraron solos desde la web para comprar/)).toBeInTheDocument()
    expect(screen.getByText(/propietario, administración, caja, ventas y taller/)).toBeInTheDocument()
  })

  it('el rol se muestra en castellano y con su alcance', async () => {
    render(<OrganizationDetailView data={base()} />)
    await abrirEquipo()
    expect(screen.getByText('Técnico')).toBeInTheDocument()
    expect(screen.getByText('Recibe y repara equipos en el taller')).toBeInTheDocument()
    expect(screen.queryByText('technician')).not.toBeInTheDocument()
  })

  it('dice cuántas butacas ocupa el equipo contra el tope del plan', async () => {
    render(<OrganizationDetailView data={base()} />)
    await abrirEquipo()
    // Owner y técnico activos; el vendedor suspendido no ocupa butaca.
    expect(screen.getByText('2 butacas ocupadas de 10')).toBeInTheDocument()
    expect(screen.getByText('1 suspendido')).toBeInTheDocument()
  })

  it('los clientes web no cuentan como butaca y se dice', async () => {
    render(<OrganizationDetailView data={base()} />)
    await abrirEquipo()
    expect(screen.getByText('2 con cuenta')).toBeInTheDocument()
    expect(screen.getByText(/No forman parte del equipo ni consumen butaca/)).toBeInTheDocument()
  })

  it('una organización sin clientes web lo dice en vez de dejar el bloque vacío', async () => {
    render(<OrganizationDetailView data={base({
      members: [miembro('owner', 'active', 'Hugo Cáceres')],
    })} />)
    await abrirEquipo()
    expect(screen.getByText('Nadie se registró todavía desde la tienda pública.')).toBeInTheDocument()
  })

  it('una fila sin rol se señala como algo a corregir', async () => {
    render(<OrganizationDetailView data={base({
      members: [miembro('owner', 'active', 'Hugo'), { ...miembro('', 'active', 'Sin Rol'), role: null as never }],
    })} />)
    await abrirEquipo()
    expect(screen.getByText(/no tiene rol/)).toBeInTheDocument()
  })

  it('un fallo de la consulta no se muestra como una organización sin equipo', async () => {
    render(<OrganizationDetailView data={base({ members: [], membersFailed: true })} />)
    await abrirEquipo()
    expect(screen.getByText(/esto es un fallo de la consulta, no una lista vacía/)).toBeInTheDocument()
  })
})

describe('el encabezado deja de sumar clientes al equipo', () => {
  it('el mosaico cuenta personas del equipo y menciona los clientes aparte', () => {
    render(<OrganizationDetailView data={base()} />)
    expect(screen.getByText('Equipo')).toBeInTheDocument()
    expect(screen.getByText('3 personas')).toBeInTheDocument()
    expect(screen.getByText('+ 2 clientes con cuenta web')).toBeInTheDocument()
  })

  it('la vista ya no muestra un total que mezcla las dos cosas', async () => {
    // Se afirma sobre lo RENDERIZADO: el titulo viejo sobrevive en el
    // comentario que explica por que se cambio, y afirmar sobre el texto
    // fuente hace que la prueba falle por el comentario, no por la pantalla.
    render(<OrganizationDetailView data={base()} />)
    await abrirEquipo()
    expect(document.body.textContent).not.toContain('Colaboradores de la Empresa')
    expect(document.body.textContent).not.toContain('5 usuarios')
  })
})
