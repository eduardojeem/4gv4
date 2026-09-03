import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmpresasClient } from '@/components/public/EmpresasClient'
import type { MarketplaceOrganization } from '@/lib/public/marketplace'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/marketplace/empresas',
  useSearchParams: () => new URLSearchParams(),
}))

const mockOrganizations: MarketplaceOrganization[] = [
  {
    id: 'org-1',
    name: 'Tech Store Asuncion',
    slug: 'tech-asu',
    plan: 'PRO',
    logo_url: null,
    business_vertical: 'tecnologia',
    rubro: 'tecnologia',
    city: 'asuncion, paraguay',
    address: 'Av. Mcal. López 1234',
    created_at: '2026-01-01T00:00:00Z',
    products_count: 15,
    featured_products: [],
    review_rating_avg: 4.8,
    review_count: 12,
  },
  {
    id: 'org-2',
    name: 'CDE Celulares',
    slug: 'cde-cel',
    plan: 'BASIC',
    logo_url: null,
    business_vertical: 'tecnologia',
    rubro: 'tecnologia',
    city: 'Ciudad del Este - Alto Parana',
    address: 'Av. San Blas 500',
    created_at: '2026-01-02T00:00:00Z',
    products_count: 8,
    featured_products: [],
    review_rating_avg: 4.5,
    review_count: 6,
  },
  {
    id: 'org-3',
    name: 'Moda Encarnacion 1',
    slug: 'moda-enc-1',
    plan: 'PRO',
    logo_url: null,
    business_vertical: 'indumentaria',
    rubro: 'indumentaria',
    city: 'Encarnación',
    address: 'Costanera 200',
    created_at: '2026-01-03T00:00:00Z',
    products_count: 20,
    featured_products: [],
    review_rating_avg: 5.0,
    review_count: 4,
  },
  {
    id: 'org-4',
    name: 'Bazar Encarnacion 2',
    slug: 'bazar-enc-2',
    plan: 'BASIC',
    logo_url: null,
    business_vertical: 'hogar',
    rubro: 'hogar',
    city: 'encarnacion',
    address: 'Ruta 1',
    created_at: '2026-01-04T00:00:00Z',
    products_count: 5,
    featured_products: [],
  },
  {
    id: 'org-5',
    name: 'Ferreteria Encarnacion 3',
    slug: 'ferr-enc-3',
    plan: 'PRO',
    logo_url: null,
    business_vertical: 'ferreteria',
    rubro: 'ferreteria',
    city: 'encarnacion, paraguay',
    address: 'Av. Irrazábal',
    created_at: '2026-01-05T00:00:00Z',
    products_count: 30,
    featured_products: [],
  },
  {
    id: 'org-6',
    name: 'Farmacia Encarnacion 4',
    slug: 'farma-enc-4',
    plan: 'BASIC',
    logo_url: null,
    business_vertical: 'salud',
    rubro: 'salud',
    city: 'Encarnacion - Itapua',
    address: 'Centro',
    created_at: '2026-01-06T00:00:00Z',
    products_count: 10,
    featured_products: [],
  },
]

