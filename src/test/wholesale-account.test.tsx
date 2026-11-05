import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WebsiteSettings } from '@/types/website-settings'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'

const authState = vi.hoisted(() => ({
  user: null as { email?: string; id?: string } | null,
  signOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/test-store/inicio',
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: authState.user,
    signOut: authState.signOut,
    loading: false,
  }),
}))

vi.mock('@/hooks/usePublicCategories', () => ({
  usePublicCategories: () => ({
    categories: [
      { id: 'cat-1', name: 'Electrónica', subcategories: [] },
    ],
  }),
}))

vi.mock('@/components/public/cart/PublicCartButton', () => ({
  PublicCartButton: () => <button>Carrito</button>,
}))

vi.mock('swr', () => ({
  default: () => ({ data: [], error: undefined, isLoading: false }),
}))

vi.mock('@/components/public/inicio/PromotionalCarousel', () => ({
  PromotionalCarousel: () => null,
}))

vi.mock('@/components/public/inicio/StoreTrustBar', () => ({
  StoreTrustBar: () => null,
}))

vi.mock('@/components/public/inicio/StoreOffersPromoShowcase', () => ({
  StoreOffersPromoShowcase: () => null,
}))

import { WholesaleHeader } from '@/components/public/wholesale/WholesaleHeader'
import { WholesaleFooter } from '@/components/public/wholesale/WholesaleFooter'
import { WholesaleHome } from '@/components/public/wholesale/WholesaleHome'

describe('Wholesale account section improvements', () => {
  const baseSettings: WebsiteSettings = {
    company_info: {
      name: 'Distribuidora Mayorista Py',
      phone: '+595 981 999888',
      email: 'ventas@mayorista.com.py',
      showTopBar: true,
    },
    brands_section: { enabled: false },
    offers_section: { enabled: false },
  } as unknown as WebsiteSettings

  const capabilities: StorefrontCapabilities = {
    hasCatalog: true,
    hasServices: false,
    hasCart: true,
  } as unknown as StorefrontCapabilities

  beforeEach(() => {
    authState.user = null
    authState.signOut.mockReset()
  })

  it('renders login and registration options when user is not signed in', () => {
    render(<WholesaleHeader settings={baseSettings} />)

    // Top utility bar has both login and register options
    const loginLinks = screen.getAllByRole('link', { name: /Iniciar sesión/i })
    expect(loginLinks.length).toBeGreaterThan(0)
    expect(loginLinks[0].getAttribute('href')).toContain('/cliente/login')

    const registerLinks = screen.getAllByRole('link', { name: /Registrate como cliente|Crear cuenta/i })
    expect(registerLinks.length).toBeGreaterThan(0)
    expect(registerLinks[0].getAttribute('href')).toContain('/cliente/registro')

    // Main header has account access button
    const accountBtn = screen.getByRole('button', { name: /Acceso a Mi cuenta/i })
    expect(accountBtn).toBeDefined()
  })

  it('renders user details, profile link, and sign-out option when user is signed in', () => {
    authState.user = {
      id: 'usr-123',
      email: 'carlos@comercio.com.py',
      role: 'cliente',
      profile: {
        name: 'Carlos Benítez',
        avatar_url: '',
      },
    }

    render(<WholesaleHeader settings={baseSettings} />)

    // Greeting in top bar
    expect(screen.getByText(/Hola, Carlos/i)).toBeDefined()

    // Sign out button exists
    const signOutButtons = screen.getAllByRole('button', { name: /Cerrar sesión/i })
    expect(signOutButtons.length).toBeGreaterThan(0)

    fireEvent.click(signOutButtons[0])
    expect(authState.signOut).toHaveBeenCalledTimes(1)
  })

  it('renders wholesale registration portal callout in WholesaleHome', () => {
    render(
      <WholesaleHome
        settings={baseSettings}
        branches={[]}
        capabilities={capabilities}
      />
    )

    // Account callout for B2B customers
    expect(screen.getByText('¿Comprás por mayor o revendés en tu negocio?')).toBeDefined()
    expect(screen.getByRole('link', { name: /Crear cuenta de cliente/i }).getAttribute('href')).toContain('/cliente/registro')
    expect(screen.getByRole('link', { name: /Ya tengo cuenta/i }).getAttribute('href')).toContain('/cliente/login')
  })

  it('renders client account links in WholesaleFooter', () => {
    render(
      <WholesaleFooter
        company={baseSettings.company_info}
        prefix="/test-store"
      />
    )

    expect(screen.getByRole('link', { name: /Registrarse como cliente/i }).getAttribute('href')).toContain('/cliente/registro')
    expect(screen.getByRole('link', { name: /Mis pedidos/i }).getAttribute('href')).toContain('/test-store/perfil?tab=orders')
  })
})
