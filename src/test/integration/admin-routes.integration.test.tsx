import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
let AdminLayout: any

let authState = { user: { id: 'u1' }, loading: false, isAdmin: true }


vi.mock('../../modules/admin/components/AdminGuard', () => ({
  default: ({ children }: any) => <>{children}</>
}))

vi.mock('../../modules/admin/components/AdminSidebar', () => ({
  default: () => <div>Usuarios</div>
}))

vi.mock('../../modules/admin/components/AdminBreadcrumbs', () => ({
  default: () => <div>breadcrumbs users</div>
}))

vi.mock('../../modules/admin/components/AdminNotificationsBar', () => ({
  default: () => <div>notificaciones</div>
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => authState
}))

vi.mock('../../../contexts/auth-context', () => ({
  useAuth: () => authState
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/users'
}))

describe('Rutas Admin bajo AdminLayout', () => {
  beforeEach(() => {
    authState = { user: { id: 'u1' }, loading: false, isAdmin: true }
  })

  beforeEach(async () => {
    const mod = await import('../../modules/admin/layouts/AdminLayout')
    AdminLayout = mod.default
  })

  it('renderiza sidebar, breadcrumbs y contenido para admin', () => {
    const { container } = render(
      <AdminLayout>
        <div data-testid="child">Contenido</div>
      </AdminLayout>
    )

    expect(screen.getByText('Usuarios')).toBeTruthy()
    expect(container.textContent?.includes('users')).toBe(true)
    expect(screen.getByTestId('child')).toBeTruthy()
  })

  // Acceso se valida en pruebas unitarias de AdminGuard
})