describe('Marketplace Empresas - Filtro por Ciudad y Normalización', () => {
  it('consolida variantes de una misma ciudad en una única opción con formato correcto', () => {
    render(<EmpresasClient organizations={mockOrganizations} />)

    const citySelect = screen.getByRole('combobox', { name: 'Filtrar por ciudad' })
    expect(citySelect).toBeInTheDocument()

    // Las 4 variantes de Encarnación ("Encarnación", "encarnacion", "encarnacion, paraguay", "Encarnacion - Itapua")
    // se agrupan en una única opción: "Encarnación (4)"
    expect(screen.getByText('Encarnación (4)')).toBeInTheDocument()
    expect(screen.getByText('Asunción (1)')).toBeInTheDocument()
    expect(screen.getByText('Ciudad del Este (1)')).toBeInTheDocument()
    expect(screen.getByText('Todas las ciudades (6)')).toBeInTheDocument()
  })

  it('filtra y muestra todas las tiendas de Encarnación sin importar cómo fue escrita la ciudad', () => {
    render(<EmpresasClient organizations={mockOrganizations} />)

    // Seleccionar Encarnación
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por ciudad' }), {
      target: { value: 'encarnacion' },
    })

    // Las 4 tiendas de Encarnación deben estar presentes
    expect(screen.getByText('Moda Encarnacion 1')).toBeInTheDocument()
    expect(screen.getByText('Bazar Encarnacion 2')).toBeInTheDocument()
    expect(screen.getByText('Ferreteria Encarnacion 3')).toBeInTheDocument()
    expect(screen.getByText('Farmacia Encarnacion 4')).toBeInTheDocument()

    // Las de Asunción y CDE no deben estar
    expect(screen.queryByText('Tech Store Asuncion')).not.toBeInTheDocument()
    expect(screen.queryByText('CDE Celulares')).not.toBeInTheDocument()

    // Chip activo muestra el nombre profesional
    expect(screen.getByText('Ciudad: Encarnación')).toBeInTheDocument()
  })

  it('permite buscar sin importar acentos en la búsqueda general', () => {
    render(<EmpresasClient organizations={mockOrganizations} />)

    fireEvent.change(screen.getByPlaceholderText('Buscar por tienda, rubro o ciudad...'), {
      target: { value: 'asuncion' },
    })

    expect(screen.getByText('Tech Store Asuncion')).toBeInTheDocument()
    expect(screen.queryByText('CDE Celulares')).not.toBeInTheDocument()
  })

  it('restablece el filtro de ciudad al hacer clic en Restablecer filtros', () => {
    render(<EmpresasClient organizations={mockOrganizations} />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por ciudad' }), {
      target: { value: 'asuncion' },
    })

    expect(screen.queryByText('CDE Celulares')).not.toBeInTheDocument()

    // Clic en restablecer
    fireEvent.click(screen.getByText('Restablecer filtros'))

    expect(screen.getByText('Tech Store Asuncion')).toBeInTheDocument()
    expect(screen.getByText('CDE Celulares')).toBeInTheDocument()
    expect(screen.getByText('Moda Encarnacion 1')).toBeInTheDocument()
  })

  it('muestra la dirección y el botón de mapa en la tarjeta cuando están disponibles', () => {
    const orgWithMap: MarketplaceOrganization[] = [
      {
        id: 'org-map-1',
        name: 'Super Tienda Encarnación',
        slug: 'super-enc',
        plan: 'PRO',
        logo_url: null,
        city: 'Encarnación',
        address: 'Av. Costanera 100',
        maps_url: 'https://maps.app.goo.gl/example123',
        created_at: '2026-01-01T00:00:00Z',
        products_count: 50,
        featured_products: [],
      },
    ]

    render(<EmpresasClient organizations={orgWithMap} />)

    expect(screen.getByText('Super Tienda Encarnación')).toBeInTheDocument()
    expect(screen.getByText('Av. Costanera 100')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mapa/i })).toBeInTheDocument()
  })

  it('abre el modal de detalles completos al hacer clic en Ver detalles', () => {
    const orgWithFullDetails: MarketplaceOrganization[] = [
      {
        id: 'org-detail-1',
        name: 'Mega Store Asunción',
        slug: 'mega-asu',
        plan: 'PRO',
        logo_url: null,
        slogan: 'Líderes en tecnología y calidad',
        description: 'Somos especialistas en venta de smartphones y accesorios con garantía oficial en todo Paraguay.',
        phone: '0981123456',
        whatsapp: '0981123456',
        email: 'ventas@megastore.com.py',
        instagram: 'megastore_py',
        facebook: 'megastorepy',
        tiktok: 'megastore_py',
        city: 'Asunción',
        address: 'Av. Santa Teresa 2500',
        maps_url: 'https://maps.app.goo.gl/mega123',
        hours: {
          weekdays: '08:00 - 18:00',
          saturday: '08:00 - 13:00',
        },
        ruc: '80012345-6',
        created_at: '2026-01-01T00:00:00Z',
        products_count: 120,
        featured_products: [
          {
            id: 'prod-1',
            name: 'iPhone 15 Pro Max',
            slug: 'iphone-15-pro-max',
            sku: 'IPH-15-PM',
            sale_price: 1200000,
            wholesale_price: null,
            in_stock: true,
            unit_measure: 'unidad',
            barcode: null,
            image: '/iphone.jpg',
            images: ['/iphone.jpg'],
            category_id: 'cat-1',
            category: { id: 'cat-1', name: 'Celulares' },
            brand: 'Apple',
            stock_quantity: 10,
            is_active: true,
            featured: true,
          } as any,
        ],
      },
    ]

    render(<EmpresasClient organizations={orgWithFullDetails} />)

    // Clic en Ver detalles
    const detailsButton = screen.getByRole('button', { name: /Ver detalles/i })
    expect(detailsButton).toBeInTheDocument()
    fireEvent.click(detailsButton)

    // El modal debe mostrar los datos completos, descripción, redes y precios
    expect(screen.getByText(/Líderes en tecnología y calidad/i)).toBeInTheDocument()
    expect(screen.getByText(/Somos especialistas en venta de smartphones/i)).toBeInTheDocument()
    expect(screen.getByText('WhatsApp')).toBeInTheDocument()
    expect(screen.getByText('Llamar')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Horarios de Atención')).toBeInTheDocument()
    expect(screen.getByText('08:00 - 18:00')).toBeInTheDocument()
    expect(screen.getByText('Redes Sociales y Canales Oficiales')).toBeInTheDocument()
    expect(screen.getByText('Instagram')).toBeInTheDocument()
    expect(screen.getByText('Facebook')).toBeInTheDocument()
    expect(screen.getByText('TikTok')).toBeInTheDocument()
    expect(screen.getByText('iPhone 15 Pro Max')).toBeInTheDocument()
    expect(screen.getByText(/1\.200\.000/)).toBeInTheDocument()
    expect(screen.getByText('Visitar Tienda Oficial')).toBeInTheDocument()

    // El RUC no debe mostrarse en el modal
    expect(screen.queryByText(/80012345-6/)).not.toBeInTheDocument()
  })
})
