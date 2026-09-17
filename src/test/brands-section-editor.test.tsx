import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { WebsiteSettings } from '@/types/website-settings'

const updateSetting = vi.fn()

type HookState = {
  settings: WebsiteSettings | null
  isLoading: boolean
  error: string | null
  isSaving: boolean
}

let hookState: HookState

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({
    ...hookState,
    updateSetting,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/components/admin/website/website-editor-dirty', () => ({
  useWebsiteEditorDirty: () => ({
    isDirty: false,
    setDirty: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children?: React.ReactNode; href?: string; [key: string]: any }) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>{children}</a>
  ),
}))

import { BrandsSectionEditor } from '@/components/admin/website/BrandsSectionEditor'
import { StoreBrandTicker } from '@/components/public/inicio/StoreBrandTicker'

describe('BrandsSectionEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateSetting.mockResolvedValue({ success: true })
    hookState = {
      settings: getWebsiteSettingsDefaults(),
      isLoading: false,
      error: null,
      isSaving: false,
    }

    // Mock fetch for /api/brands and /api/products
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/brands')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'b1', name: 'Tokyo', logo_url: 'https://img.test/tokyo.png', is_active: true },
              { id: 'b2', name: 'Samsung', logo_url: null, is_active: true },
            ],
          }),
        }
      }
      if (url.includes('/api/products')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              products: [
                { id: 'p1', name: 'TV 50', brand: 'Tokyo' },
                { id: 'p2', name: 'Celular S24', brand: 'Samsung' },
                { id: 'p3', name: 'Remera Deportiva', brand: 'Under Armour' },
              ],
            },
          }),
        }
      }
      return { ok: false, json: async () => ({}) }
    }) as any
  })

  it('renders public visibility options for home, products, and offers', async () => {
    render(<BrandsSectionEditor />)

    expect(screen.getByText('Visibilidad en Secciones Públicas')).toBeInTheDocument()
    expect(screen.getByText('Página de Inicio')).toBeInTheDocument()
    expect(screen.getByText('Catálogo de Productos')).toBeInTheDocument()
    expect(screen.getByText('Página de Ofertas')).toBeInTheDocument()
  })

  it('relates with the store brands and catalog section', async () => {
    render(<BrandsSectionEditor />)

    expect(screen.getByText('Marcas de tu Tienda y Catálogo')).toBeInTheDocument()
    expect(screen.getByText('Ir a Gestión de Marcas')).toBeInTheDocument()

    // Wait for the async fetch to detect catalog brands
    await waitFor(() => {
      expect(screen.getByText('Tokyo')).toBeInTheDocument()
      expect(screen.getByText('Samsung')).toBeInTheDocument()
    })
  })

  it('allows synchronizing detected catalog brands to the marquee', async () => {
    render(<BrandsSectionEditor />)

    await waitFor(() => {
      expect(screen.getByText('Sincronizar todas a la marquesina')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Sincronizar todas a la marquesina'))

    // The brands should now be in the marquee list
    await waitFor(() => {
      expect(screen.getByText('Hay cambios sin guardar en las marcas')).toBeInTheDocument()
    })
  })
})

describe('StoreBrandTicker links', () => {
  it('generates direct catalog filter links using ?marca=', () => {
    render(
      <StoreBrandTicker
        settings={{
          enabled: true,
          title: 'Nuestras Marcas',
          showOnHome: true,
          items: [
            { id: 'brand-1', name: 'Apple', active: true },
            { id: 'brand-2', name: 'Sony', active: true },
          ],
        }}
      />
    )

    const appleLinks = screen.getAllByRole('link', { name: /ver colección apple/i })
    expect(appleLinks.length).toBeGreaterThan(0)
    expect(appleLinks[0]).toHaveAttribute('href', expect.stringContaining('/productos?marca=Apple'))

    const sonyLinks = screen.getAllByRole('link', { name: /ver colección sony/i })
    expect(sonyLinks.length).toBeGreaterThan(0)
    expect(sonyLinks[0]).toHaveAttribute('href', expect.stringContaining('/productos?marca=Sony'))
  })

  it('renders nothing when disabled or when no brands are added', () => {
    const { container: c1 } = render(
      <StoreBrandTicker
        settings={{
          enabled: false,
          title: 'Nuestras Marcas',
          items: [{ id: 'brand-1', name: 'Apple', active: true }],
        }}
      />
    )
    expect(c1).toBeEmptyDOMElement()

    const { container: c2 } = render(
      <StoreBrandTicker
        settings={{
          enabled: true,
          title: 'Nuestras Marcas',
          items: [],
        }}
      />
    )
    expect(c2).toBeEmptyDOMElement()
  })
})
