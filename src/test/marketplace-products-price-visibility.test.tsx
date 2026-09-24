import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarketplaceOrgProductGrid } from '@/components/public/MarketplaceOrgProductGrid'
import { MarketplaceProductCarousel } from '@/components/public/MarketplaceProductCarousel'
import type { PublicProduct } from '@/types/public'
import type { MarketplaceProduct } from '@/lib/public/marketplace'

/* eslint-disable @next/next/no-img-element -- The next/image test double must render a native image. */
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
/* eslint-enable @next/next/no-img-element */
vi.mock('next/navigation', () => ({ usePathname: () => '/marketplace' }))
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => ({ user: null }) }))

const mockProductWithPriceHidden: PublicProduct = {
  id: 'prod-hidden-1',
  name: 'Módulo Display OLED',
  slug: 'modulo-display-oled',
  sku: 'MOD-OLED-01',
  description: 'Display de alta calidad',
  sale_price: 350000,
  offer_price: null,
  has_offer: false,
  image: '/img/display.jpg',
  in_stock: true,
  stock_quantity: 5,
  featured: false,
  hide_price: true,
  device_brand: 'Apple',
  device_models: ['iPhone 12', 'iPhone 12 Pro'],
}

const mockOrg = {
  id: 'org-tech',
  name: 'Repuestos Tech',
  slug: 'repuestos-tech',
  logo_url: null,
  city: 'Ciudad del Este',
  whatsapp: '0983 555 444',
  products_count: 1,
  featured_products: [mockProductWithPriceHidden],
}

describe('Marketplace: lógica de productos para clientes (hide_price y compatibilidad)', () => {
  it('en MarketplaceOrgProductGrid oculta el precio, muestra Precio a consultar y compatibilidad', () => {
    render(<MarketplaceOrgProductGrid organizations={[mockOrg]} />)

    // Compatibilidad de dispositivo
    expect(screen.getAllByText('Para Apple · iPhone 12, iPhone 12 Pro').length).toBeGreaterThan(0)

    // No debe mostrar el precio numérico
    expect(screen.queryByText(/350\.000/)).not.toBeInTheDocument()

    // Muestra Precio a consultar
    expect(screen.getAllByText('Precio a consultar').length).toBeGreaterThan(0)

    // Botón de acceso / explicación para mayoristas
    expect(screen.getAllByRole('button', { name: /Ver el precio de Módulo Display OLED/ }).length).toBeGreaterThan(0)

    // Botón de WhatsApp "Preguntar"
    const whatsappLinks = screen.getAllByRole('link', { name: /Preguntar/i })
    expect(whatsappLinks.length).toBeGreaterThan(0)
    const href = decodeURIComponent(whatsappLinks[0].getAttribute('href')!)
    expect(href).toContain('wa.me/595983555444')
    expect(href).toContain('Quiero consultar el precio de este producto:')
    expect(href).toContain('*Módulo Display OLED*')
    expect(href).not.toContain('350.000')
  })

  it('en MarketplaceProductCarousel oculta el precio y muestra compatibilidad', () => {
    const carouselProduct: MarketplaceProduct = {
      ...mockProductWithPriceHidden,
      organization_id: mockOrg.id,
      organization_name: mockOrg.name,
      organization_slug: mockOrg.slug,
      organization_contact: {
        whatsapp: mockOrg.whatsapp,
        phone: null,
        instagram: null,
        facebook: null,
        tiktok: null,
      },
    }

    render(
      <MarketplaceProductCarousel
        title="Ofertas de la Semana"
        products={[carouselProduct]}
        enableAutoPlay={false}
      />
    )

    // Compatibilidad
    expect(screen.getByText('Para Apple · iPhone 12, iPhone 12 Pro')).toBeInTheDocument()

    // Sin precio numérico
    expect(screen.queryByText(/350\.000/)).not.toBeInTheDocument()

    // Precio a consultar
    expect(screen.getByText('Precio a consultar')).toBeInTheDocument()

    // Botón de WhatsApp "Preguntar"
    const whatsappLink = screen.getByRole('link', { name: /Preguntar/i })
    const href = decodeURIComponent(whatsappLink.getAttribute('href')!)
    expect(href).toContain('Quiero consultar el precio de este producto:')
    expect(href).toContain('*Módulo Display OLED*')
    expect(href).not.toContain('350.000')
  })
})
