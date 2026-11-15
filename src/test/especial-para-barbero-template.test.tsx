import type { ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompanyInfoSchema } from '@/lib/validation/website-settings'
import {
  STOREFRONT_STYLE_OPTIONS,
  STOREFRONT_TEMPLATES_METADATA,
  getTemplateCompatibility,
  isStorefrontStyleAvailable,
  resolveStorefrontStyle,
} from '@/lib/website/storefront-style'
import { defaultTemplatesForPlan } from '@/lib/website/template-plan-access'
import { EspecialBarberoFooter } from '@/components/public/especial-para-barbero/EspecialBarberoFooter'
import { EspecialBarberoHeader } from '@/components/public/especial-para-barbero/EspecialBarberoHeader'
import { EspecialBarberoHome } from '@/components/public/especial-para-barbero/EspecialBarberoHome'
import { ProductCard } from '@/components/public/ProductCard'
import { StorefrontStyleProvider } from '@/components/public/storefront-style-context'
import type { BranchLocationData } from '@/components/public/inicio/BranchLocations'
import type { PublicProduct } from '@/types/public'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import type { WebsiteSettings } from '@/types/website-settings'

const mockState = vi.hoisted(() => ({
  pathname: '/mitienda/inicio',
  searchParams: new URLSearchParams(),
  push: vi.fn(),
  refresh: vi.fn(),
  addProduct: vi.fn(() => ({ limited: false, quantity: 1 })),
  categories: [
    {
      id: 'cat-maquinas',
      name: 'Máquinas y Trimmers',
      productCount: 14,
      subcategories: [
        { id: 'cat-clippers', name: 'Clippers Inalámbricas' },
        { id: 'cat-trimmers', name: 'Trimmers Detalladoras' },
      ],
    },
    {
      id: 'cat-insumos',
      name: 'Insumos y Cuidado',
      productCount: 9,
      subcategories: [],
    },
  ],
  settings: {
    company_info: {
      name: 'Barber Pro Distribuidora',
      slogan: 'Insumos y equipos para barberías',
      phone: '+595 981 111222',
      whatsapp: '595981111222',
      email: 'ventas@barberpro.test',
      address: 'Av. Mcal. López 1234',
      hours: { weekdays: 'Lun a Vie 08:30 - 18:30', saturday: '09:00 - 13:00', sunday: '' },
      brandColor: 'amber' as const,
      headerStyle: 'dark' as const,
      storefrontStyle: 'especial-para-barbero' as const,
    },
    checkout: {
      commerceMode: 'cart' as const,
      payment: {
        cash: { enabled: true },
        card: { enabled: true },
        transfer: { enabled: true },
        digital_wallet: { enabled: false },
      },
      delivery: { enabled: true, defaultCost: 20000, freeThreshold: 500000, estimatedTime: '24 hs' },
      pickup: { enabled: true, estimatedTime: '2 hs' },
      minOrderAmount: 0,
    },
    hero_content: {
      enabled: true,
      badge: 'Distribución Oficial',
      title: 'Equipamiento profesional para tu barbería',
      subtitle: 'Stock minorista y mayorista con precios actualizados.',
      ctaPrimaryText: 'Ver catálogo',
      ctaSecondaryText: 'Consultar WhatsApp',
    },
    offers_section: {
      enabled: true,
      eyebrow: 'Descuentos reales',
      title: 'Ofertas destacadas',
      subtitle: 'Promociones vigentes en tienda',
      accentColor: 'amber' as const,
    },
    trust_bar: {
      enabled: true,
      position: 'above_carousel' as const,
      items: [
        { id: 't1', icon: 'truck', title: 'Envíos a todo el país', description: 'Despacho en el día', active: true },
      ],
    },
  } as WebsiteSettings,
  products: [] as PublicProduct[],
  agenda: null as {
    currency: string
    services: Array<{ id: string; name: string; duration: number; price: number | null }>
    professionals: Array<{ id: string; name: string; color: string; photoUrl?: string | null; specialty?: string | null }>
  } | null,
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => mockState.pathname,
  useRouter: () => ({ push: mockState.push, refresh: mockState.refresh }),
  useSearchParams: () => mockState.searchParams,
}))

