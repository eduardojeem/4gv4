import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { CompanyInfo } from '@/types/website-settings'

vi.mock('next/navigation', () => ({ usePathname: () => '/synthetic/inicio' }))
vi.mock('@/hooks/usePublicCategories', () => ({
  usePublicCategories: () => ({
    categories: [
      { id: 'cat-1', name: 'Repuestos' },
      { id: 'cat-2', name: 'Herramientas' },
    ],
  }),
}))
vi.mock('@/hooks/useWebsiteSettings', () => ({
  useWebsiteSettings: () => ({
    settings: {
      offers_section: { enabled: true },
    },
  }),
}))
vi.mock('@/components/legal/LegalFooterLinks', () => ({
  LegalFooterLinks: () => <span data-testid="legal-links">Términos y condiciones</span>,
}))
vi.mock('@/components/public/StoreSocialLinks', () => ({
  StoreSocialLinks: () => <div data-testid="social-links" />,
}))

import { WholesaleFooter } from '@/components/public/wholesale/WholesaleFooter'

describe('WholesaleFooter', () => {
  it('renders distributor footer columns with real company info and categories', () => {
    const company: CompanyInfo = {
      name: 'Distribuidora Central',
      slogan: 'Líder en repuestos y accesorios',
      phone: '+595 981 123456',
      email: 'ventas@distribuidora.com',
      address: 'Av. Eusebio Ayala 1234',
    }

    render(<WholesaleFooter company={company} prefix="/synthetic" />)

    expect(screen.getByText('Distribuidora Central')).toBeDefined()
    expect(screen.getByText('Líder en repuestos y accesorios')).toBeDefined()
    expect(screen.getByText('+595 981 123456')).toBeDefined()
    expect(screen.getByText('ventas@distribuidora.com')).toBeDefined()
    expect(screen.getByText('Av. Eusebio Ayala 1234')).toBeDefined()

    // Real categories
    expect(screen.getByRole('link', { name: 'Repuestos' }).getAttribute('href')).toBe('/synthetic/productos?category_id=cat-1')
    expect(screen.getByRole('link', { name: 'Herramientas' }).getAttribute('href')).toBe('/synthetic/productos?category_id=cat-2')

    // Legal and catalog links
    expect(screen.getByTestId('legal-links')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Todos los productos' }).getAttribute('href')).toBe('/synthetic/productos')
    expect(screen.getByRole('link', { name: 'Ofertas especiales' }).getAttribute('href')).toBe('/synthetic/ofertas')
  })

  it('handles empty company gracefully without crashing', () => {
    render(<WholesaleFooter company={undefined} prefix="/synthetic" />)
    expect(screen.getByText('Tienda')).toBeDefined()
    expect(screen.queryByText('+595')).toBeNull()
  })
})
