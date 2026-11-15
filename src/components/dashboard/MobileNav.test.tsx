import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  pathname: '/dashboard',
  role: 'admin' as 'admin' | 'vendedor' | 'tecnico',
  toggleSidebar: vi.fn(),
  effectiveModules: ['pos', 'orders', 'inventory', 'repairs', 'services', 'crm', 'credits'],
  businessVertical: 'electronics' as string,
  organizationId: 'org-test-1' as string | null,
  deniedPermissions: new Set<string>(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', role: state.role } }),
}))

vi.mock('@/contexts/DashboardLayoutContext', () => ({
  useDashboardLayout: () => ({
    sidebarCollapsed: true,
    toggleSidebar: state.toggleSidebar,
    setSidebarCollapsed: vi.fn(),
  }),
}))

vi.mock('@/contexts/ActiveOrganizationContext', () => ({
  useOptionalActiveOrganization: () =>
    state.organizationId ? { organization: { id: state.organizationId } } : null,
}))

vi.mock('@/contexts/SubscriptionStatusContext', () => ({
  useSubscriptionStatus: () => ({
    effectiveModules: state.effectiveModules,
    businessVertical: state.businessVertical,
    organizationName: 'TechStore PY',
    organizationLogoUrl: null,
  }),
}))

vi.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({
    hasPermission: (permission: string) => !state.deniedPermissions.has(permission),
  }),
}))

import { MobileNav } from './mobile-nav'

