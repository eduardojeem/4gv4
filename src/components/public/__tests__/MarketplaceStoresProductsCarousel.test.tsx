import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarketplaceStoresProductsCarousel } from '../MarketplaceStoresProductsCarousel'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

describe('MarketplaceStoresProductsCarousel', () => {
  const mockOrganizations: MarketplaceOrganization[] = [
    {
      id: 'org-1',
      name: 'Mega Store Cell',
      slug: 'mega-store',
      logo_url: 'https://example.com/logo.png',
      rubro: 'tecnologia',
      city: 'Asunción',
      whatsapp: '+595 981 123456',
      slogan: 'Líder en smartphones y repuestos',
      products_count: 5,
      featured_products: [
        {
          id: 'prod-1',
          name: 'Pantalla iPhone 13 Pro',
          slug: 'pantalla-iphone-13-pro',
          sale_price: 350000,
          offer_price: null,
          has_offer: false,
          image: '/iphone.jpg',
          organization_id: 'org-1',
        } as unknown as MarketplaceOrganization['featured_products'][0],
        {
          id: 'prod-2',
          name: 'Cargador Rápido 25W',
          slug: 'cargador-rapido-25w',
          sale_price: 120000,
          offer_price: 99000,
          has_offer: true,
          image: '/cargador.jpg',
          organization_id: 'org-1',
        } as unknown as MarketplaceOrganization['featured_products'][0],
      ],
      review_rating_avg: 4.8,
      review_count: 15,
    } as unknown as MarketplaceOrganization,
    {
      id: 'org-2',
      name: 'Moda Urbana',
      slug: 'moda-urbana',
      logo_url: null,
      rubro: 'indumentaria',
      city: 'Encarnación',
      whatsapp: null,
      products_count: 3,
      featured_products: [
        {
          id: 'prod-3',
          name: 'Remera Oversize',
          slug: 'remera-oversize',
          sale_price: 85000,
          offer_price: null,
          has_offer: false,
          image: null,
          organization_id: 'org-2',
        } as unknown as MarketplaceOrganization['featured_products'][0],
      ],
    } as unknown as MarketplaceOrganization,
  ]

  it('renders section title and store cards with products and links', () => {
    render(<MarketplaceStoresProductsCarousel organizations={mockOrganizations} />)

    // Heading
    expect(screen.getByText('Tiendas destacadas y sus productos')).toBeDefined()
    expect(screen.getByRole('link', { name: /Ver todas/i })).toBeDefined()

    // Store 1
    expect(screen.getByText('Mega Store Cell')).toBeDefined()
    expect(screen.getByText('Líder en smartphones y repuestos')).toBeDefined()
    expect(screen.getByText('Pantalla iPhone 13 Pro')).toBeDefined()
    expect(screen.getByText('Cargador Rápido 25W')).toBeDefined()
    expect(screen.getByText('Oferta')).toBeDefined()

    // Store 1 actions
    const megaStoreLinks = screen.getAllByRole('link', { name: /Mega Store Cell/i })
    expect(megaStoreLinks.length).toBeGreaterThan(0)
    expect(megaStoreLinks[0].getAttribute('href')).toBe('/mega-store/inicio')

    // WhatsApp action for Store 1
    expect(screen.getByRole('link', { name: /WhatsApp/i })).toBeDefined()

    // Store 2
    expect(screen.getByText('Moda Urbana')).toBeDefined()
    expect(screen.getByText('Remera Oversize')).toBeDefined()
  })

  it('handles empty organizations array gracefully without crashing', () => {
    const { container } = render(<MarketplaceStoresProductsCarousel organizations={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('supports custom title, exploreAllHref and exploreAllLabel', () => {
    render(
      <MarketplaceStoresProductsCarousel
        organizations={mockOrganizations}
        title="Tiendas del directorio"
        exploreAllHref="#directorio"
        exploreAllLabel="Ver directorio completo"
      />
    )

    expect(screen.getByText('Tiendas del directorio')).toBeDefined()
    const link = screen.getByRole('link', { name: /Ver directorio completo/i })
    expect(link.getAttribute('href')).toBe('#directorio')
  })

  it('filters stores interactively using the search bar', () => {
    render(<MarketplaceStoresProductsCarousel organizations={mockOrganizations} />)

    const searchInput = screen.getByPlaceholderText(/Buscar tiendas o comercios/i)
    expect(searchInput).toBeDefined()

    // Ambas tiendas están visibles al inicio
    expect(screen.getByText('Mega Store Cell')).toBeDefined()
    expect(screen.getByText('Moda Urbana')).toBeDefined()

    // Filtrar por término que solo coincide con Moda Urbana
    fireEvent.change(searchInput, { target: { value: 'Moda' } })
    expect(screen.getByText('Moda Urbana')).toBeDefined()
    expect(screen.queryByText('Mega Store Cell')).toBeNull()

    // Filtrar por término de producto de Mega Store Cell (iPhone)
    fireEvent.change(searchInput, { target: { value: 'iPhone' } })
    expect(screen.getByText('Mega Store Cell')).toBeDefined()
    expect(screen.queryByText('Moda Urbana')).toBeNull()

    // Limpiar campo con el botón X
    const clearBtn = screen.getByLabelText(/Limpiar búsqueda/i)
    fireEvent.click(clearBtn)
    expect(screen.getByText('Mega Store Cell')).toBeDefined()
    expect(screen.getByText('Moda Urbana')).toBeDefined()
  })

  it('shows empty state when no store matches search and allows resetting', () => {
    render(<MarketplaceStoresProductsCarousel organizations={mockOrganizations} />)

    const searchInput = screen.getByPlaceholderText(/Buscar tiendas o comercios/i)
    fireEvent.change(searchInput, { target: { value: 'inexistenteXYZ' } })

    expect(screen.getByText(/No encontramos tiendas para "inexistenteXYZ"/i)).toBeDefined()
    expect(screen.queryByText('Mega Store Cell')).toBeNull()

    // Click en botón restablecer búsqueda
    const resetBtn = screen.getByRole('button', { name: /Restablecer búsqueda/i })
    fireEvent.click(resetBtn)

    expect(screen.getByText('Mega Store Cell')).toBeDefined()
    expect(screen.getByText('Moda Urbana')).toBeDefined()
  })

  it('renders side navigation buttons for moving the carousel', () => {
    render(<MarketplaceStoresProductsCarousel organizations={mockOrganizations} />)

    const prevBtn = screen.getByLabelText(/Tienda anterior/i)
    const nextBtn = screen.getByLabelText(/Siguiente tienda/i)

    expect(prevBtn).toBeDefined()
    expect(nextBtn).toBeDefined()
  })
})
