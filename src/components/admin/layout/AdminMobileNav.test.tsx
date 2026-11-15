import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdminMobileNav } from './AdminMobileNav'
import { AdminMobileDrawer } from './AdminMobileDrawer'
import { LayoutDashboard, Banknote, Package, Landmark } from 'lucide-react'
import type { NavCategory } from '@/config/admin-navigation'

vi.mock('@/contexts/SubscriptionStatusContext', () => ({
  useSubscriptionStatus: () => ({
    organizationName: 'Negocio Test',
    organizationLogoUrl: null,
    planName: 'Pro',
    effectiveModules: ['analytics', 'cash_register'],
  }),
}))

vi.mock('@/components/saas/organization-switcher', () => ({
  OrganizationSwitcher: () => <div data-testid="org-switcher" />,
}))

vi.mock('@/components/branches/branch-selector', () => ({
  BranchSelector: () => <div data-testid="branch-selector" />,
}))

const mockCategories: NavCategory[] = [
  {
    id: 'analytics',
    label: 'Análisis',
    items: [
      {
        key: 'overview',
        label: 'Resumen',
        icon: LayoutDashboard,
        href: '/admin',
        description: 'Vista general',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operaciones',
    items: [
      {
        key: 'cash-monitor',
        label: 'Monitor de Cajas',
        icon: Banknote,
        href: '/admin/cash-monitor',
        badge: 'cash-alerts',
        description: 'Control de cajas',
      },
      {
        key: 'inventory',
        label: 'Inventario',
        icon: Package,
        href: '/admin/inventory',
        description: 'Stock y productos',
      },
      {
        key: 'finances',
        label: 'Finanzas',
        icon: Landmark,
        href: '/admin/finances',
        description: 'Gastos e ingresos',
      },
    ],
  },
]

describe('AdminMobileNav', () => {
  it('renderiza accesos directos en el dock de 5 lugares y abre el Centro de Comando', () => {
    const onOpenMenu = vi.fn()
    render(
      <AdminMobileNav
        visibleCategories={mockCategories}
        pathname="/admin"
        navBadges={{ 'cash-alerts': 3 }}
        onOpenMenu={onOpenMenu}
      />
    )

    // Accesos rápidos en el dock + botón central de comando
    expect(screen.getByText('Resumen')).toBeInTheDocument()
    expect(screen.getByText('Cajas')).toBeInTheDocument()
    expect(screen.getByText('Comando')).toBeInTheDocument()
    expect(screen.getByText('Stock')).toBeInTheDocument()
    expect(screen.getByText('Finanzas')).toBeInTheDocument()

    // Contador de alertas en Cajas
    expect(screen.getByText('3')).toBeInTheDocument()

    // Botón central abre Centro de Comando
    const commandBtn = screen.getByRole('button', { name: /abrir centro de comando de administración/i })
    expect(commandBtn).toBeInTheDocument()
    fireEvent.click(commandBtn)

    const dialog = screen.getByRole('dialog', { name: /centro de comando de administración/i })
    expect(dialog).toBeInTheDocument()

    // Acceso principal destacado al inicio arriba del menú para volver al Panel / POS
    const returnLink = screen.getByRole('link', { name: /volver al panel \/ inicio/i })
    expect(returnLink).toHaveAttribute('href', '/dashboard')

    // Live cards con estado de cajas
    expect(screen.getByText('3 alertas')).toBeInTheDocument()

    // Buscador vivo dentro del centro de comando
    const searchInput = screen.getByRole('searchbox', { name: /buscar módulo de administración/i })
    fireEvent.change(searchInput, { target: { value: 'cajas' } })
    expect(screen.getByText('Monitor de Cajas')).toBeInTheDocument()
    expect(screen.queryByText('Inventario')).not.toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: '' } })

    // Menú lateral completo sigue alcanzable desde arriba del Centro de Comando
    const fullMenuBtn = screen.getByRole('button', { name: /abrir menú lateral completo/i })
    fireEvent.click(fullMenuBtn)
    expect(onOpenMenu).toHaveBeenCalledTimes(1)
  })
})

describe('AdminMobileDrawer', () => {
  it('renderiza las secciones y permite buscar y cerrar', () => {
    const onClose = vi.fn()
    const onToggleCategory = vi.fn()
    const onOpenSearch = vi.fn()
    const onOpenLogout = vi.fn()

    render(
      <AdminMobileDrawer
        open={true}
        onClose={onClose}
        visibleCategories={mockCategories}
        expandedCategories={['operations']}
        onToggleCategory={onToggleCategory}
        pathname="/admin/cash-monitor"
        navBadges={{ 'cash-alerts': 3 }}
        onOpenSearch={onOpenSearch}
        onOpenLogout={onOpenLogout}
        user={{ profile: { name: 'Juan Admin' }, email: 'juan@test.com', role: 'admin' }}
        userInitials="JA"
      />
    )

    // Título y branding
    expect(screen.getByText('Negocio Test')).toBeInTheDocument()

    // Buscador rápido
    const searchBtn = screen.getByText('Buscar sección o herramienta...')
    fireEvent.click(searchBtn)
    expect(onOpenSearch).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()

    // Items de operaciones expandidas
    expect(screen.getByText('Monitor de Cajas')).toBeInTheDocument()
    expect(screen.getByText('Control de cajas')).toBeInTheDocument()

    // Botón para volver al POS / Dashboard
    expect(screen.getByText('Ir a Tienda / POS')).toBeInTheDocument()

    // Botón de cerrar
    const closeBtn = screen.getByRole('button', { name: /cerrar menú/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('no renderiza nada si open es false', () => {
    const { container } = render(
      <AdminMobileDrawer
        open={false}
        onClose={vi.fn()}
        visibleCategories={mockCategories}
        expandedCategories={[]}
        onToggleCategory={vi.fn()}
        pathname="/admin"
        navBadges={{}}
        onOpenSearch={vi.fn()}
        onOpenLogout={vi.fn()}
        user={null}
        userInitials="U"
      />
    )
    expect(container.firstChild).toBeNull()
  })
})
