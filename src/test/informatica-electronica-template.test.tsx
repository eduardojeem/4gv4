import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  STOREFRONT_STYLE_OPTIONS,
  STOREFRONT_TEMPLATES_METADATA,
  resolveStorefrontStyle,
  isStorefrontStyleAvailable,
  getTemplateCompatibility,
} from '@/lib/website/storefront-style'
import { CompanyInfoSchema } from '@/lib/validation/website-settings'
import { InformaticaElectronicaHeader } from '@/components/public/informatica-electronica/InformaticaElectronicaHeader'
import { InformaticaElectronicaHome } from '@/components/public/informatica-electronica/InformaticaElectronicaHome'
import type { WebsiteSettings } from '@/types/website-settings'
import type { StorefrontCapabilities } from '@/lib/website/storefront-capabilities'

let searchParams = new URLSearchParams()
let pathname = '/mitienda/inicio'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParams,
}))

vi.mock('@/hooks/usePublicCategories', () => ({
  usePublicCategories: () => ({
    categories: [
      { id: 'cat-1', name: 'Notebooks', productCount: 5 },
      { id: 'cat-2', name: 'Celulares', productCount: 8 },
      { id: 'cat-3', name: 'Vacía', productCount: 0 },
    ],
  }),
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}))

vi.mock('@/contexts/theme-context', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
}))

// El botón del carrito decide solo según la forma de venta del checkout.
vi.mock('@/components/public/cart/PublicCartButton', () => ({
  PublicCartButton: () => <button aria-label="Carrito">Carrito</button>,
}))

// La tarjeta compartida ya tiene sus propios tests (stock, variantes, mayorista, precio oculto).
vi.mock('@/components/public/ProductCard', () => ({
  ProductCard: ({ product }: { product: { id: string; name: string } }) => (
    <article data-testid="product-card">{product.name}</article>
  ),
}))

vi.mock('@/components/public/inicio/OrganizationReviews', () => ({ OrganizationReviews: () => null }))
vi.mock('@/components/public/inicio/TechRepairsBanner', () => ({ TechRepairsBanner: () => <div>Reparaciones</div> }))

vi.mock('@/components/public/inicio/newest-products', () => ({
  NEWEST_PRODUCTS_SWR_OPTIONS: {},
  fetchPublicProducts: vi.fn(),
  newestProductsKey: () => 'mock-products-key',
}))

const baseProducts = [
  { id: 'p1', name: 'Notebook Asus 16GB', brand: 'Asus', sale_price: 6500000, offer_price: 5900000, category: { id: 'cat-1', name: 'Notebooks' } },
  { id: 'p2', name: 'iPhone 15', brand: 'Apple', sale_price: 9000000, offer_price: null, category: { id: 'cat-2', name: 'Celulares' } },
  { id: 'p3', name: 'Funda HPhone genérica', brand: null, sale_price: 50000, offer_price: null, category: { id: 'cat-2', name: 'Celulares' } },
  { id: 'p4', name: 'Pantalla oculta', brand: 'Apple', sale_price: 1200000, offer_price: 950000, hide_price: true, category: { id: 'cat-2', name: 'Celulares' } },
]

let mockProducts: unknown[] = baseProducts
let mockLoading = false

vi.mock('swr', () => ({
  default: () => ({ data: mockProducts, isLoading: mockLoading, error: undefined }),
}))

const capabilities: StorefrontCapabilities = {
  businessVertical: 'electronics',
  operatingModel: 'retail',
  hasCatalog: true,
  hasServices: false,
  hasRepairs: false,
  hasAppointments: false,
  canPublishServices: false,
  canPublishRepairs: false,
  businessLabel: 'Tecnología',
  tracking: { enabled: false, kind: 'none', label: '', href: '' },
}

function renderHome(settings: WebsiteSettings = { company_info: { name: 'Nexus Computación', phone: '+595 981 999888' } }) {
  return render(<InformaticaElectronicaHome settings={settings} capabilities={capabilities} branches={[]} />)
}

beforeEach(() => {
  mockProducts = baseProducts
  mockLoading = false
  searchParams = new URLSearchParams()
  pathname = '/mitienda/inicio'
})

describe('Plantilla Informática & Electrónica: registro', () => {
  it('está en las opciones, los metadatos y el esquema, sin prometer un cotizador', () => {
    expect(STOREFRONT_STYLE_OPTIONS.map((o) => o.value)).toContain('informatica-electronica')
    const meta = STOREFRONT_TEMPLATES_METADATA['informatica-electronica']
    expect(meta.name).toBe('Mega Tienda Tech')
    expect(JSON.stringify(meta)).not.toMatch(/cotizador|USD|en vivo/i)
    expect(meta.variants).toEqual([])
    expect(CompanyInfoSchema.shape.storefrontStyle.safeParse('informatica-electronica').success).toBe(true)
  })

  it('se recomienda para electrónica y comercio general', () => {
    expect(resolveStorefrontStyle('informatica-electronica', 'electronics')).toBe('informatica-electronica')
    expect(isStorefrontStyleAvailable('informatica-electronica', { businessVertical: 'electronics' })).toBe(true)
    const compat = getTemplateCompatibility({ storefrontStyle: 'informatica-electronica', businessVertical: 'electronics' })
    expect(compat.isRecommended).toBe(true)
    expect(compat.isCompatible).toBe(true)
  })
})

