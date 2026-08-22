import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminLayout } from '@/components/admin/layout/AdminLayout'
import { AdminLayoutProvider } from '@/contexts/AdminLayoutContext'

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
}

vi.mock('@/components/admin/SubscriptionChip', () => ({
  SubscriptionChip: () => null,
}))

vi.mock('@/components/branches/branch-selector', () => ({
  BranchSelector: () => null,
}))

vi.mock('@/components/profile/logout-dialog', () => ({
  LogoutDialog: () => null,
}))

vi.mock('@/components/saas/organization-switcher', () => ({
  OrganizationSwitcher: () => null,
}))

vi.mock('@/components/ui/global-search', () => ({
  GlobalSearch: () => null,
}))

vi.mock('@/components/ui/notification-bell', () => ({
  NotificationBell: () => null,
}))

vi.mock('@/components/ui/theme-toggle', () => ({
  ThemeToggle: () => null,
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    isAdmin: true,
    isSuperAdmin: false,
    user: {
      id: 'admin-user',
      email: 'admin@example.com',
      role: 'admin',
      profile: { name: 'Admin User' },
    },
    signOut: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/users',
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}))

describe('Rutas Admin bajo AdminLayout', () => {
  it('muestra la navegacion actual de admin y el contenido de la ruta', () => {
    render(
      <AdminLayoutProvider>
        <AdminLayout>
          <p>Contenido de la ruta de usuarios</p>
        </AdminLayout>
      </AdminLayoutProvider>
    )

    expect(screen.getByRole('complementary', { name: 'Menu lateral' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute('href', '/admin/users')
    expect(screen.getByText('Contenido de la ruta de usuarios')).toBeInTheDocument()
  })
})
