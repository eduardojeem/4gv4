import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SuperAdminShell } from './superadmin-shell'

const navigationState = vi.hoisted(() => ({ pathname: '/superadmin/organizations' }))

vi.mock('next/navigation', () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt ?? ''} {...props} />,
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    user: { profile: { name: 'Eduardo' } },
  }),
}))

vi.mock('@/components/ui/theme-toggle', () => ({
  ThemeToggle: () => <button type="button" aria-label="Cambiar tema" />,
}))

describe('SuperAdminShell', () => {
  beforeEach(() => {
    navigationState.pathname = '/superadmin/organizations'
  })

  it('organizes the global controls around a clearly labelled workspace', () => {
    render(
      <SuperAdminShell userEmail="admin@example.com">
        <h1>Organizaciones</h1>
      </SuperAdminShell>
    )

    expect(screen.getAllByRole('navigation', { name: 'Navegación principal del superadmin' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('banner', { name: 'Barra de control del superadmin' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Centro de control' })).toHaveAttribute('href', '/superadmin')
    expect(screen.getByRole('button', { name: 'Buscar en el centro de control' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAccessibleName('Contenido de Organizaciones')
  })

  it('presents the robot as lightweight guidance instead of an unsupported chatbot', () => {
    render(
      <SuperAdminShell userEmail="admin@example.com">
        <p>Contenido</p>
      </SuperAdminShell>
    )

    expect(screen.getAllByRole('complementary', { name: 'Asistente del centro de control' }).length).toBeGreaterThan(0)
    expect(screen.getAllByAltText('Robot asistente de SERVIX 360').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /hablar|chat|preguntar/i })).not.toBeInTheDocument()
  })

  it('keeps only the group for the current route expanded after navigation', async () => {
    const user = userEvent.setup()
    const view = render(
      <SuperAdminShell userEmail="admin@example.com">
        <p>Contenido</p>
      </SuperAdminShell>
    )

    expect(screen.getByRole('button', { name: 'Organizaciones' })).toHaveAttribute('aria-expanded', 'true')
    const billingGroup = screen
      .getAllByRole('button', { name: 'Facturacion' })
      .find((button) => button.getAttribute('aria-expanded') === 'false')

    expect(billingGroup).toBeDefined()
    await user.click(billingGroup!)

    expect(screen.getByRole('button', { name: 'Organizaciones' })).toHaveAttribute('aria-expanded', 'false')
    expect(billingGroup).toHaveAttribute('aria-expanded', 'true')

    navigationState.pathname = '/superadmin/monitoring'
    view.rerender(
      <SuperAdminShell userEmail="admin@example.com">
        <p>Contenido</p>
      </SuperAdminShell>
    )

    expect(screen.getAllByRole('button', { name: 'Facturacion' }).find(
      (button) => button.getAttribute('aria-expanded') === 'false'
    )).toBeDefined()
    expect(screen.getByRole('button', { name: /Monitoreo/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('groups secondary system destinations under more tools', async () => {
    const user = userEvent.setup()
    render(
      <SuperAdminShell userEmail="admin@example.com">
        <p>Contenido</p>
      </SuperAdminShell>
    )

    const toolsGroup = screen.getByRole('button', { name: 'Más herramientas' })
    await user.click(toolsGroup)

    expect(screen.getByRole('link', { name: 'Auditoría' })).toHaveAttribute('href', '/superadmin/audit-logs')
    expect(screen.getByRole('link', { name: 'Diagnóstico' })).toHaveAttribute('href', '/superadmin/diagnostic')
    expect(screen.getByRole('link', { name: 'Mantenimiento' })).toHaveAttribute('href', '/superadmin/maintenance')
  })
})