describe('Header Informática & Electrónica', () => {
  it('usa solo datos reales: sin cotización del dólar ni promesas de envío o garantía', () => {
    render(<InformaticaElectronicaHeader settings={{ company_info: { name: '4G Celulares', phone: '+595 981 123456', address: 'Av. España 123' } }} />)

    expect(screen.getByRole('link', { name: /4G Celulares/i })).toHaveAttribute('href', '/mitienda/inicio')
    expect(screen.getByText('Av. España 123')).toBeInTheDocument()
    expect(screen.queryByText(/Cotización|USD/i)).toBeNull()
    expect(screen.queryByText(/Envíos a todo el país|Garantía Oficial/i)).toBeNull()
    expect(screen.getAllByRole('button', { name: /Cambiar tema/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Mi Perfil/i })).toBeInTheDocument()
  })

  it('el carrito lo decide el propio botón según la forma de venta', () => {
    render(<InformaticaElectronicaHeader settings={{ company_info: { name: 'Tienda' } }} />)
    expect(screen.getByRole('button', { name: 'Carrito' })).toBeInTheDocument()
  })

  it('muestra las categorías con productos y marca la activa según la URL', () => {
    pathname = '/mitienda/productos'
    searchParams = new URLSearchParams('category_id=cat-2')
    render(<InformaticaElectronicaHeader settings={{ company_info: { name: 'Tienda' } }} />)

    expect(screen.queryByText('Vacía')).toBeNull()
    expect(screen.getByRole('link', { name: /Celulares/ })).toHaveClass('bg-primary')
    expect(screen.getByRole('link', { name: /Notebooks/ })).not.toHaveClass('bg-primary')
    expect(screen.getByRole('link', { name: 'Catálogo Completo' })).not.toHaveClass('bg-primary')
  })
})

