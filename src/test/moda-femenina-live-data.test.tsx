import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebsiteSettings } from '@/types/website-settings'

const state = vi.hoisted(() => ({
  products: [] as unknown[],
  error: null as Error | null,
  categories: [] as unknown[],
  company: { name: 'Boutique de prueba' } as Record<string, unknown>,
}))

vi.mock('swr', () => ({ default: (key: unknown) => ({ data: key ? state.products : undefined, isLoading: false, error: key ? state.error : null }) }))
vi.mock('next/navigation', () => ({ usePathname: () => '/prueba/inicio', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/hooks/use-hydrated', () => ({ useHydrated: () => true }))
vi.mock('@/hooks/usePublicCategories', () => ({ usePublicCategories: () => ({ categories: state.categories }) }))
vi.mock('@/components/public/storefront-style-context', () => ({ useStorefrontCompanyInfo: () => state.company }))
vi.mock('@/components/legal/LegalFooterLinks', () => ({ LegalFooterLinks: () => null }))
vi.mock('@/components/public/cart/PublicCartButton', () => ({ PublicCartButton: () => <button type="button">Carrito</button> }))
vi.mock('@/components/ui/theme-toggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/components/ui/app-image', () => ({ AppImage: () => null }))
vi.mock('@/components/public/ProductCard', () => ({
  ProductCard: ({ product }: { product: { name: string } }) => <div data-testid="real-product">{product.name}</div>,
}))

import { ModaFemeninaHome } from '@/components/public/moda-femenina/ModaFemeninaHome'
import { ModaFemeninaHeader } from '@/components/public/moda-femenina/ModaFemeninaHeader'
import { ModaFemeninaFooter } from '@/components/public/moda-femenina/ModaFemeninaFooter'

const settings = (over: Record<string, unknown> = {}) => ({ company_info: state.company, ...over }) as unknown as WebsiteSettings
const FAKE_CLAIMS = /10K\+|4\.9|Envío Gratis|30 días|24\/7|50% Off|Premium|Calidad Garantizada|Diseños exclusivos|100% (segura|protegido)|10% OFF|09:00 - 19:00|Modeza/i

beforeEach(() => {
  state.products = []
  state.error = null
  state.categories = []
  state.company = { name: 'Boutique de prueba' }
})

describe('Plantilla Boutique Femenina con datos reales', () => {
  it('una tienda vacía no muestra cifras, promesas ni otra marca', () => {
    const home = render(<ModaFemeninaHome settings={settings()} />)
    const header = render(<ModaFemeninaHeader settings={settings()} />)
    const footer = render(<ModaFemeninaFooter settings={settings()} />)
    for (const view of [home, header, footer]) expect(view.container.textContent).not.toMatch(FAKE_CLAIMS)
    expect(screen.getByRole('heading', { level: 1, name: 'Boutique de prueba' })).toBeInTheDocument()
    expect(screen.getByText('Todavía no hay productos publicados')).toBeInTheDocument()
    expect(screen.queryByText(/Comprar por/)).toBeNull()
    expect(screen.queryByText(/Ver ofertas/)).toBeNull()
  })

  it('solo muestra categorías con productos y ofertas reales, con su descuento', () => {
    state.categories = [
      { id: 'c1', name: 'Vestidos', productCount: 3 },
      { id: 'c2', name: 'Vacía', productCount: 0 },
    ]
    state.products = [{ id: 'p1', name: 'Vestido lino', has_offer: true, offer_price: 75000, sale_price: 100000 }]
    render(<ModaFemeninaHome settings={settings()} />)
    expect(screen.getByRole('link', { name: /Vestidos/ })).toHaveAttribute('href', '/prueba/productos?categoria=c1')
    expect(screen.getByText('3 productos')).toBeInTheDocument()
    expect(screen.queryByText('Vacía')).toBeNull()
    expect(screen.getByText('Hasta 25% de descuento')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver ofertas/ })).toHaveAttribute('href', '/prueba/ofertas')
    expect(screen.getAllByTestId('real-product')).toHaveLength(1)
  })

  it('muestra los beneficios que cargó la tienda y nada más', () => {
    render(<ModaFemeninaHome settings={settings({ trust_bar: { enabled: true, items: [{ title: 'Retiro en el local', description: 'En Asunción', active: true }] } })} />)
    expect(screen.getByText('Retiro en el local')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('avisa si no se pudieron cargar los productos', () => {
    state.error = new Error('red')
    render(<ModaFemeninaHome settings={settings()} />)
    expect(screen.getByText('No pudimos cargar los productos')).toBeInTheDocument()
  })

  it('sin catálogo no ofrece comprar, buscar ni ver ofertas', () => {
    render(<ModaFemeninaHeader settings={settings()} catalogEnabled={false} />)
    expect(screen.queryByRole('link', { name: /Comprar|Catálogo|Ofertas/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Buscar/ })).toBeNull()
    expect(screen.queryByText('Carrito')).toBeNull()
  })

  it('el encabezado y el pie llevan a páginas de la propia tienda', () => {
    state.categories = [{ id: 'c1', name: 'Vestidos', productCount: 2 }]
    state.company = { name: 'Boutique de prueba', phone: '0981 123 456', hours: { weekdays: '8 a 18', saturday: '', sunday: '' } }
    const { container } = render(
      <>
        <ModaFemeninaHeader settings={settings()} />
        <ModaFemeninaFooter settings={settings()} />
      </>,
    )
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href') || '')
    expect(hrefs).not.toContain('/productos?category=Vestidos')
    expect(hrefs.filter((href) => href.includes('#')).every((href) => href === '#contacto')).toBe(true)
    expect(container.querySelector('#contacto')).not.toBeNull()
    expect(screen.getByText('Lunes a viernes: 8 a 18')).toBeInTheDocument()
    expect(screen.queryByText(/Sábados/)).toBeNull()
  })
})
