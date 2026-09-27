import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AuthOrganization } from '@/contexts/auth-context'

/**
 * El menú del marketplace ofrecía el panel según el rol global de la cuenta.
 * Quien tiene un negocio pero figura como «cliente» —lo habitual cuando el
 * acceso viene de la membresía y no del perfil— no veía por dónde entrar.
 */

const authState: { user: Record<string, unknown> | null } = { user: null }

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: authState.user, signOut: vi.fn() }),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/marketplace',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}))
vi.mock('@/hooks/use-platform-branding', () => ({ usePlatformBranding: () => ({ branding: { name: 'Plataforma', logoUrl: '', logoHeight: 'md', logoHeightPx: null } }) }))
vi.mock('@/components/public/Favorites', () => ({ PublicFavorites: () => null }))
vi.mock('@/components/public/MarketplaceSearchBox', () => ({ MarketplaceSearchBox: () => null }))
vi.mock('@/components/pwa/install-prompt', () => ({ InstallPrompt: () => null }))
vi.mock('@/components/public/AuthModal', () => ({ AuthModal: () => null }))
vi.mock('@/components/ui/theme-toggle', () => ({ ThemeToggle: () => null }))

const { MarketplacePublicNav } = await import('@/components/public/marketplace-public-nav')

const negocio: AuthOrganization = { id: 'org-1', name: 'HCA Celular', slug: 'hca-celular', role: 'owner' }

/** El menú de la cuenta vive en el panel lateral: hay que abrirlo. */
const conUsuario = (user: Record<string, unknown> | null) => {
  authState.user = user
  const view = render(<MarketplacePublicNav />)
  fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de navegación' }))
  return view
}

describe('menú del marketplace', () => {
  it('quien tiene un negocio puede ir a su panel y a su tienda', () => {
    conUsuario({ email: 'due@hca.com.py', role: 'cliente', profile: { name: 'Hugo' }, organization: negocio })

    const panel = screen.getAllByRole('link', { name: /Ir al panel de administración/ })
    expect(panel.length).toBeGreaterThan(0)
    expect(panel[0]).toHaveAttribute('href', '/dashboard')
    expect(panel[0]).toHaveTextContent('HCA Celular')
    expect(screen.getAllByRole('link', { name: 'Ver mi tienda' })[0]).toHaveAttribute('href', '/hca-celular/inicio')
  })

  it('un cliente sin negocio no ve el panel', () => {
    conUsuario({ email: 'ana@gmail.com', role: 'cliente', profile: { name: 'Ana' }, organization: null })

    expect(screen.queryByRole('link', { name: /Ir al panel de administración/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver mi tienda' })).not.toBeInTheDocument()
  })

  /** El personal del sistema sigue entrando aunque no se resuelva su negocio. */
  it('el personal con rol de la plataforma también lo ve', () => {
    conUsuario({ email: 'tec@hca.com.py', role: 'tecnico', profile: { name: 'Tec' } })

    const panel = screen.getAllByRole('link', { name: /Ir al panel de administración/ })
    expect(panel[0]).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('link', { name: 'Ver mi tienda' })).not.toBeInTheDocument()
  })

})