vi.mock('@/hooks/use-public-cart', () => ({
  usePublicCart: () => ({ addProduct: mockState.addProduct, items: [], setQuantity: vi.fn() }),
}))

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useWebsiteSettings: () => ({ settings: mockState.settings, isLoading: false }),
}))

vi.mock('@/hooks/usePublicCategories', () => ({
  usePublicCategories: () => ({ categories: mockState.categories, isLoading: false }),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))

vi.mock('@/contexts/theme-context', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
}))

vi.mock('@/hooks/use-hydrated', () => ({
  useHydrated: () => true,
}))

vi.mock('@/components/public/cart/PublicCartButton', () => ({
  PublicCartButton: () => <button type="button" aria-label="Carrito">Carrito</button>,
}))

vi.mock('@/components/public/inicio/OrganizationReviews', () => ({ OrganizationReviews: () => null }))
vi.mock('@/components/public/FloatingWhatsAppButton', () => ({ FloatingWhatsAppButton: () => null }))
vi.mock('@/components/legal/LegalFooterLinks', () => ({
  LegalFooterLinks: () => <span>Términos</span>,
}))

vi.mock('@/components/public/inicio/newest-products', () => ({
  NEWEST_PRODUCTS_SWR_OPTIONS: {},
  fetchPublicProducts: vi.fn(),
  newestProductsKey: () => 'mock-barbero-products',
}))

vi.mock('@/components/public/agenda/PublicBooking', () => ({
  PublicBooking: ({ initialServiceId }: { initialServiceId?: string }) => (
    <div data-testid="mock-public-booking" data-service-id={initialServiceId ?? ''} />
  ),
}))

vi.mock('swr', () => ({
  default: (key: unknown) => {
    if (typeof key === 'string' && key.includes('/api/public/agenda/')) {
      return { data: key.includes('next=1') ? null : mockState.agenda, isLoading: false, error: undefined }
    }
    return { data: mockState.products, isLoading: false, error: undefined }
  },
}))

const sampleProducts = (withWholesale = false): PublicProduct[] =>
  [
    {
      id: 'p1',
      name: 'Wahl Magic Clip Cordless',
      brand: 'Wahl',
      sale_price: 980000,
      has_offer: true,
      offer_price: 840000,
      wholesale_price: withWholesale ? 760000 : null,
      in_stock: true,
      stock_quantity: 12,
      featured: true,
      image: 'https://cdn.test/magic-clip.webp',
      images: [],
      category: { id: 'cat-maquinas', name: 'Máquinas y Trimmers' },
    },
    {
      id: 'p2',
      name: 'BabylissPro GoldFX Trimmer',
      brand: 'BaBylissPRO',
      sale_price: 1150000,
      has_offer: false,
      offer_price: null,
      wholesale_price: withWholesale ? 920000 : null,
      in_stock: true,
      stock_quantity: 6,
      featured: true,
      image: 'https://cdn.test/goldfx.webp',
      images: [],
      category: { id: 'cat-maquinas', name: 'Máquinas y Trimmers' },
    },
    {
      id: 'p3',
      name: 'Cera Mate Profesional',
      brand: 'NishMan',
      sale_price: 85000,
      has_offer: true,
      offer_price: 65000,
      hide_price: true,
      wholesale_price: null,
      in_stock: true,
      stock_quantity: 20,
      featured: false,
      image: 'https://cdn.test/cera.webp',
      images: [],
      category: { id: 'cat-insumos', name: 'Insumos y Cuidado' },
    },
  ] as unknown as PublicProduct[]

const capabilities: StorefrontCapabilities = {
  businessVertical: 'barbershop',
  operatingModel: 'retail',
  hasCatalog: true,
  hasServices: false,
  hasRepairs: false,
  hasAppointments: false,
  canPublishServices: false,
  canPublishRepairs: false,
  businessLabel: 'Barbería',
  tracking: { enabled: false, kind: 'none', label: '', href: '' },
}

