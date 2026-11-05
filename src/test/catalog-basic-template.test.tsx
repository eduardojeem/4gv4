import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WebsiteSettings } from '@/types/website-settings'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import {
  isStorefrontStyleAvailable,
  resolveStorefrontStyle,
  getTemplateCompatibility,
} from '@/lib/website/storefront-style'

const state = vi.hoisted(() => ({
  products: [] as Array<{
    id: string
    name: string
    sale_price: number
    offer_price?: number
    has_offer?: boolean
    in_stock?: boolean
    stock_quantity?: number
    category?: { id: string; name: string }
  }>,
  error: undefined as Error | undefined,
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/mitienda/inicio',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('swr', () => ({
  default: () => ({
    data: state.products,
    error: state.error,
    isLoading: false,
  }),
}))

vi.mock('@/hooks/usePublicCategories', () => ({
  usePublicCategories: () => ({
    categories: [
      { id: 'cat-1', name: 'Almacén' },
      { id: 'cat-2', name: 'Bebidas' },
    ],
  }),
}))

import { CatalogBasicHome } from '@/components/public/catalog-basic/CatalogBasicHome'
import { CatalogBasicHeader } from '@/components/public/catalog-basic/CatalogBasicHeader'

const baseSettings: WebsiteSettings = {
  company_info: {
    name: 'Almacén Don Juan',
    slogan: 'Los mejores precios del barrio',
    phone: '0981123456',
    email: 'contacto@donjuan.com.py',
    address: 'Av. Eusebio Ayala 1234, Asunción',
    hours: {
      weekdays: '07:00 a 19:00',
      saturday: '07:00 a 13:00',
      sunday: '',
    },
  },
  hero_content: {
    enabled: true,
    badge: 'Catálogo',
    title: 'Almacén Don Juan',
    subtitle: 'Mirá nuestros productos y consultá disponibilidad',
  },
  checkout: {
    commerceMode: 'catalog',
    payment: {
      cash: { enabled: true },
      card: { enabled: false },
      transfer: { enabled: false },
      digital_wallet: { enabled: false },
    },
    delivery: { enabled: false, defaultCost: 0, freeThreshold: 0, estimatedTime: '' },
    pickup: { enabled: true, estimatedTime: '' },
    minOrderAmount: 0,
  },
  services: [],
  testimonials: [],
  process_steps: [],
  process_flows: [],
}

const capabilities: StorefrontCapabilities = {
  hasCatalog: true,
  hasServices: false,
  hasRepairs: false,
  businessLabel: 'Comercio General',
}

