import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { WebsiteSettings } from '@/types/website-settings'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'

vi.mock('next/navigation', () => ({
  usePathname: () => '/test-store/inicio',
}))

vi.mock('swr', () => ({
  default: () => ({ data: [], error: undefined, isLoading: false }),
}))

vi.mock('@/hooks/usePublicCategories', () => ({
  usePublicCategories: () => ({
    categories: [
      {
        id: 'cat-herramientas',
        name: 'Herramientas',
        subcategories: [
          { id: 'sub-manuales', name: 'Manuales' },
          { id: 'sub-electricas', name: 'Eléctricas' },
        ],
      },
      {
        id: 'cat-bazar',
        name: 'Bazar',
        subcategories: [],
      },
    ],
  }),
}))

vi.mock('@/components/public/cart/PublicCartButton', () => ({
  PublicCartButton: () => <button>Carrito</button>,
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
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
import { WholesaleHome } from '@/components/public/wholesale/WholesaleHome'

describe('Wholesale submenus and brands section', () => {
  const baseSettings: WebsiteSettings = {
    company_info: {
      name: 'Distribuidora Central',
      phone: '+595 981 123456',
      email: 'ventas@distribuidora.com.py',
    },
    brands_section: {
      enabled: true,
      title: 'Nuestras Marcas Mayoristas',
      showOnHome: true,
      items: [
        { id: 'b1', name: 'Stanley', active: true },
        { id: 'b2', name: 'DeWalt', active: true },
        { id: 'b3', name: 'Bosch', active: true },
      ],
    },
    offers_section: { enabled: true },
  } as unknown as WebsiteSettings

  const capabilities: StorefrontCapabilities = {
    hasCatalog: true,
    hasServices: false,
    hasCart: true,
  } as unknown as StorefrontCapabilities

  it('renders category submenus and brands dropdown in WholesaleHeader', () => {
    render(<WholesaleHeader settings={baseSettings} />)

    // Brands button in header
    expect(screen.getByRole('button', { name: /Marcas/i })).toBeDefined()

    // Subcategories exist in mega-menu and flyout
    const manualesLinks = screen.getAllByRole('link', { name: /Manuales/i })
    expect(manualesLinks.length).toBeGreaterThan(0)
    expect(manualesLinks[0].getAttribute('href')).toContain('category_id=sub-manuales')

    // Brand link in header
    const stanleyHeaderLinks = screen.getAllByRole('link', { name: /Stanley/i })
    expect(stanleyHeaderLinks.length).toBeGreaterThan(0)
    expect(stanleyHeaderLinks[0].getAttribute('href')).toContain('marca=Stanley')
  })

  it('renders interactive brands section with submenus and category chips in WholesaleHome', () => {
    render(
      <WholesaleHome
        settings={baseSettings}
        branches={[]}
        capabilities={capabilities}
      />
    )

    // Title
    expect(screen.getByText('Nuestras Marcas Mayoristas')).toBeDefined()

    // Tablist with brands
    const stanleyTab = screen.getByRole('tab', { name: /Stanley/i })
    const dewaltTab = screen.getByRole('tab', { name: /DeWalt/i })
    expect(stanleyTab).toBeDefined()
    expect(dewaltTab).toBeDefined()

    // Active brand submenu initially shows Stanley
    expect(screen.getByRole('link', { name: /Ver catálogo de Stanley/i })).toBeDefined()
    expect(screen.getByText(/Submenú por departamento \(Stanley\)/i)).toBeDefined()

    // Submenu rubro link
    const rubroLink = screen.getByRole('link', { name: 'Herramientas en Stanley' })
    expect(rubroLink.getAttribute('href')).toContain('marca=Stanley')
    expect(rubroLink.getAttribute('href')).toContain('category_id=cat-herramientas')

    // Switch active brand tab to DeWalt
    fireEvent.click(dewaltTab)
    expect(screen.getByRole('link', { name: /Ver catálogo de DeWalt/i })).toBeDefined()
    expect(screen.getByText(/Submenú por departamento \(DeWalt\)/i)).toBeDefined()
    const dewaltRubroLink = screen.getByRole('link', { name: 'Herramientas en DeWalt' })
    expect(dewaltRubroLink.getAttribute('href')).toContain('marca=DeWalt')

    // Category chips in "Explorá por categoría"
    const subManualesChip = screen.getByRole('link', { name: 'Manuales' })
    expect(subManualesChip.getAttribute('href')).toContain('category_id=sub-manuales')
  })
})