function renderWithStyle(ui: ReactNode) {
  return render(
    <StorefrontStyleProvider style="especial-para-barbero">
      {ui}
    </StorefrontStyleProvider>
  )
}

beforeEach(() => {
  mockState.pathname = '/mitienda/inicio'
  mockState.searchParams = new URLSearchParams()
  mockState.push.mockClear()
  mockState.addProduct.mockClear()
  mockState.products = sampleProducts(false)
  mockState.agenda = null
})

describe('Especial para barbero: registro, validación y planes', () => {
  it('está registrada con nombre exacto, esquema Zod y plan Pro Max (ENTERPRISE)', () => {
    const opt = STOREFRONT_STYLE_OPTIONS.find((item) => item.value === 'especial-para-barbero')
    expect(opt?.label).toBe('Especial para barbero')
    expect(STOREFRONT_TEMPLATES_METADATA['especial-para-barbero'].name).toBe('Especial para barbero')
    expect(CompanyInfoSchema.shape.storefrontStyle.safeParse('especial-para-barbero').success).toBe(true)
    expect(defaultTemplatesForPlan('ENTERPRISE')).toContain('especial-para-barbero')
  })

  it('funciona para barberías con catálogo sin exigir el módulo de servicios', () => {
    expect(
      isStorefrontStyleAvailable('especial-para-barbero', {
        businessVertical: 'barbershop',
        servicesAvailable: false,
        catalogAvailable: true,
      })
    ).toBe(true)
    expect(
      resolveStorefrontStyle('especial-para-barbero', 'barbershop', {
        servicesAvailable: false,
        catalogAvailable: true,
      })
    ).toBe('especial-para-barbero')

    const compat = getTemplateCompatibility({
      storefrontStyle: 'especial-para-barbero',
      businessVertical: 'barbershop',
      modules: ['inventory', 'pos', 'ecommerce'],
      servicesAvailable: false,
    })
    expect(compat.isCompatible).toBe(true)
    expect(compat.isRecommended).toBe(true)
    expect(compat.missingModules).toEqual([])
  })

  it('funciona también en otros rubros que solo venden productos de barbería (sin agenda ni módulo servicios)', () => {
    for (const vertical of ['general', 'cosmetics', 'other', 'hardware'] as const) {
      expect(
        isStorefrontStyleAvailable('especial-para-barbero', {
          businessVertical: vertical,
          servicesAvailable: false,
          catalogAvailable: true,
        })
      ).toBe(true)

      expect(
        resolveStorefrontStyle('especial-para-barbero', vertical, {
          servicesAvailable: false,
          catalogAvailable: true,
        })
      ).toBe('especial-para-barbero')

      const compat = getTemplateCompatibility({
        storefrontStyle: 'especial-para-barbero',
        businessVertical: vertical,
        modules: ['inventory', 'pos', 'ecommerce'],
        servicesAvailable: false,
        catalogAvailable: true,
      })
      expect(compat.isCompatible).toBe(true)
      expect(compat.missingModules).toEqual([])
    }
  })
})