describe('Dashboard MobileNav (4 Principales personalizables + Acciones rápidas + Admin destacado)', () => {
  beforeEach(() => {
    state.pathname = '/dashboard'
    state.role = 'admin'
    state.organizationId = 'org-test-1'
    state.deniedPermissions = new Set<string>()
    state.toggleSidebar.mockReset()
    state.businessVertical = 'electronics'
    window.localStorage.clear()
  })

  it('no se muestra en /dashboard/pos para no tapar la barra de cobro', () => {
    state.pathname = '/dashboard/pos'
    const { container } = render(<MobileNav />)
    expect(container.firstChild).toBeNull()
  })

  it('muestra inicialmente 4 principales, Ver todas las secciones, acciones rápidas e Ir a Administración abajo', () => {
    render(<MobileNav />)

    const nav = screen.getByRole('navigation', { name: /navegación móvil del panel/i })
    expect(nav).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /abrir menú rápido del panel/i }))

    const dialog = screen.getByRole('dialog', { name: /centro de control del panel/i })
    const inDialog = within(dialog)

    // Inicialmente solo los 4 principales visibles en la grilla (para electrónica: POS, Caja, Taller, Pedidos)
    expect(inDialog.getByText('PRINCIPALES (4)')).toBeInTheDocument()
    expect(inDialog.getByRole('link', { name: /^punto de venta$/i })).toHaveTextContent('POS')
    expect(inDialog.getByRole('link', { name: /^caja$/i })).toHaveTextContent('Caja')
    expect(inDialog.getByRole('link', { name: /^reparaciones$/i })).toHaveTextContent('Taller')
    expect(inDialog.getByRole('link', { name: /^pedidos$/i })).toHaveTextContent('Pedidos')
    expect(inDialog.queryByRole('link', { name: /^agenda$/i })).not.toBeInTheDocument()
    expect(inDialog.queryByRole('link', { name: /^créditos$/i })).not.toBeInTheDocument()

    // Botón mejorado Ir a Administración destacado en la base de la tarjeta
    const adminBanner = inDialog.getByRole('link', { name: /ir a administración/i })
    expect(adminBanner).toHaveAttribute('href', '/admin')
    expect(adminBanner).toHaveTextContent('Ir a Administración')

    // Al tocar Ver todas las secciones muestra acciones rápidas (Nueva reparación, Abrir caja, Nueva venta, Nuevo pedido) y demás secciones
    fireEvent.click(inDialog.getByRole('button', { name: /ver todas las secciones/i }))
    expect(inDialog.getByText('ACCIONES RÁPIDAS')).toBeInTheDocument()
    expect(inDialog.getByRole('link', { name: /^nueva reparación$/i })).toHaveAttribute(
      'href',
      '/dashboard/repairs?new=true',
    )
    expect(inDialog.getByRole('link', { name: /^abrir caja$/i })).toHaveAttribute(
      'href',
      '/dashboard/pos/caja',
    )
    expect(inDialog.getByRole('link', { name: /^nueva venta$/i })).toHaveAttribute(
      'href',
      '/dashboard/pos',
    )
    expect(inDialog.getByRole('link', { name: /^nuevo pedido$/i })).toHaveAttribute(
      'href',
      '/dashboard/orders/new',
    )
    expect(inDialog.getByRole('link', { name: /^créditos$/i })).toBeInTheDocument()
  })

  it('permite cambiar los 4 accesos principales agregando Nueva reparación, Abrir caja, Nueva venta o Nuevo pedido y persiste', async () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: /abrir menú rápido del panel/i }))

    const dialog = screen.getByRole('dialog', { name: /centro de control del panel/i })
    const inDialog = within(dialog)

    fireEvent.click(inDialog.getByRole('button', { name: /cambiar accesos principales/i }))
    expect(inDialog.getByText('Elegí 4 accesos principales (4/4)')).toBeInTheDocument()

    // Quita Pedidos y agrega Nueva reparación y Abrir caja (sacando también Reparaciones -> agrega Abrir caja)
    fireEvent.click(inDialog.getByRole('button', { name: /quitar pedidos de principales/i }))
    expect(inDialog.getByText('Elegí 4 accesos principales (3/4)')).toBeInTheDocument()

    fireEvent.click(inDialog.getByRole('button', { name: /agregar nueva reparación a principales/i }))
    expect(inDialog.getByText('Elegí 4 accesos principales (4/4)')).toBeInTheDocument()

    // También reemplaza el más antiguo cuando agrega Abrir caja sobre 4/4
    fireEvent.click(inDialog.getByRole('button', { name: /agregar abrir caja a principales/i }))

    fireEvent.click(inDialog.getByRole('button', { name: /guardar accesos principales/i }))

    // La barra principal ahora muestra los accesos personalizados (incluyendo Nueva reparación y Abrir caja)
    await waitFor(() => {
      expect(inDialog.getByRole('link', { name: /^nueva reparación$/i })).toHaveTextContent('+ Repar.')
      expect(inDialog.getByRole('link', { name: /^abrir caja$/i })).toHaveTextContent('Abrir caja')
    })

    const savedRaw = window.localStorage.getItem('panel_pinned_shortcuts_v1.org-test-1')
    expect(savedRaw).toContain('action:new-repair')
    expect(savedRaw).toContain('action:open-cash')
  })

  it('oculta Ir a Administración y acciones no permitidas al vendedor sin acceso administrativo', () => {
    state.role = 'vendedor'
    state.deniedPermissions = new Set([
      'repairs.manage',
      'repairs.create',
      'repairs.orders.create',
    ])
    render(<MobileNav />)

    fireEvent.click(screen.getByRole('button', { name: /abrir menú rápido del panel/i }))
    const dialog = screen.getByRole('dialog', { name: /centro de control del panel/i })
    const inDialog = within(dialog)

    expect(inDialog.queryByRole('link', { name: /ir a administración/i })).not.toBeInTheDocument()
    fireEvent.click(inDialog.getByRole('button', { name: /ver todas las secciones/i }))
    expect(inDialog.queryByRole('link', { name: /^nueva reparación$/i })).not.toBeInTheDocument()
    expect(inDialog.getByRole('link', { name: /^abrir caja$/i })).toBeInTheDocument()
  })

  it('busca secciones y acciones rápidas y permite abrir el menú lateral completo', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: /abrir menú rápido del panel/i }))

    const dialog = screen.getByRole('dialog', { name: /centro de control del panel/i })
    const inDialog = within(dialog)

    fireEvent.click(inDialog.getByRole('button', { name: /buscar sección/i }))
    const searchInput = inDialog.getByRole('searchbox', { name: /buscar sección del panel/i })
    fireEvent.change(searchInput, { target: { value: 'nueva reparacion' } })

    expect(inDialog.getByRole('link', { name: /nueva reparación/i })).toHaveAttribute(
      'href',
      '/dashboard/repairs?new=true',
    )

    fireEvent.click(inDialog.getByRole('button', { name: /abrir menú lateral completo/i }))
    expect(state.toggleSidebar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
