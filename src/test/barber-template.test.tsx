import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  STOREFRONT_STYLE_OPTIONS,
  STOREFRONT_TEMPLATES_METADATA,
  STOREFRONT_TEMPLATE_GROUPS,
  resolveStorefrontStyle,
  isStorefrontStyleAvailable,
  getTemplateCompatibility,
} from '@/lib/website/storefront-style'
import { BarberHeader } from '@/components/public/barber/BarberHeader'
import { BarberHome } from '@/components/public/barber/BarberHome'
import type { WebsiteSettings } from '@/types/website-settings'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import type { BranchLocationData } from '@/components/public/inicio/BranchLocations'

let searchParams = new URLSearchParams()
let pathname = '/varsovia/inicio'

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: {
    user: null as any,
    signOut: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParams,
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => mockAuth,
}))

vi.mock('@/contexts/theme-context', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn(), isDark: true }),
}))

vi.mock('@/components/public/cart/PublicCartButton', () => ({
  PublicCartButton: () => <button aria-label="Carrito">Carrito</button>,
}))

vi.mock('@/components/public/ProductCard', () => ({
  ProductCard: ({ product }: { product: { id: string; name: string } }) => (
    <article data-testid="product-card">{product.name}</article>
  ),
}))

vi.mock('@/components/public/agenda/PublicBooking', () => ({
  PublicBooking: ({ slug, initialServiceId }: { slug: string; initialServiceId?: string }) => (
    <div data-testid="public-booking">
      Agendamiento para {slug} {initialServiceId ? `(Servicio: ${initialServiceId})` : ''}
    </div>
  ),
}))

vi.mock('@/components/public/inicio/OrganizationReviews', () => ({
  OrganizationReviews: () => <div data-testid="org-reviews">Reseñas de clientes</div>,
}))

vi.mock('@/components/public/inicio/newest-products', () => ({
  NEWEST_PRODUCTS_SWR_OPTIONS: {},
  fetchPublicProducts: vi.fn(),
  newestProductsKey: () => 'mock-products-key',
}))

const mockProducts = [
  { id: 'prod-1', name: 'Pomada Mate Fijación Fuerte', sale_price: 95000, category: { name: 'Pomadas' } },
  { id: 'prod-2', name: 'Aceite de Barba Esencial', sale_price: 85000, category: { name: 'Barba' } },
]

const mockSettings: WebsiteSettings = {
  storefrontStyle: 'barber',
  company_info: {
    name: 'Club Varsovia',
    slogan: 'Club de Caballeros',
    phone: '0981 123 456',
    whatsapp: '0981 123 456',
    address: 'Av. España y Brasilia, Asunción',
    hours: {
      weekdays: 'Lun a Vie 10:00 - 20:00',
      saturday: 'Sáb 09:00 - 19:00',
      sunday: 'Cerrado',
    },
  },
  hero_content: {
    badge: 'Club de Caballeros · Tradición & Estilo',
    title: 'El Arte del Buen Cuidado',
    subtitle: 'Viví la experiencia de un club exclusivo con toallas calientes y café de cortesía.',
    ctaPrimaryText: 'Agendar Turno',
  },
  checkout: {
    commerceMode: 'cart',
    deliveryMethods: ['pickup'],
    paymentMethods: ['cash'],
  },
  booking_section: {
    enabled: true,
  },
}

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useWebsiteSettings: () => ({
    settings: mockSettings,
    isLoading: false,
    error: null,
  }),
}))

vi.mock('swr', () => ({
  default: (key: string | null) => {
    if (typeof key === 'string' && key.includes('products')) {
      return { data: mockProducts, isLoading: false, error: undefined }
    }
    return { data: null, isLoading: false, error: undefined }
  },
}))

vi.mock('@/components/public/inicio/ServicesHome', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/public/inicio/ServicesHome')>()
  return {
    ...actual,
    usePublicAgenda: () => ({
      agenda: {
        currency: 'PYG',
        services: [],
        professionals: [],
      },
      isLoading: false,
      tenantSlug: 'varsovia',
      tenantPrefix: '/varsovia',
      bookingHref: '/varsovia/turnos',
    }),
    useNextFreeSlot: () => ({
      date: '2026-11-09',
      time: '16:30',
      isToday: true,
      isTomorrow: false,
      serviceId: 'serv-1',
      serviceName: 'Corte Varsovia',
      professionalName: 'Carlos Benítez',
    }),
  }
})