describe('Plantilla Catálogo básico (catalog-basic)', () => {
  beforeEach(() => {
    state.products = []
    state.error = undefined
  })

  describe('Reglas de disponibilidad y resolución de plantilla', () => {
    it('la plantilla solo se ofrece con commerceMode catalog y no con cart ni whatsapp', () => {
      // Con modo 'catalog' se ofrece
      expect(isStorefrontStyleAvailable('catalog-basic', { commerceMode: 'catalog' })).toBe(true)

      // Con modo 'cart' no se ofrece
      expect(isStorefrontStyleAvailable('catalog-basic', { commerceMode: 'cart' })).toBe(false)

      // Con modo 'whatsapp' no se ofrece
      expect(isStorefrontStyleAvailable('catalog-basic', { commerceMode: 'whatsapp' })).toBe(false)

      // Sin dato no se ofrece
      expect(isStorefrontStyleAvailable('catalog-basic', {})).toBe(false)
      expect(isStorefrontStyleAvailable('catalog-basic')).toBe(false)
    })

    it('resolveStorefrontStyle con catalog-basic y modo cart devuelve la plantilla del rubro', () => {
      // Para indumentaria (clothing) cae en fashion
      expect(
        resolveStorefrontStyle('catalog-basic', 'clothing', { commerceMode: 'cart' })
      ).toBe('fashion')

      // Para tecnología (electronics) cae en tech
      expect(
        resolveStorefrontStyle('catalog-basic', 'electronics', { commerceMode: 'cart' })
      ).toBe('tech')

      // Para comercio general cae en classic
      expect(
        resolveStorefrontStyle('catalog-basic', 'general', { commerceMode: 'cart' })
      ).toBe('classic')

      // Con modo whatsapp también cae en la del rubro
      expect(
        resolveStorefrontStyle('catalog-basic', 'clothing', { commerceMode: 'whatsapp' })
      ).toBe('fashion')

      // Con modo catalog conserva catalog-basic
      expect(
        resolveStorefrontStyle('catalog-basic', 'general', { commerceMode: 'catalog' })
      ).toBe('catalog-basic')
    })

    it('en modo catalog la plantilla se recomienda sin forzar automático', () => {
      const compat = getTemplateCompatibility({
        storefrontStyle: 'catalog-basic',
        businessVertical: 'general',
        commerceMode: 'catalog',
      })
      expect(compat.isRecommended).toBe(true)

      // Automático sigue devolviendo la plantilla del rubro para no forzarla
      expect(
        resolveStorefrontStyle('auto', 'general', { commerceMode: 'catalog' })
      ).toBe('classic')
    })
  })

  describe('Renderizado de la tienda pública (CatalogBasicHome)', () => {
    it('renderiza productos con precio y NO renderiza ningún botón Agregar ni ícono de carrito', () => {
      state.products = [
        {
          id: 'prod-1',
          name: 'Yerba Mate Clásica 500g',
          sale_price: 18000,
          in_stock: true,
        },
        {
          id: 'prod-2',
          name: 'Dulce de Guayaba 400g',
          sale_price: 15000,
          offer_price: 12000,
          has_offer: true,
          in_stock: false,
          stock_quantity: 0,
        },
      ]

      render(
        <CatalogBasicHome
          settings={baseSettings}
          branches={[]}
          capabilities={capabilities}
        />
      )

      // Verifica presencia de productos y precios
      expect(screen.getByText('Yerba Mate Clásica 500g')).toBeDefined()
      expect(screen.getByText('Dulce de Guayaba 400g')).toBeDefined()
      expect(screen.getByText(/18\.000/)).toBeDefined()
      expect(screen.getByText(/12\.000/)).toBeDefined()

      // Indicadores de stock
      expect(screen.getByText('Disponible')).toBeDefined()
      expect(screen.getByText('Sin stock')).toBeDefined()

      // NO debe tener botón "Agregar", ni "Agregar al carrito", ni íconos de carrito
      expect(screen.queryByText(/agregar/i)).toBeNull()
      expect(screen.queryByRole('button', { name: /agregar/i })).toBeNull()
      expect(screen.queryByRole('button', { name: /carrito/i })).toBeNull()
    })

    it('muestra portada con datos de la empresa y chips de categorías', () => {
      render(
        <CatalogBasicHome
          settings={baseSettings}
          branches={[]}
          capabilities={capabilities}
        />
      )

      expect(screen.getByRole('heading', { name: 'Almacén Don Juan' })).toBeDefined()
      expect(screen.getByText('Av. Eusebio Ayala 1234, Asunción')).toBeDefined()
      expect(screen.getByText('Todos los productos')).toBeDefined()
      expect(screen.getByText('Almacén')).toBeDefined()
      expect(screen.getByText('Bebidas')).toBeDefined()
    })
  })

  describe('Encabezado (CatalogBasicHeader)', () => {
    it('sin WhatsApp no aparece el botón de WhatsApp', () => {
      const settingsWithoutWhatsapp: WebsiteSettings = {
        ...baseSettings,
        company_info: {
          ...baseSettings.company_info,
          whatsapp: '',
          phone: '',
        },
      }

      render(<CatalogBasicHeader settings={settingsWithoutWhatsapp} />)

      expect(screen.queryByText(/whatsapp/i)).toBeNull()
      expect(screen.queryByRole('link', { name: /whatsapp/i })).toBeNull()
      // Tampoco debe tener carrito
      expect(screen.queryByRole('button', { name: /carrito/i })).toBeNull()
    })

    it('con WhatsApp cargado aparece el botón de WhatsApp', () => {
      const settingsWithWhatsapp: WebsiteSettings = {
        ...baseSettings,
        company_info: {
          ...baseSettings.company_info,
          whatsapp: '595981123456',
        },
      }

      render(<CatalogBasicHeader settings={settingsWithWhatsapp} />)

      const whatsappButton = screen.getByRole('link', { name: /whatsapp/i })
      expect(whatsappButton).toBeDefined()
      expect(whatsappButton.getAttribute('href')).toContain('wa.me/595981123456')
      // Tampoco debe tener carrito
      expect(screen.queryByRole('button', { name: /carrito/i })).toBeNull()
    })

    it('con solo teléfono y sin WhatsApp muestra botón Llamar', () => {
      const settingsPhoneOnly: WebsiteSettings = {
        ...baseSettings,
        company_info: {
          ...baseSettings.company_info,
          whatsapp: '',
          phone: '+59521123456',
        },
      }

      render(<CatalogBasicHeader settings={settingsPhoneOnly} />)

      expect(screen.queryByText(/whatsapp/i)).toBeNull()
      const callLink = screen.getByRole('link', { name: /llamar/i })
      expect(callLink).toBeDefined()
      expect(callLink.getAttribute('href')).toBe('tel:+59521123456')
    })
  })
})