describe('EspecialBarberoHeader', () => {
  it('renderiza identidad real, contacto de la org, buscador y mega menú de categorías', () => {
    renderWithStyle(<EspecialBarberoHeader settings={mockState.settings} />)

    expect(screen.getByText('Barber Pro Distribuidora')).toBeInTheDocument()
    expect(screen.getByText('+595 981 111222')).toBeInTheDocument()
    expect(screen.getByText('Av. Mcal. López 1234')).toBeInTheDocument()
    // Cero datos duros de la página de referencia
    expect(screen.queryByText(/Prime Barber Supply|Miami|305-/i)).toBeNull()

    const searchInput = screen.getByPlaceholderText(/Buscar máquinas, trimmers/i)
    fireEvent.change(searchInput, { target: { value: 'Wahl' } })
    fireEvent.submit(searchInput.closest('form')!)
    expect(mockState.push).toHaveBeenCalledWith('/mitienda/productos?query=Wahl')

    const megaBtn = screen.getByRole('button', { name: /Todas las categorías/i })
    expect(megaBtn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(megaBtn)
    expect(megaBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Clippers Inalámbricas')).toBeInTheDocument()
    expect(screen.getByText('Minorista & Mayorista')).toBeInTheDocument()
  })
})

describe('EspecialBarberoHeader: volver al marketplace', () => {
  it('en la tienda de una organización, también desde ofertas, lleva al marketplace', () => {
    mockState.pathname = '/mitienda/ofertas'
    renderWithStyle(<EspecialBarberoHeader settings={mockState.settings} />)
    // Botón para computadora y franja para el celular.
    expect(screen.getByRole('link', { name: 'Volver al marketplace' })).toHaveAttribute('href', '/marketplace')
    expect(screen.getByRole('link', { name: 'Volver al Marketplace' })).toHaveAttribute('href', '/marketplace')
  })

  it('en el dominio propio de la tienda no lo muestra', () => {
    mockState.pathname = '/ofertas'
    renderWithStyle(<EspecialBarberoHeader settings={mockState.settings} />)
    expect(screen.queryByRole('link', { name: /volver al marketplace/i })).not.toBeInTheDocument()
  })
})

describe('EspecialBarberoHome', () => {
  it('renderiza portada oscura, ofertas reales excluyendo precios ocultos y grilla de marcas', () => {
    renderWithStyle(
      <EspecialBarberoHome settings={mockState.settings} capabilities={capabilities} branches={[]} />
    )

    expect(
      screen.getByRole('heading', { level: 1, name: /Equipamiento profesional para tu barbería/i })
    ).toBeInTheDocument()
    expect(screen.getByText('Envíos a todo el país')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Acceso mayorista/i })).toBeInTheDocument()

    const offersSection = screen.getByRole('region', { name: /Ofertas destacadas/i })
    expect(within(offersSection).getByText('Wahl Magic Clip Cordless')).toBeInTheDocument()
    expect(within(offersSection).queryByText('Cera Mate Profesional')).toBeNull()

    // #pbm grilla oscura de marcas reales extraídas del catálogo
    expect(screen.getByText('Wahl')).toBeInTheDocument()
    expect(screen.getByText('BaBylissPRO')).toBeInTheDocument()
    expect(screen.getByText('NishMan')).toBeInTheDocument()
  })

  it('soporta carrusel promocional con controles y cambio automático al modo mayorista', () => {
    mockState.products = sampleProducts(true)
    const withCarousel: WebsiteSettings = {
      ...mockState.settings,
      promotional_carousel: {
        enabled: true,
        autoplay: false,
        intervalSeconds: 5,
        slides: [
          {
            id: 's1',
            title: 'Línea Cordless 2026',
            message: 'Potencia profesional',
            imageUrl: 'https://cdn.test/hero1.jpg',
            imageAlt: 'Hero 1',
            ctaText: 'Comprar',
            ctaHref: '/productos',
            active: true,
          },
          {
            id: 's2',
            title: 'Combo Barbería Full',
            message: 'Ahorrá equipando tu local',
            imageUrl: 'https://cdn.test/hero2.jpg',
            imageAlt: 'Hero 2',
            ctaText: 'Ver combos',
            ctaHref: '/ofertas',
            active: true,
          },
        ],
      },
    }
    const branches: BranchLocationData[] = [
      { id: 'b1', name: 'Casa Central', address: 'Centro', city: 'Asunción', phone: '0981', hours: '08-18', maps_url: '' },
      { id: 'b2', name: 'Sucursal Villa Morra', address: 'Mcal. López', city: 'Asunción', phone: '0982', hours: '09-19', maps_url: '' },
    ]

    renderWithStyle(
      <EspecialBarberoHome settings={withCarousel} capabilities={capabilities} branches={branches} />
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Línea Cordless 2026' })).toBeInTheDocument()
    expect(screen.getByText('Precios mayoristas activos')).toBeInTheDocument()
    expect(screen.getByText('Cuenta Mayorista Verificada')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Combo Barbería Full' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Combo Barbería Full' })).toBeInTheDocument()
    expect(screen.getByText('Casa Central')).toBeInTheDocument()
    expect(screen.getByText('Sucursal Villa Morra')).toBeInTheDocument()

    const dot2 = screen.getByRole('button', { name: 'Ir a la portada 2' })
    fireEvent.click(dot2)
    expect(dot2).toHaveAttribute('aria-current', 'true')
  })

  it('renderiza Nuestros servicios con diseño editorial oscuro, portada 16:9, filtros, duración desde agenda y reserva directa', () => {
    const scrollIntoViewMock = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoViewMock

    mockState.agenda = {
      currency: 'PYG',
      services: [
        { id: 'ag-srv-1', name: 'Corte de Autor & Visagismo', duration: 40, price: 50000 },
        { id: 'ag-srv-2', name: 'Ritual de Barba a Navaja', duration: 30, price: 45000 },
      ],
      professionals: [
        { id: 'barber-1', name: 'Juan Barbero', color: '#f59e0b', photoUrl: null, specialty: 'Fade & Visagismo' },
      ],
    }

    const withServicesSettings: WebsiteSettings = {
      ...mockState.settings,
      services_section: {
        enabled: true,
        badge: 'Servicios de Salón',
        title: 'Nuestros Servicios',
        subtitle: 'Turnos con reserva directa',
      },
      booking_section: {
        enabled: true,
        badge: 'Turnos Online',
        title: 'Reservá tu lugar',
        subtitle: '',
        showTeam: true,
      },
      services: [
        {
          id: 'srv-1',
          title: 'Corte de Autor & Visagismo',
          description: 'Fade de precisión, lavado capilar y styling.',
          icon: 'scissors',
          color: 'amber',
          category: 'Cortes',
          price: 50000,
          imageUrl: 'https://cdn.test/corte-autor.jpg',
          benefits: ['Lavado incluido', 'Terminación a navaja'],
          featured: true,
          active: true,
        },
        {
          id: 'srv-2',
          title: 'Ritual de Barba a Navaja',
          description: 'Toalla caliente, vapor y perfilado.',
          icon: 'sparkles',
          color: 'orange',
          category: 'Barba',
          price: 45000,
          imageUrl: 'https://cdn.test/ritual-barba.jpg',
          benefits: ['Vaporizador herbal'],
          featured: false,
          active: true,
        },
      ],
    }

    const mixedCaps: StorefrontCapabilities = {
      ...capabilities,
      operatingModel: 'mixed',
      hasServices: true,
      hasAppointments: true,
      canPublishServices: true,
    }

    const prevSettings = mockState.settings
    mockState.settings = withServicesSettings

    try {
      renderWithStyle(
        <EspecialBarberoHome settings={withServicesSettings} capabilities={mixedCaps} branches={[]} />
      )

      const servicesSection = screen.getByRole('region', { name: /Nuestros Servicios/i })
      expect(within(servicesSection).getByAltText('Corte de Autor & Visagismo')).toHaveAttribute(
        'src',
        'https://cdn.test/corte-autor.jpg'
      )
      // Enriquecido con duración de agenda
      expect(within(servicesSection).getByText('40 min')).toBeInTheDocument()
      expect(within(servicesSection).getByText('30 min')).toBeInTheDocument()
      expect(within(servicesSection).getByText('Gs. 50.000')).toBeInTheDocument()

      // Filtrado por categoría
      const barbaTab = within(servicesSection).getByRole('tab', { name: 'Barba' })
      fireEvent.click(barbaTab)
      expect(within(servicesSection).queryByText('Corte de Autor & Visagismo')).toBeNull()
      expect(within(servicesSection).getByText('Ritual de Barba a Navaja')).toBeInTheDocument()

      // Reservar turno preselecciona el ID correspondiente en la agenda y hace scroll
      const reserveBtn = within(servicesSection).getByRole('button', { name: /Reservar turno/i })
      fireEvent.click(reserveBtn)

      expect(screen.getByTestId('mock-public-booking')).toHaveAttribute('data-service-id', 'ag-srv-2')
      expect(scrollIntoViewMock).toHaveBeenCalled()
    } finally {
      mockState.settings = prevSettings
    }
  })

  it('aplica estilos personalizados y modo gráfico del editor de diapositivas en la portada hero', () => {
    const customHeroSettings: WebsiteSettings = {
      ...mockState.settings,
      promotional_carousel: {
        enabled: true,
        autoplay: false,
        intervalSeconds: 5,
        slides: [
          {
            id: 'hero-styled',
            title: 'Edición Limitada Gold',
            message: 'Solo por esta semana',
            imageUrl: 'https://cdn.test/gold-banner.jpg',
            imageAlt: 'Edición Limitada Gold',
            ctaText: 'Comprar',
            ctaHref: '/productos',
            active: true,
            titleColor: '#facc15',
            fontFamily: 'serif',
            titleSize: 'large',
            contentAlign: 'center',
            textTone: 'dark',
            overlayIntensity: 'medium',
            overlayColor: 'white',
          },
          {
            id: 'hero-graphic',
            title: '',
            message: '',
            imageUrl: 'https://cdn.test/graphic-banner.jpg',
            imageAlt: 'Banner limpio promocional',
            ctaHref: '/ofertas',
            active: true,
            hideText: true,
            overlayIntensity: 'none',
          },
        ],
      },
    }

    renderWithStyle(
      <EspecialBarberoHome settings={customHeroSettings} capabilities={capabilities} branches={[]} />
    )

    const heading = screen.getByRole('heading', { level: 1, name: 'Edición Limitada Gold' })
    expect(heading).toHaveStyle({ color: 'rgb(250, 204, 21)' })
    expect(heading).toHaveClass('font-serif')

    const graphicLink = screen.getByRole('link', { name: 'Banner limpio promocional' })
    expect(graphicLink).toHaveAttribute('href', '/mitienda/ofertas')
    expect(graphicLink).not.toHaveClass('sr-only')
  })
})