const capabilities: StorefrontCapabilities = {
  businessVertical: 'barbershop',
  operatingModel: 'services',
  hasCatalog: true,
  hasServices: true,
  hasRepairs: false,
  hasWholesale: false,
}

const mockBranches: BranchLocationData[] = [
  {
    id: 'br-1',
    name: 'Sede Barrio Jara',
    address: 'República de Siria 450',
    city: 'Asunción',
    phone: '0981 111 222',
    email: 'jara@clubvarsovia.com',
    managerName: 'Lucas R.',
    isDefault: true,
  },
  {
    id: 'br-2',
    name: 'Sede Los Laureles & Kids',
    address: 'Av. Eusebio Ayala c/ R. Argentina',
    city: 'Asunción',
    phone: '0981 333 444',
    email: 'laureles@clubvarsovia.com',
    managerName: 'Martín B.',
    isDefault: false,
  },
]

describe('Plantilla Barbería Premium (Club Varsovia Style)', () => {
  beforeEach(() => {
    pathname = '/varsovia/inicio'
    searchParams = new URLSearchParams()
    mockAuth.user = null
    mockAuth.signOut.mockClear()
  })

  describe('Configuración y Metadata del Sistema de Estilos', () => {
    it('registra la plantilla "barber" en las opciones del selector', () => {
      const barberOption = STOREFRONT_STYLE_OPTIONS.find((opt) => opt.value === 'barber')
      expect(barberOption).toBeDefined()
      expect(barberOption?.label).toBe('Barbería Club')
      expect(barberOption?.description).toContain('Club Varsovia')
    })

    it('incluye la plantilla en el grupo de belleza y estética, junto a Turnos & Servicios', () => {
      const servicesGroup = STOREFRONT_TEMPLATE_GROUPS.find((grp) => grp.id === 'beauty')
      expect(servicesGroup).toBeDefined()
      expect(servicesGroup?.templateKeys).toContain('barber')
    })

    it('tiene metadata completa con badge "Club de Caballeros" y características', () => {
      const meta = STOREFRONT_TEMPLATES_METADATA.barber
      expect(meta).toBeDefined()
      expect(meta.name).toBe('Barbería Club')
      expect(meta.badge).toBe('Club de Caballeros')
      expect(meta.recommendedVerticals).toContain('Barbería')
      expect(meta.features).toContain('Carta de rituales y servicios')
      expect(meta.features).toContain('Presentación de maestros barberos')
    })

    it('es compatible y recomendada para negocios de barbería', () => {
      const compatibility = getTemplateCompatibility({
        storefrontStyle: 'barber',
        businessVertical: 'barbershop',
      })
      expect(compatibility.isCompatible).toBe(true)
      expect(compatibility.isRecommended).toBe(true)
    })

    it('resuelve explícitamente a "barber" cuando la tienda la elige', () => {
      const resolved = resolveStorefrontStyle('barber', 'barbershop')
      expect(resolved).toBe('barber')
    })

    it('está disponible cuando el negocio tiene servicios habilitados', () => {
      expect(isStorefrontStyleAvailable('barber', { servicesAvailable: true })).toBe(true)
      expect(isStorefrontStyleAvailable('barber', { servicesAvailable: false })).toBe(false)
    })
  })

  describe('BarberHeader (Encabezado con Estética Club)', () => {
    it('muestra el nombre del club, eslogan y horarios en la barra superior', () => {
      render(<BarberHeader settings={mockSettings} />)

      expect(screen.getAllByText('Club Varsovia').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Club de Caballeros').length).toBeGreaterThan(0)
      expect(screen.getByText('Lun a Vie 10:00 - 20:00')).toBeInTheDocument()
    })

    it('muestra los enlaces de navegación principales del club', () => {
      render(<BarberHeader settings={mockSettings} />)

      expect(screen.getByText('Servicios')).toBeInTheDocument()
      expect(screen.queryByText('La barbería')).not.toBeInTheDocument()
      expect(screen.getByText('Barberos')).toBeInTheDocument()
      expect(screen.getByText('Ubicación')).toBeInTheDocument()
    })

    it('muestra enlace dedicado a Productos en la navegación cuando el catálogo está habilitado', () => {
      render(<BarberHeader settings={mockSettings} />)

      const productLinks = screen.getAllByRole('link', { name: /productos/i })
      expect(productLinks.length).toBeGreaterThan(0)
      expect(productLinks[0]).toHaveAttribute('href', '/varsovia/productos')
    })

    it('muestra enlace dedicado a Reservas para acceder a la agenda y turnos', () => {
      render(<BarberHeader settings={mockSettings} />)

      const bookingLinks = screen.getAllByRole('link', { name: /reservas/i })
      expect(bookingLinks.length).toBeGreaterThan(0)
      expect(bookingLinks[0]).toHaveAttribute('href', expect.stringMatching(/(\/varsovia\/reservas|\/varsovia\/turnos|#reservar)/))
    })

    it('muestra botón de ingresar y abre AuthModal al hacer clic cuando no hay sesión iniciada', () => {
      render(<BarberHeader settings={mockSettings} />)

      const loginBtn = screen.getByRole('button', { name: /ingresar a mi cuenta/i })
      expect(loginBtn).toBeInTheDocument()

      fireEvent.click(loginBtn)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/acceder al marketplace/i)).toBeInTheDocument()
    })

    it('muestra el selector de perfil con iniciales, nombre y menú desplegable cuando el usuario está autenticado', async () => {
      mockAuth.user = {
        id: 'usr-1',
        email: 'cliente@clubvarsovia.com',
        profile: {
          name: 'Eduardo Galeano',
          avatar_url: '',
        },
      }

      render(<BarberHeader settings={mockSettings} />)

      const profileTrigger = screen.getByRole('button', { name: /menú de perfil de usuario/i })
      expect(profileTrigger).toBeInTheDocument()
      expect(screen.getByText('Eduardo')).toBeInTheDocument()
      expect(screen.getByText('EG')).toBeInTheDocument()

      // Abrir menú de perfil
      await userEvent.click(profileTrigger)

      expect(screen.getByText('Eduardo Galeano')).toBeInTheDocument()
      expect(screen.getByText('cliente@clubvarsovia.com')).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /ver mi perfil/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /mis turnos & reservas/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /mis compras \/ pedidos/i })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: /cerrar sesión/i })).toBeInTheDocument()
    })

    it('permite cerrar sesión desde el menú desplegable del perfil', async () => {
      mockAuth.user = {
        id: 'usr-1',
        email: 'cliente@clubvarsovia.com',
        profile: {
          name: 'Eduardo Galeano',
        },
      }

      render(<BarberHeader settings={mockSettings} />)

      const profileTrigger = screen.getByRole('button', { name: /menú de perfil de usuario/i })
      await userEvent.click(profileTrigger)

      const logoutItem = screen.getByRole('menuitem', { name: /cerrar sesión/i })
      await userEvent.click(logoutItem)

      expect(mockAuth.signOut).toHaveBeenCalledTimes(1)
    })

    it('incluye el botón de llamada a la acción "Reservar Turno"', () => {
      render(<BarberHeader settings={mockSettings} />)

      const ctaButtons = screen.getAllByText(/^Reservar$/i)
      expect(ctaButtons.length).toBeGreaterThan(0)
    })

    it('ofrece enlace directo a WhatsApp VIP con número limpio', () => {
      render(<BarberHeader settings={mockSettings} />)

      const whatsappLinks = screen.getAllByRole('link', { name: /WhatsApp/i })
      expect(whatsappLinks.length).toBeGreaterThan(0)
      expect(whatsappLinks[0]).toHaveAttribute('href', expect.stringContaining('wa.me/0981123456'))
    })
  })

  describe('BarberHome (Página Principal de la Barbería)', () => {
    it('renderiza la portada con título, subtítulo y distintivo de tradición', () => {
      render(<BarberHome settings={mockSettings} capabilities={capabilities} />)

      expect(screen.getByText('El Arte del Buen Cuidado')).toBeInTheDocument()
      expect(screen.getByText(/toallas calientes y café de cortesía/i)).toBeInTheDocument()
      expect(screen.getByText('Club de Caballeros · Tradición & Estilo')).toBeInTheDocument()
    })

    it('muestra la sección "Conocé la barbería" con los 4 pilares', () => {
      render(<BarberHome settings={mockSettings} capabilities={capabilities} />)

      expect(screen.getByText('Conocé la barbería')).toBeInTheDocument()
      expect(screen.getByRole('heading', {name:'Reservas online'})).toBeInTheDocument()
      expect(screen.getAllByText('Servicios disponibles').length).toBeGreaterThan(0)
      expect(screen.getByText('Equipo de atención')).toBeInTheDocument()
      expect(screen.getByText('Horarios disponibles')).toBeInTheDocument()
    })

    it('muestra la carta de rituales con precios en formato "Gs."', () => {
      render(<BarberHome settings={mockSettings} capabilities={capabilities} />)

      expect(screen.getAllByText('Servicios disponibles').length).toBeGreaterThan(0)
      expect(screen.getByText('Corte Signature Club Varsovia')).toBeInTheDocument()
      expect(screen.getByText('Afeitado Tradicional a Navaja')).toBeInTheDocument()
      expect(screen.getByText('Combo Completo: Corte & Barba')).toBeInTheDocument()

      // Los precios deben respetar la denominación oficial Gs.
      expect(screen.getByText('Gs. 80.000')).toBeInTheDocument()
      expect(screen.getAllByText('Gs. 60.000').length).toBeGreaterThan(0)
      expect(screen.getByText('Gs. 120.000')).toBeInTheDocument()
    })

    it('permite filtrar los rituales por categoría mediante pestañas', () => {
      render(<BarberHome settings={mockSettings} capabilities={capabilities} />)

      const barbaTab = screen.getByText('Barba')
      fireEvent.click(barbaTab)

      expect(screen.getByText('Afeitado Tradicional a Navaja')).toBeInTheDocument()
      expect(screen.getByText('Perfilado & Esculpido de Barba')).toBeInTheDocument()
      expect(screen.queryByText('Corte Signature Club Varsovia')).not.toBeInTheDocument()
    })

    it('muestra la presentación institucional del equipo si la agenda no tiene profesionales cargados', () => {
      render(<BarberHome settings={mockSettings} capabilities={capabilities} />)

      expect(screen.getByText('Nuestro equipo')).toBeInTheDocument()
      expect(screen.getByText('Elegí tu barbero')).toBeInTheDocument()
      expect(screen.getByText('Equipo Profesional de Club Varsovia')).toBeInTheDocument()
    })

    it('muestra las sedes y salones cuando la barbería tiene sucursales', () => {
      render(<BarberHome settings={mockSettings} branches={mockBranches} capabilities={capabilities} />)

      expect(screen.getByText('Dónde encontrarnos')).toBeInTheDocument()
      expect(screen.getByText('Sede Barrio Jara')).toBeInTheDocument()
      expect(screen.getByText('República de Siria 450, Asunción')).toBeInTheDocument()
      expect(screen.getByText('Sede Los Laureles & Kids')).toBeInTheDocument()
      expect(screen.getByText('Sede Principal')).toBeInTheDocument()
    })

    it('muestra la boutique de grooming masculino cuando hay catálogo y productos', () => {
      render(<BarberHome settings={mockSettings} capabilities={capabilities} />)

      expect(screen.getByText('Productos de cuidado personal')).toBeInTheDocument()
      expect(screen.getByText('Cuidado Personal en Casa')).toBeInTheDocument()
      expect(screen.getAllByTestId('product-card').length).toBeGreaterThan(0)
    })

    it('integra el agendamiento online en la sección #reservar con el nombre de la organización', () => {
      render(<BarberHome settings={mockSettings} capabilities={capabilities} />)

      expect(screen.getByText('Reservá tu Turno en Club Varsovia')).toBeInTheDocument()
    })

    it('adapta el encabezado cuando la organización elige estilo accent o solid', () => {
      const accentSettings: WebsiteSettings = {
        ...mockSettings,
        company_info: {
          ...mockSettings.company_info,
          headerStyle: 'accent',
        },
      }
      const { container } = render(<BarberHeader settings={accentSettings} />)
      const header = container.querySelector('header')
      expect(header).toHaveAttribute('data-header-style', 'accent')
      expect(header?.className).toContain('bg-primary')
    })
  })
})
