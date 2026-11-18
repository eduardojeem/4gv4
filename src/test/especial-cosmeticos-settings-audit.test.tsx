import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EspecialCosmeticosHome } from '@/components/public/especial-cosmeticos/EspecialCosmeticosHome'
import type { WebsiteSettings } from '@/types/website-settings'
import type { BranchLocationData } from '@/components/public/inicio/BranchLocations'

vi.mock('next/navigation', () => ({
  usePathname: () => '/paravos/inicio',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock('swr', () => ({
  default: (key: string | null) => {
    if (typeof key === 'string' && key.includes('has_offer=true')) {
      return {
        data: [
          {
            id: 'prod-offer-1',
            name: 'Labial Matte Red Rose',
            sale_price: 85000,
            offer_price: 60000,
            has_offer: true,
            in_stock: true,
            is_active: true,
            stock_quantity: 10,
            promotion_name: 'Super Descuento',
          },
        ],
        isLoading: false,
        error: null,
      }
    }
    return {
      data: [
        {
          id: 'prod-1',
          name: 'Sérum Rejuvenecedor',
          sale_price: 150000,
          offer_price: null,
          in_stock: true,
          is_active: true,
          stock_quantity: 5,
        },
      ],
      isLoading: false,
      error: null,
    }
  },
}))

vi.mock('@/hooks/usePublicCategories', () => ({
  usePublicCategories: () => ({
    categories: [{ id: 'cat-1', name: 'Rostro', productCount: 4 }],
    isLoading: false,
  }),
}))

const baseSettings: WebsiteSettings = {
  company_info: {
    name: 'Para Vos Cosméticos',
    phone: '0981123456',
    email: 'contacto@paravos.com',
    address: 'Av. San Martín 1234, Asunción',
    brandColor: 'rose',
    storefrontStyle: 'especial-cosmeticos',
    hours: { weekdays: '08:00 a 19:00', saturday: '08:00 a 13:00', sunday: '' },
  },
  hero_content: {
    enabled: true,
    badge: 'Edición Limitada',
    title: 'Belleza y Cuidado Natural',
    subtitle: 'Los mejores cosméticos cruelty-free traídos especialmente para vos.',
    ctaPrimaryText: 'Ver Productos Exclusivos',
  },
  promotional_carousel: {
    enabled: false,
    slides: [],
  },
  offers_section: {
    enabled: true,
    title: 'Rebajas Imperdibles del Mes',
    eyebrow: 'Ofertas Flash',
    subtitle: 'Aprovechá hasta fin de mes o agotar stock.',
  },
  brands_section: {
    enabled: true,
    title: 'Nuestras Marcas Favoritas',
    subtitle: 'Productos 100% auténticos',
    items: [
      { id: 'b1', name: 'L’Oréal Paris', active: true },
      { id: 'b2', name: 'Maybelline', active: true },
    ],
  },
  gallery_section: {
    enabled: true,
    title: 'Conocé Nuestro Showroom',
    subtitle: 'Un espacio pensado para tu bienestar',
    images: [
      { id: 'g1', url: '/showroom-1.webp', caption: 'Probador de tonos' },
    ],
  },
  process_steps: [
    {
      id: 'step-1',
      title: 'Elegí tus favoritos',
      description: 'Navegá por nuestras líneas de cuidado.',
      active: true,
    },
    {
      id: 'step-2',
      title: 'Envío en el día',
      description: 'Llegamos a todo el país.',
      active: true,
    },
  ],
  process_flows: [],
  trust_bar: {
    enabled: true,
    items: [
      { id: 't1', title: 'Envío seguro', description: 'A todo Paraguay', icon: 'truck', active: true },
    ],
  },
}

describe('EspecialCosmeticosHome — Auditoría de configuraciones de /admin/website', () => {
  it('respeta hero_content: título personalizado, badge, subtítulo y botón CTA', () => {
    render(<EspecialCosmeticosHome settings={baseSettings} />)

    expect(screen.getByText('Belleza y Cuidado Natural')).toBeInTheDocument()
    expect(screen.getByText('Edición Limitada')).toBeInTheDocument()
    expect(
      screen.getByText('Los mejores cosméticos cruelty-free traídos especialmente para vos.')
    ).toBeInTheDocument()
    const ctaButton = screen.getByRole('link', { name: /Ver Productos Exclusivos/i })
    expect(ctaButton).toHaveAttribute('href', '/paravos/productos')
  })

  it('oculta el hero cuando hero_content.enabled es false', () => {
    const settingsWithoutHero: WebsiteSettings = {
      ...baseSettings,
      hero_content: {
        ...baseSettings.hero_content!,
        enabled: false,
      },
    }

    render(<EspecialCosmeticosHome settings={settingsWithoutHero} />)
    expect(screen.queryByText('Belleza y Cuidado Natural')).not.toBeInTheDocument()
  })

  it('respeta offers_section: título personalizado, eyebrow y subtítulo', () => {
    render(<EspecialCosmeticosHome settings={baseSettings} />)

    expect(screen.getByText('Rebajas Imperdibles del Mes')).toBeInTheDocument()
    expect(screen.getByText('Ofertas Flash')).toBeInTheDocument()
    expect(screen.getByText('Aprovechá hasta fin de mes o agotar stock.')).toBeInTheDocument()
  })

  it('oculta la sección de ofertas cuando offers_section.enabled es false aunque haya productos con descuento', () => {
    const settingsWithoutOffers: WebsiteSettings = {
      ...baseSettings,
      offers_section: {
        ...baseSettings.offers_section!,
        enabled: false,
      },
    }

    render(<EspecialCosmeticosHome settings={settingsWithoutOffers} />)
    expect(screen.queryByText('Rebajas Imperdibles del Mes')).not.toBeInTheDocument()
    expect(screen.queryByText('Labial Matte Red Rose')).not.toBeInTheDocument()
  })

  it('muestra la marquesina de marcas destacadas (StoreBrandTicker) si brands_section está habilitada', () => {
    render(<EspecialCosmeticosHome settings={baseSettings} />)

    expect(screen.getByText('Nuestras Marcas Favoritas')).toBeInTheDocument()
    expect(screen.getAllByText('L’Oréal Paris').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Maybelline').length).toBeGreaterThan(0)
  })

  it('muestra la galería de fotos si gallery_section está habilitada', () => {
    render(<EspecialCosmeticosHome settings={baseSettings} />)

    expect(screen.getByText('Conocé Nuestro Showroom')).toBeInTheDocument()
  })

  it('muestra los pasos de atención o compra si process_steps está configurado', () => {
    render(<EspecialCosmeticosHome settings={baseSettings} />)

    expect(screen.getByText('Elegí tus favoritos')).toBeInTheDocument()
    expect(screen.getByText('Envío en el día')).toBeInTheDocument()
  })

  it('muestra las sucursales si se configuran 2 o más sucursales', () => {
    const mockBranches: BranchLocationData[] = [
      {
        id: 'branch-1',
        name: 'Sucursal Centro',
        address: 'Palma 456, Asunción',
        city: 'Asunción',
        phone: '021123456',
        hours: '08:00 a 19:00',
        is_main: true,
      },
      {
        id: 'branch-2',
        name: 'Sucursal Villa Morra',
        address: 'Mariscal López 2050, Asunción',
        city: 'Asunción',
        phone: '021654321',
        hours: '09:00 a 20:00',
        is_main: false,
      },
    ]

    render(<EspecialCosmeticosHome settings={baseSettings} branches={mockBranches} />)

    expect(screen.getByText('Sucursal Centro')).toBeInTheDocument()
    expect(screen.getByText('Sucursal Villa Morra')).toBeInTheDocument()
  })
})