describe('Inicio Informática & Electrónica', () => {
  it('usa los textos del dueño en la portada', () => {
    renderHome({
      company_info: { name: 'Nexus' },
      hero_content: { enabled: true, title: 'Notebooks de alto rendimiento', subtitle: 'Envíos a Asunción' },
    })
    expect(screen.getByRole('heading', { level: 1, name: 'Notebooks de alto rendimiento' })).toBeInTheDocument()
    expect(screen.getByText('Envíos a Asunción')).toBeInTheDocument()
  })

  it('no inventa urgencia ni beneficios: sin cuenta regresiva, stock limitado ni garantías', () => {
    renderHome()
    expect(screen.queryByText(/Termina en|STOCK LIMITADO|Relámpago/i)).toBeNull()
    expect(screen.queryByText(/Garantía|100% Original|Distribución Oficial|Envíos Inmediatos/i)).toBeNull()
    expect(screen.queryByText(/US\$|USD/)).toBeNull()
  })

  it('las ofertas son solo productos con descuento real y precio visible', () => {
    renderHome()
    const offers = screen.getByRole('region', { name: 'Productos con descuento' })
    const names = within(offers).getAllByTestId('product-card').map((card) => card.textContent)
    expect(names).toEqual(['Notebook Asus 16GB'])
  })

  it('sin descuentos reales no muestra la sección de ofertas', () => {
    mockProducts = baseProducts.map((product) => ({ ...product, offer_price: null }))
    renderHome()
    expect(screen.queryByRole('region', { name: 'Productos con descuento' })).toBeNull()
  })

  it('la compra por marca usa la marca cargada, sin coincidencias por texto', () => {
    renderHome()
    const section = screen.getByRole('region', { name: 'Comprá por marca' })
    fireEvent.click(within(section).getByRole('button', { name: 'Apple' }))
    expect(within(section).getByRole('button', { name: 'Apple' })).toHaveAttribute('aria-pressed', 'true')
    const names = within(section).getAllByTestId('product-card').map((card) => card.textContent)
    expect(names).toEqual(['iPhone 15', 'Pantalla oculta'])
    expect(within(section).getByRole('link', { name: /Ver todo Apple/ })).toHaveAttribute('href', '/mitienda/productos?q=Apple')
  })

  it('los destacados por categoría filtran por la categoría del producto', () => {
    renderHome()
    const section = screen.getByRole('region', { name: 'Destacados por categoría' })
    fireEvent.click(within(section).getByRole('button', { name: 'Celulares' }))
    const names = within(section).getAllByTestId('product-card').map((card) => card.textContent)
    expect(names).toEqual(['iPhone 15', 'Funda HPhone genérica', 'Pantalla oculta'])
    expect(within(section).getByRole('link', { name: /Explorar Celulares/ })).toHaveAttribute(
      'href',
      '/mitienda/productos?category_id=cat-2'
    )
  })

  it('el banner lateral destaca un modelo con oferta real y respeta el precio oculto', () => {
    renderHome()
    const brands = screen.getByRole('region', { name: 'Comprá por marca' })
    // Apple (la marca con más modelos) no tiene oferta visible: destaca el primero, a precio de lista.
    expect(within(brands).getByText('Modelo destacado')).toBeInTheDocument()
    expect(within(brands).getByText('9.000.000 Gs.')).toBeInTheDocument()
    expect(within(brands).queryByText(/950\.000/)).toBeNull()

    // Asus: destaca la notebook en oferta, al precio de oferta.
    fireEvent.click(within(brands).getByRole('button', { name: 'Asus' }))
    expect(within(brands).getByText('5.900.000 Gs.')).toBeInTheDocument()
    expect(within(brands).getByText('OFERTA')).toBeInTheDocument()
  })

  it('las miniaturas del banner cambian el modelo destacado', () => {
    mockProducts = [
      { id: 'a1', name: 'Galaxy S24', brand: 'Samsung', image: 'https://example.com/s24.png', sale_price: 7000000, offer_price: null, category: { id: 'cat-2', name: 'Celulares' } },
      { id: 'a2', name: 'Galaxy A55', brand: 'Samsung', image: 'https://example.com/a55.png', sale_price: 3000000, offer_price: null, category: { id: 'cat-2', name: 'Celulares' } },
      { id: 'b1', name: 'Redmi Note 13', brand: 'Xiaomi', image: 'https://example.com/redmi.png', sale_price: 2000000, offer_price: null, category: { id: 'cat-1', name: 'Notebooks' } },
    ]
    renderHome()
    const brands = screen.getByRole('region', { name: 'Comprá por marca' })
    const picker = within(brands).getByRole('group', { name: 'Elegir modelo destacado' })
    expect(within(picker).getByRole('button', { name: 'Ver Galaxy S24' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(brands).getByText('7.000.000 Gs.')).toBeInTheDocument()

    fireEvent.click(within(picker).getByRole('button', { name: 'Ver Galaxy A55' }))
    expect(within(picker).getByRole('button', { name: 'Ver Galaxy A55' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(brands).getByText('3.000.000 Gs.')).toBeInTheDocument()
    expect(within(brands).queryByText('7.000.000 Gs.')).toBeNull()
  })

  it('con pocos productos la grilla no reserva columnas vacías', () => {
    mockProducts = baseProducts.slice(0, 2)
    renderHome()
    const section = screen.getByRole('region', { name: 'Recién llegados' })
    const grid = within(section).getAllByTestId('product-card')[0].parentElement!
    expect(grid).toHaveClass('grid-cols-2')
    expect(grid.className).not.toMatch(/lg:grid-cols-4/)
  })

  it('la portada suma el acceso a ofertas solo si hay descuentos reales', () => {
    const { unmount } = renderHome()
    expect(screen.getByRole('link', { name: /Precios especiales/ })).toHaveAttribute('href', '/mitienda/ofertas')
    unmount()
    mockProducts = baseProducts.map((product) => ({ ...product, offer_price: null }))
    renderHome()
    expect(screen.queryByRole('link', { name: /Precios especiales/ })).toBeNull()
  })

  it('el dúo de categorías muestra las dos con más productos y enlaza a cada una', () => {
    renderHome()
    const section = screen.getByRole('region', { name: 'Categorías destacadas' })
    const links = within(section).getAllByRole('link', { name: /^Explorar/ })
    expect(links.map((link) => link.textContent)).toEqual(['Explorar Celulares', 'Explorar Notebooks'])
    expect(within(section).getByText('8 productos')).toBeInTheDocument()
  })

  it('«Recién llegados» muestra los más nuevos en el orden del servidor', () => {
    renderHome()
    const section = screen.getByRole('region', { name: 'Recién llegados' })
    const names = within(section).getAllByTestId('product-card').map((card) => card.textContent)
    expect(names).toEqual(baseProducts.map((product) => product.name))
  })

  it('las categorías de la tienda ocultan las que no tienen productos', () => {
    renderHome()
    const section = screen.getByRole('region', { name: 'Categorías de la tienda' })
    expect(within(section).getByRole('link', { name: /Notebooks/ })).toHaveAttribute('href', '/mitienda/productos?category_id=cat-1')
    expect(within(section).queryByText('Vacía')).toBeNull()
  })

  it('sin productos publicados lo dice en lugar de dejar la página vacía', () => {
    mockProducts = []
    renderHome()
    expect(screen.getByText('Todavía no hay productos publicados.')).toBeInTheDocument()
  })

  it('los beneficios aparecen solo si el dueño los configuró', () => {
    const { unmount } = renderHome()
    expect(screen.queryByText('Envío gratis')).toBeNull()
    unmount()
    renderHome({
      company_info: { name: 'Nexus' },
      trust_bar: { enabled: true, position: 'bottom', items: [{ icon: 'truck', title: 'Envío gratis', description: 'En Asunción', active: true }] },
    } as WebsiteSettings)
    expect(screen.getByText('Envío gratis')).toBeInTheDocument()
  })
})
