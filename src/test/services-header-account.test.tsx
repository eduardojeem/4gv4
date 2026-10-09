import { fireEvent, render, screen, within } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/don-pepe/inicio',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/hooks/useWebsiteSettings', () => ({
  useWebsiteSettings: () => ({ settings: { company_info: { name: 'Barbería Don Pepe', slug: 'don-pepe' } } }),
}))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: state.user }) }))
vi.mock('@/contexts/theme-context', () => ({ useTheme: () => ({ isDark: false, setTheme: () => {} }) }))
vi.mock('@/components/public/cart/PublicCartButton', () => ({ PublicCartButton: () => null }))

import { ServicesSiteHeader } from '@/components/public/services/ServicesSiteHeader'

const pintar = () => render(
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <ServicesSiteHeader />
  </SWRConfig>
)

beforeEach(() => {
  state.user = null
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
})

describe('acceso a la cuenta en el encabezado de Servicios', () => {
  it('sin sesión ofrece «Ingresar»', () => {
    pintar()
    expect(screen.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/don-pepe/cliente/login')
    expect(screen.queryByRole('link', { name: /Mi perfil/ })).not.toBeInTheDocument()
  })

  it('con sesión muestra el perfil con nombre e iniciales en vez de «Ingresar»', () => {
    state.user = { id: 'u1', email: 'juan@example.com', profile: { name: 'Juan Pérez' } }
    pintar()
    const perfil = screen.getByRole('link', { name: 'Mi perfil (Juan Pérez)' })
    expect(perfil).toHaveAttribute('href', '/don-pepe/perfil')
    expect(within(perfil).getByText('Juan')).toBeInTheDocument()
    expect(within(perfil).getByText('JP')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ingresar' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }))
    const menu = screen.getByRole('navigation', { name: 'Menú' })
    expect(within(menu).getByText('Ver mi perfil')).toBeInTheDocument()
    expect(within(menu).queryByText('Ingresar')).not.toBeInTheDocument()
  })

  it('sin nombre cargado usa el del correo', () => {
    state.user = { id: 'u2', email: 'maria@example.com', profile: {} }
    pintar()
    expect(screen.getByRole('link', { name: 'Mi perfil (maria)' })).toBeInTheDocument()
  })
})