describe('EspecialBarberoFooter & ProductCard', () => {
  it('muestra datos de contacto, pagos configurados y enlaces legales en el footer', () => {
    renderWithStyle(<EspecialBarberoFooter initialSettings={mockState.settings} />)
    expect(screen.getByText('ventas@barberpro.test')).toBeInTheDocument()
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText('Tarjetas')).toBeInTheDocument()
    expect(screen.getByText('Transferencia')).toBeInTheDocument()
    expect(screen.getByText('Términos')).toBeInTheDocument()
  })

  it('ProductCard usa estilo especial-para-barbero con soporte retail, mayorista y precio oculto', () => {
    const [retailOffer, , hiddenPrice] = sampleProducts(false)
    const [wholesaleProd] = sampleProducts(true)

    const { rerender } = renderWithStyle(<ProductCard product={retailOffer} />)
    const card = screen.getByRole('heading', { name: 'Wahl Magic Clip Cordless' }).closest('article')!
    expect(card).toHaveClass('ebs-product-card')
    expect(screen.getByText('-14%')).toBeInTheDocument()

    rerender(
      <StorefrontStyleProvider style="especial-para-barbero">
        <ProductCard product={wholesaleProd} />
      </StorefrontStyleProvider>
    )
    expect(screen.getByText('Mayorista')).toBeInTheDocument()

    rerender(
      <StorefrontStyleProvider style="especial-para-barbero">
        <ProductCard product={hiddenPrice} />
      </StorefrontStyleProvider>
    )
    expect(screen.getByText('Precio a consultar')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Preguntar el precio de Cera Mate Profesional/i })).toBeInTheDocument()
  })
})
