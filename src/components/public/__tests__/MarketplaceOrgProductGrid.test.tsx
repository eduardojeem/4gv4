import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MarketplaceOrgProductGrid } from '../MarketplaceOrgProductGrid'
import type { PublicProduct } from '@/types/public'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}))

const mockProducts: PublicProduct[] = [
  {
    id: 'prod-1',
    name: 'Auriculares Inalámbricos',
    sale_price: 150000,
    has_offer: true,
    offer_price: 120000,
    image: null,
    in_stock: true,
    stock_quantity: 10,
    category: { id: 'cat-1', name: 'Tecnología' },
    sku: 'AUR-01',
    created_at: new Date().toISOString(),
  },
  {
    id: 'prod-2',
    name: 'Teclado Mecánico RGB',
    sale_price: 350000,
    has_offer: false,
    image: null,
    in_stock: true,
    stock_quantity: 5,
    category: { id: 'cat-1', name: 'Tecnología' },
    sku: 'TEC-02',
    created_at: new Date().toISOString(),
  },
  {
    id: 'prod-3',
    name: 'Mouse Gamer Pro',
    sale_price: 180000,
    has_offer: false,
    image: null,
    in_stock: true,
    stock_quantity: 8,
    category: { id: 'cat-1', name: 'Tecnología' },
    sku: 'MOU-03',
    created_at: new Date().toISOString(),
  },
]

const mockOrgs = [
  {
    id: 'org-1',
    name: 'Tech Store Paraguay',
    slug: 'tech-store',
    logo_url: null,
    city: 'Asunción',
    address: 'Av. España 1234',
    whatsapp: '595981123456',
    instagram: 'techstorepy',
    facebook: 'techstorepy',
    tiktok: 'techstorepy',
    products_count: 45,
    featured_products: mockProducts,
  },
]

const seisProductos = Array.from({ length: 6 }, (_, i) => ({
  ...mockProducts[i % mockProducts.length],
  id: `prod-six-${i}`,
  name: `Producto ${i + 1}`,
}))

describe('MarketplaceOrgProductGrid', () => {
  it('renderiza la cabecera de la empresa con datos, WhatsApp y redes sociales', () => {
    render(<MarketplaceOrgProductGrid organizations={mockOrgs} />)

    expect(screen.getByText('Tech Store Paraguay')).toBeInTheDocument()
    expect(screen.getByText('Asunción')).toBeInTheDocument()
    expect(screen.getByText('45 productos')).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
    expect(screen.getByText('Instagram')).toBeInTheDocument()
    expect(screen.getByText('Facebook')).toBeInTheDocument()
    expect(screen.getByText('TikTok')).toBeInTheDocument()
    expect(screen.getByText('Ir a la tienda')).toBeInTheDocument()
  })

  it('renderiza los productos destacados y la tarjeta de catálogo completo en las pistas del marquee', () => {
    render(<MarketplaceOrgProductGrid organizations={mockOrgs} />)

    expect(screen.getAllByText('Auriculares Inalámbricos')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Teclado Mecánico RGB')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Mouse Gamer Pro')[0]).toBeInTheDocument()
    expect(screen.getAllByText('OFERTA')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Ver todo el catálogo')[0]).toBeInTheDocument()
  })

  it('permite alternar entre movimiento y pausa con los controles de animación', () => {
    // El movimiento arranca desde seis productos: con menos la fila queda quieta.
    render(<MarketplaceOrgProductGrid organizations={[{ ...mockOrgs[0], featured_products: seisProductos }]} />)

    const pauseBtn = screen.getByLabelText('Pausar movimiento automático')
    expect(pauseBtn).toBeInTheDocument()
    expect(screen.getByText('En movimiento')).toBeInTheDocument()

    // Pausar movimiento
    fireEvent.click(pauseBtn)
    expect(screen.getByText('Pausado')).toBeInTheDocument()
    expect(screen.getByLabelText('Reanudar movimiento automático')).toBeInTheDocument()

    // Reanudar movimiento
    const playBtn = screen.getByLabelText('Reanudar movimiento automático')
    fireEvent.click(playBtn)
    expect(screen.getByText('En movimiento')).toBeInTheDocument()
  })

  /**
   * «Repetían los productos que pasaban»: la lista se rellenaba repitiéndose
   * hasta seis y después se duplicaba entera. Una tienda con un producto lo
   * mostraba doce veces, seis pegadas en pantalla.
   */
  describe('sin productos repetidos', () => {
    it('con pocos productos, cada uno aparece una sola vez y la fila no se mueve', () => {
      render(<MarketplaceOrgProductGrid organizations={mockOrgs} />)

      expect(screen.getAllByText('Auriculares Inalámbricos')).toHaveLength(1)
      expect(screen.getAllByText('Teclado Mecánico RGB')).toHaveLength(1)
      expect(screen.getAllByText('Mouse Gamer Pro')).toHaveLength(1)
      expect(screen.queryByLabelText('Pausar movimiento automático')).not.toBeInTheDocument()
    })

    it('una tienda con un solo producto lo muestra una vez, no doce', () => {
      render(
        <MarketplaceOrgProductGrid
          organizations={[{ ...mockOrgs[0], featured_products: [mockProducts[0]] }]}
        />,
      )

      expect(screen.getAllByText('Auriculares Inalámbricos')).toHaveLength(1)
    })

    /**
     * Con la fila llena sí se desplaza. El bucle necesita una copia, pero va
     * oculta a los lectores de pantalla y queda fuera de la vista.
     */
    it('con la fila llena se desplaza, y la única copia es la del bucle', () => {
      render(<MarketplaceOrgProductGrid organizations={[{ ...mockOrgs[0], featured_products: seisProductos }]} />)

      const apariciones = screen.getAllByText('Producto 1')
      expect(apariciones).toHaveLength(2)
      expect(apariciones[1].closest('[aria-hidden="true"]')).not.toBeNull()
      expect(screen.getByLabelText('Pausar movimiento automático')).toBeInTheDocument()
    })
  })

  it('abre el modal de producto al hacer clic en Detalle', () => {
    render(<MarketplaceOrgProductGrid organizations={mockOrgs} />)

    const detailButtons = screen.getAllByText('Detalle')
    fireEvent.click(detailButtons[0])

    // El modal debe renderizarse
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
