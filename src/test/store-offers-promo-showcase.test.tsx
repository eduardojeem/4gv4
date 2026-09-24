import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { StoreOffersPromoShowcase } from '@/components/public/inicio/StoreOffersPromoShowcase'
import type { PublicProduct } from '@/types/public'

let mockSwrData: PublicProduct[] | null = null
let mockSwrLoading = false

vi.mock('swr', () => ({
  __esModule: true,
  default: () => ({
    data: mockSwrData,
    error: undefined,
    isLoading: mockSwrLoading,
  }),
}))

/* eslint-disable @next/next/no-img-element -- The next/image test double must render a native image. */
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))
/* eslint-enable @next/next/no-img-element */

vi.mock('next/navigation', () => ({
  usePathname: () => '/4g-celulares/inicio',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('@/components/public/Favorites', () => ({
  FavoriteButton: () => <button aria-label="Favorito">Fav</button>,
}))

const sampleProducts: PublicProduct[] = [
  {
    id: 'prod-1',
    name: 'Batería iPhone 13 Original',
    slug: 'bateria-iphone-13-original',
    sku: 'BAT-IP13',
    description: 'Batería 100% de salud original',
    sale_price: 300000,
    offer_price: 200000, // 33% off
    has_offer: true,
    image: '/img/battery.jpg',
    in_stock: true,
    stock_quantity: 10,
    featured: true,
    hide_price: false,
    device_brand: 'Apple',
    device_models: ['iPhone 13', 'iPhone 13 Pro'],
    category_id: 'cat-repuestos',
    category: {
      id: 'cat-repuestos',
      name: 'Repuestos & Baterías',
    },
  },
  {
    id: 'prod-2',
    name: 'Funda Silicona MagSafe',
    slug: 'funda-silicona-magsafe',
    sku: 'ACC-MAG-01',
    description: 'Funda protectora',
    sale_price: 100000,
    offer_price: 80000, // 20% off
    has_offer: true,
    image: '/img/case.jpg',
    in_stock: true,
    stock_quantity: 5,
    featured: false,
    hide_price: false,
    category_id: 'cat-accesorios',
    category: {
      id: 'cat-accesorios',
      name: 'Accesorios',
    },
  },
  {
    id: 'prod-3',
    name: 'Módulo Premium Mayorista',
    slug: 'modulo-premium-mayorista',
    sku: 'MOD-MAY-01',
    description: 'Precio exclusivo talleres',
    sale_price: 500000,
    offer_price: 400000,
    has_offer: true,
    image: '/img/modulo.jpg',
    in_stock: true,
    stock_quantity: 8,
    featured: false,
    hide_price: true, // precio oculto para público
    device_brand: 'Samsung',
    device_models: ['Galaxy S23'],
    category_id: 'cat-repuestos',
    category: {
      id: 'cat-repuestos',
      name: 'Repuestos & Baterías',
    },
  },
]

describe('StoreOffersPromoShowcase', () => {
  beforeEach(() => {
    mockSwrData = sampleProducts
    mockSwrLoading = false
  })

  it('renderiza la vitrina con datos del comercio, badge oficial e información real de la empresa', () => {
    render(
      <StoreOffersPromoShowcase
        companyInfo={{
          name: '4G Celulares Store',
          logo_url: '/logo-4g.png',
          phone: '+5950983123456',
          city: 'Asunción',
          address: 'Av. Eusebio Ayala 1234',
          hours: {
            weekdays: 'Lun - Vie: 08:00 - 18:00',
            saturday: 'Sáb: 08:00 - 13:00',
          },
          instagram: '4gstore',
        }}
        tenantPrefix="/4g-celulares"
        tenantSlug="4g-celulares"
        phoneClean="595983123456"
      />
    )

    // Nombre de la tienda
    expect(screen.getAllByText('4G Celulares Store').length).toBeGreaterThan(0)

    // Insignia oficial y ciudad en el header de la tarjeta
    expect(screen.getByText('Tienda Oficial')).toBeInTheDocument()
    expect(screen.getAllByText(/Asunción/).length).toBeGreaterThan(0)

    // Información real de la empresa en la tarjeta promocional
    expect(screen.getByText('Promociones del Comercio')).toBeInTheDocument()
    // La dirección no ensucia el bloque promocional
    expect(screen.queryByText(/Av\. Eusebio Ayala 1234/)).not.toBeInTheDocument()
    // Todos los horarios limpios sin duplicar prefijo
    expect(screen.getByText('08:00 - 18:00')).toBeInTheDocument()
    expect(screen.getByText('08:00 - 13:00')).toBeInTheDocument()
    // WhatsApp formateado limpiamente
    expect(screen.getByText('WhatsApp:')).toBeInTheDocument()
    expect(screen.getByText('(0983) 123-456')).toBeInTheDocument()
    // Redes sociales
    expect(screen.getAllByText('@4gstore').length).toBeGreaterThan(0)

    // Segundo carrusel presente para aprovechar el espacio vertical en pantallas grandes
    expect(screen.getByText('Destacado 2')).toBeInTheDocument()
  })

  it('muestra productos en oferta con porcentajes de ahorro y compatibilidad de modelo', () => {
    render(
      <StoreOffersPromoShowcase
        companyInfo={{ name: '4G Celulares' }}
        tenantPrefix="/4g-celulares"
        tenantSlug="4g-celulares"
        phoneClean="595983123456"
      />
    )

    // Nombres de los productos
    expect(screen.getAllByText('Batería iPhone 13 Original').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Funda Silicona MagSafe').length).toBeGreaterThan(0)

    // Compatibilidad de dispositivo
    expect(screen.getAllByText('Para Apple · iPhone 13, iPhone 13 Pro').length).toBeGreaterThan(0)

    // Descuentos en productos
    expect(screen.getAllByText('-33% OFF').length).toBeGreaterThan(0)
    expect(screen.getAllByText('-20% OFF').length).toBeGreaterThan(0)

    // Ahorro monetario en guaraníes
    expect(screen.getAllByText(/Ahorrás Gs\. 100\.000/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Ahorrás Gs\. 20\.000/).length).toBeGreaterThan(0)
  })

  it('permite navegar las ofertas en el carrusel de la tarjeta promocional con flechas y dots', () => {
    render(
      <StoreOffersPromoShowcase
        companyInfo={{ name: '4G Celulares' }}
        tenantPrefix="/4g-celulares"
        tenantSlug="4g-celulares"
        phoneClean="595983123456"
      />
    )

    // El carrusel muestra inicialmente la primera oferta y tiene botón siguiente
    const nextBtn = screen.getByRole('button', { name: 'Siguiente oferta' })
    expect(nextBtn).toBeInTheDocument()

    // Avanza a la siguiente oferta en el carrusel
    fireEvent.click(nextBtn)

    // Botones de navegación y selector de oferta
    expect(screen.getByRole('button', { name: 'Oferta anterior' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ir a oferta 1' })).toBeInTheDocument()
  })

  it('reinicia el carrusel al elegir otra categoría', () => {
    render(
      <StoreOffersPromoShowcase
        companyInfo={{ name: '4G Celulares' }}
        tenantPrefix="/4g-celulares"
        tenantSlug="4g-celulares"
        phoneClean="595983123456"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente oferta' }))
    expect(screen.getByTitle('Funda Silicona MagSafe')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Repuestos & Baterías/ }))

    expect(screen.getByTestId('active-offer-name')).toHaveTextContent('Batería iPhone 13 Original')
  })

  it('oculta el precio y muestra "Precio a consultar" en productos con hide_price', () => {
    render(
      <StoreOffersPromoShowcase
        companyInfo={{ name: '4G Celulares' }}
        tenantPrefix="/4g-celulares"
        tenantSlug="4g-celulares"
        phoneClean="595983123456"
      />
    )

    // Producto con hide_price
    expect(screen.getByText('Módulo Premium Mayorista')).toBeInTheDocument()
    expect(screen.getByText('Precio a consultar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ver el precio de Módulo Premium Mayorista/ })).toBeInTheDocument()

    // El precio de 400.000 no debe estar en la vista
    expect(screen.queryByText(/400\.000/)).not.toBeInTheDocument()
  })

  it('permite filtrar por categorías que tengan ofertas activas', () => {
    render(
      <StoreOffersPromoShowcase
        companyInfo={{ name: '4G Celulares' }}
        tenantPrefix="/4g-celulares"
        tenantSlug="4g-celulares"
        phoneClean="595983123456"
      />
    )

    // Chips de categorías
    const catAccesoriosBtn = screen.getByRole('button', { name: /Accesorios/ })
    expect(catAccesoriosBtn).toBeInTheDocument()

    // Clic en Accesorios
    fireEvent.click(catAccesoriosBtn)

    // Solo se debe mostrar Funda Silicona MagSafe y desaparecer Batería iPhone 13 Original
    expect(screen.getAllByText('Funda Silicona MagSafe').length).toBeGreaterThan(0)
    expect(screen.queryByText('Batería iPhone 13 Original')).not.toBeInTheDocument()
  })

  it('retorna null sin romper la página cuando no hay productos en oferta', () => {
    mockSwrData = []
    mockSwrLoading = false

    const { container } = render(
      <StoreOffersPromoShowcase
        companyInfo={{ name: '4G Celulares' }}
        tenantPrefix="/4g-celulares"
        tenantSlug="4g-celulares"
        phoneClean="595983123456"
      />
    )

    expect(container.firstChild).toBeNull()
  })
})
