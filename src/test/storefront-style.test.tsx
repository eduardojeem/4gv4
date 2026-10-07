import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  products: [] as unknown[],
  categories: [] as Array<{ id: string; name: string; productCount?: number }>,
  vertical: 'general',
  adminSettings: {} as Record<string, unknown>,
  push: vi.fn(),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}))
vi.mock('next/navigation', () => ({
  usePathname: () => '/tienda-demo/inicio',
  useRouter: () => ({ push: state.push }),
}))
vi.mock('@/hooks/use-public-cart', () => ({ usePublicCart: () => ({ addProduct: vi.fn() }) }))
vi.mock('@/hooks/useWebsiteSettings', () => ({
  useWebsiteSettings: () => ({ settings: { checkout: { commerceMode: 'cart' }, company_info: {} }, isLoading: false }),
  useAdminWebsiteSettings: () => ({ settings: state.adminSettings, isLoading: false, error: null, isSaving: false, refetch: vi.fn() }),
}))
vi.mock('@/hooks/usePublicCategories', () => ({
  usePublicCategories: () => ({ categories: state.categories, isLoading: false }),
}))
vi.mock('@/contexts/SubscriptionStatusContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/contexts/SubscriptionStatusContext')>()
  return {
    ...original,
    useSubscriptionStatus: () => ({ ...original.useSubscriptionStatus(), businessVertical: state.vertical }),
  }
})

import { ProductCard } from '@/components/public/ProductCard'
import { HeroSection } from '@/components/public/inicio/HeroSection'
import { CategoryShowcase } from '@/components/public/inicio/CategoryShowcase'
import { categoryCoverImages } from '@/components/public/inicio/CategoryCollections'
import { FeaturedProducts } from '@/components/public/inicio/FeaturedProducts'
import { StorefrontStyleProvider } from '@/components/public/storefront-style-context'
import { CompanyInfoForm } from '@/components/admin/website/CompanyInfoForm'
import { getBrandTheme } from '@/lib/constants/brand-theme'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { validateSetting } from '@/lib/validation/website-settings'
import {
  STOREFRONT_STYLE_PREFERENCES,
  resolveStorefrontStyle,
  suggestStorefrontAppearance,
  type StorefrontStyle,
} from '@/lib/website/storefront-style'
import { parseStorefrontPreviewDraft } from '@/lib/website/storefront-preview-message'
import { buildServiceMenu } from '@/components/public/inicio/ServicesHome'
import type { PublicProduct } from '@/types/public'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const producto = (id: string, name: string, image: string | null, categoryId = 'c1') =>
  ({
    id,
    name,
    sale_price: 120000,
    in_stock: true,
    stock_quantity: 8,
    image,
    images: [],
    category: { id: categoryId, name: 'Remeras' },
  }) as unknown as PublicProduct

/** Cada prueba con su propia cache de SWR, y la tienda con el aspecto pedido. */
function pintar(ui: ReactNode, style?: StorefrontStyle) {
  const conAspecto = style ? <StorefrontStyleProvider style={style}>{ui}</StorefrontStyleProvider> : ui
  return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{conAspecto}</SWRConfig>)
}

beforeEach(() => {
  state.products = []
  state.categories = []
  state.vertical = 'general'
  state.push.mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ data: { products: state.products } }) }))
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('qué aspecto toma la tienda', () => {
  it('en Automático, una tienda de ropa se ve como tienda de moda', () => {
    expect(resolveStorefrontStyle('auto', 'clothing')).toBe('fashion')
    // Las tiendas que nunca guardaron la opción también.
    expect(resolveStorefrontStyle(undefined, 'clothing')).toBe('fashion')
  })

  it('en Automático, los demás rubros quedan como siempre', () => {
    for (const rubro of ['general', 'electronics', 'cosmetics', 'food', 'hardware', 'other', null, undefined, 'constructor']) {
      expect(resolveStorefrontStyle('auto', rubro)).toBe('classic')
    }
  })

  it('lo que elige el dueño gana sobre el rubro', () => {
    expect(resolveStorefrontStyle('sport', 'electronics')).toBe('sport')
    expect(resolveStorefrontStyle('classic', 'clothing')).toBe('classic')
  })

  it('un valor desconocido no rompe la tienda: decide el rubro', () => {
    expect(resolveStorefrontStyle('minimal', 'clothing')).toBe('fashion')
    expect(resolveStorefrontStyle('minimal', 'electronics')).toBe('classic')
  })

  it('las tiendas existentes arrancan en Automático', () => {
    expect(getWebsiteSettingsDefaults().company_info.storefrontStyle).toBe('auto')
  })

  it('se guardan los cuatro aspectos y nada más', () => {
    const base = { ...getWebsiteSettingsDefaults().company_info, name: 'Urbana Store' }
    for (const aspecto of STOREFRONT_STYLE_PREFERENCES) {
      expect(validateSetting('company_info', { ...base, storefrontStyle: aspecto }).success).toBe(true)
    }
    expect(validateSetting('company_info', { ...base, storefrontStyle: 'minimal' }).success).toBe(false)
  })
})

describe('la tarjeta de producto', () => {
  const remera = producto('p1', 'Remera Oversize', 'https://cdn.test/remera.jpg')
  const foto = () => screen.getByRole('button', { name: 'Vista rápida de Remera Oversize' })

  it('fuera de una tienda (dashboard, marketplace) queda como siempre', () => {
    pintar(<ProductCard product={remera} />)
    expect(foto()).toHaveClass('aspect-[4/3]')
    expect(within(foto()).getByAltText('Remera Oversize')).toHaveClass('object-contain')
    expect(foto().closest('article')).toHaveClass('rounded-lg', 'shadow-sm')
  })

  it('en Moda la foto va vertical y a sangre', () => {
    pintar(<ProductCard product={remera} />, 'fashion')
    expect(foto()).toHaveClass('aspect-[3/4]')
    expect(within(foto()).getByAltText('Remera Oversize')).toHaveClass('object-cover')
    expect(foto().closest('article')).toHaveClass('rounded-none')
    expect(foto().closest('article')).not.toHaveClass('shadow-sm')
  })

  it('sin foto, el placeholder se muestra entero en vez de recortarse', () => {
    pintar(<ProductCard product={producto('p2', 'Gorra', null)} />, 'fashion')
    const media = screen.getByRole('button', { name: 'Vista rápida de Gorra' })
    expect(media).toHaveClass('aspect-[3/4]')
    expect(within(media).getByAltText('Gorra')).toHaveClass('object-contain')
  })

  it('en Deportivo el nombre va en mayúsculas', () => {
    pintar(<ProductCard product={remera} />, 'sport')
    expect(screen.getByRole('heading', { name: 'Remera Oversize' })).toHaveClass('uppercase')
  })
})

describe('la portada del inicio', () => {
  const props = () => ({
    companyInfo: {
      name: 'Urbana Store',
      phone: '',
      email: '',
      address: '',
      hours: { weekdays: 'Lunes a Sábados', saturday: '', sunday: '' },
      brandColor: 'blue' as const,
    },
    heroStats: { enabled: true, repairs: '100%', satisfaction: '4.9★', avgTime: '24h' },
    heroContent: { enabled: true, badge: 'Otoño 2026', title: 'Nueva temporada', subtitle: 'Prendas para todos los días.' },
    brand: getBrandTheme('blue'),
    phoneClean: '',
    contactHref: '/inicio#contacto',
  })

  it('el aspecto clásico sigue mostrando las estadísticas', () => {
    pintar(<HeroSection {...props()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Nueva temporada' })).toBeInTheDocument()
    expect(screen.getByText('Garantía')).toBeInTheDocument()
  })

  it('en Moda muestra fotos del catálogo, no estadísticas de garantía y despacho', async () => {
    state.products = [
      producto('p1', 'Remera Oversize', 'https://cdn.test/1.jpg'),
      producto('p2', 'Gorra', null),
      producto('p3', 'Jean Recto', 'https://cdn.test/3.jpg'),
      producto('p4', 'Campera Puffer', 'https://cdn.test/4.jpg'),
      producto('p5', 'Buzo Canguro', 'https://cdn.test/5.jpg'),
    ]
    pintar(<HeroSection {...props()} />, 'fashion')

    expect(screen.getByRole('heading', { level: 1, name: 'Nueva temporada' })).toHaveClass('font-serif')
    expect(screen.queryByText('Garantía')).not.toBeInTheDocument()

    // Las tres primeras con foto; la gorra no tiene imagen.
    const fotos = await screen.findAllByRole('link', { name: /Remera|Jean|Campera|Buzo|Gorra/ })
    expect(fotos.map((link) => link.getAttribute('href'))).toEqual([
      '/tienda-demo/productos/p1',
      '/tienda-demo/productos/p3',
      '/tienda-demo/productos/p4',
    ])
  })

  it('si la tienda todavía no tiene fotos, muestra su nombre en grande', async () => {
    pintar(<HeroSection {...props()} />, 'fashion')
    expect(await screen.findByText('Urbana Store')).toBeInTheDocument()
  })

  it('el buscador lleva al catálogo de la tienda', () => {
    pintar(<HeroSection {...props()} />, 'sport')
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('uppercase')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar productos' }), { target: { value: 'jean' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(state.push).toHaveBeenCalledWith('/tienda-demo/productos?q=jean')
  })

  it('si el dueño la apagó, no aparece en ningún aspecto', () => {
    const apagada = { ...props(), heroContent: { ...props().heroContent, enabled: false } }
    const { container } = pintar(<HeroSection {...apagada} />, 'fashion')
    expect(container).toBeEmptyDOMElement()
  })
})

describe('las categorías del inicio', () => {
  it('la foto de cada categoría es la del producto más nuevo con imagen', () => {
    const covers = categoryCoverImages([
      producto('p1', 'Sin foto', null, 'c1'),
      producto('p2', 'Remera nueva', 'https://cdn.test/nueva.jpg', 'c1'),
      producto('p3', 'Remera vieja', 'https://cdn.test/vieja.jpg', 'c1'),
      producto('p4', 'Jean', 'https://cdn.test/jean.jpg', 'c2'),
    ])
    expect(covers.get('c1')).toBe('https://cdn.test/nueva.jpg')
    expect(covers.get('c2')).toBe('https://cdn.test/jean.jpg')
  })

  it('en Moda son colecciones con foto; las vacías no aparecen', async () => {
    state.categories = [
      { id: 'c1', name: 'Remeras', productCount: 12 },
      { id: 'c2', name: 'Jeans', productCount: 1 },
      { id: 'c3', name: 'Vacía', productCount: 0 },
    ]
    state.products = [producto('p1', 'Remera Oversize', 'https://cdn.test/1.jpg', 'c1')]
    pintar(<CategoryShowcase />, 'fashion')

    const remeras = await screen.findByRole('link', { name: /Remeras\s*12 productos/ })
    expect(remeras).toHaveAttribute('href', '/tienda-demo/productos?category_id=c1')
    await waitFor(() => expect(remeras.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/1.jpg'))
    expect(screen.getByRole('link', { name: /Jeans\s*1 producto$/ }).querySelector('img')).toBeNull()
    expect(screen.queryByText('Vacía')).not.toBeInTheDocument()
  })

  it('el aspecto clásico no cambia', () => {
    state.categories = [{ id: 'c1', name: 'Celulares', productCount: 4 }]
    pintar(<CategoryShowcase />)
    expect(screen.getByText('Comprá por Categoría')).toBeInTheDocument()
    expect(screen.queryByText('Colecciones')).not.toBeInTheDocument()
  })
})

describe('los productos del inicio', () => {
  beforeEach(() => {
    state.products = [producto('p1', 'Remera Oversize', 'https://cdn.test/1.jpg')]
  })

  it('en Moda se presentan como nuevos ingresos', async () => {
    pintar(<FeaturedProducts />, 'fashion')
    expect(await screen.findByText('Nuevos ingresos')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Lo último en la tienda' })).toHaveClass('font-serif')
    expect(screen.getByRole('button', { name: 'Vista rápida de Remera Oversize' })).toHaveClass('aspect-[3/4]')
  })

  it('el aspecto clásico mantiene sus textos', async () => {
    pintar(<FeaturedProducts />)
    expect(await screen.findByText('Catálogo Destacado')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Productos Disponibles' })).toBeInTheDocument()
  })
})

describe('la tienda recibe el aspecto', () => {
  it('por /[slug], con el rubro de la organización', () => {
    const layout = leer('src/app/[organizationSlug]/layout.tsx')
    expect(layout).toContain(
      'resolveStorefrontStyle(settings?.company_info?.storefrontStyle, storefrontOrganization.business_vertical, {'
    )
    // «Servicios» solo con la agenda activa.
    expect(layout).toContain('servicesAvailable: servicesModuleEnabled')
    expect(layout).toMatch(/<StorefrontStyleProvider style=\{storefrontStyle\}>\s*<CartProviderWithDrawer>/)
  })

  it('por subdominio también, y sin taller no ofrece seguimiento de reparaciones', () => {
    const layout = leer('src/app/(public)/layout.tsx')
    expect(layout).toContain(
      'resolveStorefrontStyle(settings?.company_info?.storefrontStyle, storefrontOrganization?.business_vertical, {'
    )
    expect(layout).toContain("await isOrganizationModuleEnabled(storefrontOrganization.id, 'services')")
    expect(layout).toMatch(/<StorefrontStyleProvider style=\{storefrontStyle\}>\s*<CartProviderWithDrawer>/)
    expect(layout).toContain("await isOrganizationModuleEnabled(storefrontOrganization.id, 'repairs')")
    expect(layout).toContain('<PublicFooter initialSettings={settings} repairsModuleEnabled={repairsModuleEnabled} />')
  })

  it('la consulta de la tienda pública trae el rubro', () => {
    const tenant = leer('src/lib/saas/public-tenant.ts')
    expect(tenant.match(/marketplace_public, storefront_public, business_vertical/g)).toHaveLength(2)
  })
})

describe('«Aspecto de la tienda» en Sitio Web', () => {
  beforeEach(() => {
    const settings = getWebsiteSettingsDefaults()
    settings.company_info = {
      ...settings.company_info,
      name: 'Urbana Store',
      slug: 'urbana',
      phone: '0981123456',
      whatsapp: '595981123456',
      storefrontPublic: false,
      marketplacePublic: false,
    }
    settings.checkout.commerceMode = 'whatsapp'
    state.adminSettings = settings as unknown as Record<string, unknown>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }))
  })

  it('dice qué aspecto elige Automático para el rubro', () => {
    state.vertical = 'clothing'
    render(<CompanyInfoForm />)
    expect(screen.getByRole('button', { name: /^Automático Según tu rubro: Moda/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('guardar envía el aspecto elegido', async () => {
    render(<CompanyInfoForm />)
    fireEvent.click(screen.getByRole('button', { name: /^Deportivo/ }))
    expect(screen.getByRole('button', { name: /^Deportivo/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/website/sync-company', expect.anything()))
    const call = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/admin/website/sync-company')
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ storefrontStyle: 'sport' })
  })

  it('permite elegir temas avanzados (Tecnología, Supermercado, Moderno)', async () => {
    render(<CompanyInfoForm />)
    const techBtn = screen.getByRole('button', { name: /^Tecnología/ })
    fireEvent.click(techBtn)
    expect(techBtn).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/website/sync-company', expect.anything()))
    const call = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/admin/website/sync-company')
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ storefrontStyle: 'tech' })
  })

  it('la sugerencia aplica plantilla, color y encabezado de una vez', async () => {
    state.vertical = 'clothing'
    render(<CompanyInfoForm />)
    expect(screen.getByText(/Tu rubro es indumentaria/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar sugerencia' }))
    expect(screen.queryByRole('button', { name: 'Aplicar sugerencia' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/website/sync-company', expect.anything()))
    const call = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/admin/website/sync-company')
    // Automático ya da Moda para ropa: se queda en Automático para seguir al rubro.
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ storefrontStyle: 'auto', brandColor: 'rose', headerStyle: 'solid' })
  })

  it('el encabezado y la barra de contacto se eligen con un clic', async () => {
    render(<CompanyInfoForm />)
    const encabezado = within(screen.getByRole('group', { name: 'Estilo del encabezado' }))
    fireEvent.click(encabezado.getByRole('button', { name: /^Oscuro/ }))
    expect(encabezado.getByRole('button', { name: /^Oscuro/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('switch', { name: 'Barra de contacto' }))

    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/website/sync-company', expect.anything()))
    const call = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/admin/website/sync-company')
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ headerStyle: 'dark', showTopBar: false })
  })

  it('sin tienda publicada, el modal compara plantillas sin abrir una página que no existe', () => {
    render(<CompanyInfoForm />)
    fireEvent.click(screen.getByRole('button', { name: /Diseñar en mi tienda/ }))
    const modal = within(screen.getByRole('dialog'))
    expect(modal.getByText('Tu tienda todavía no está publicada')).toBeInTheDocument()
    expect(modal.queryByTitle('Vista previa de tu tienda')).not.toBeInTheDocument()
  })

  it('con la tienda publicada, el modal muestra la tienda real y aplica la plantilla elegida', async () => {
    const settings = state.adminSettings as { company_info: Record<string, unknown> }
    settings.company_info = { ...settings.company_info, storefrontPublic: true }
    render(<CompanyInfoForm />)
    fireEvent.click(screen.getByRole('button', { name: /Diseñar en mi tienda/ }))
    const modal = within(screen.getByRole('dialog'))
    expect(modal.getByTitle('Vista previa de tu tienda')).toHaveAttribute('src', '/urbana/inicio')

    fireEvent.click(modal.getByRole('radio', { name: /^Supermercado/ }))
    fireEvent.click(modal.getByRole('button', { name: 'Aplicar cambios' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /^Supermercado/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('en el modal también se editan color, encabezado y barra, y se aplican juntos', async () => {
    render(<CompanyInfoForm />)
    fireEvent.click(screen.getByRole('button', { name: /Diseñar en mi tienda/ }))
    const modal = within(screen.getByRole('dialog'))
    expect(modal.getByRole('button', { name: 'Sin cambios' })).toBeDisabled()

    fireEvent.click(modal.getByRole('tab', { name: 'Color y encabezado' }))
    fireEvent.click(modal.getByRole('button', { name: /Usar color Esmeralda/ }))
    fireEvent.click(within(modal.getByRole('group', { name: 'Estilo del encabezado' })).getByRole('button', { name: /^Color de marca/ }))
    fireEvent.click(modal.getByRole('switch', { name: 'Barra de contacto' }))
    fireEvent.click(modal.getByRole('button', { name: 'Aplicar cambios' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/admin/website/sync-company', expect.anything()))
    const call = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/admin/website/sync-company')
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ brandColor: 'emerald', headerStyle: 'accent', showTopBar: false })
  })

  it('Cancelar descarta lo probado en el modal', () => {
    render(<CompanyInfoForm />)
    fireEvent.click(screen.getByRole('button', { name: /Diseñar en mi tienda/ }))
    const modal = within(screen.getByRole('dialog'))
    fireEvent.click(modal.getByRole('radio', { name: /^Supermercado/ }))
    fireEvent.click(modal.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: /^Supermercado/ })).toHaveAttribute('aria-pressed', 'false')
  })
})


describe('sugerencia de aspecto', () => {
  it('el rubro manda', () => {
    expect(suggestStorefrontAppearance({ businessVertical: 'electronics', name: 'Boutique Ana' })).toMatchObject({ style: 'tech', headerStyle: 'dark' })
    expect(suggestStorefrontAppearance({ businessVertical: 'food' })).toMatchObject({ style: 'market', brandColor: 'emerald' })
  })

  it('con un rubro genérico, busca pistas en el nombre y la descripción (con acentos)', () => {
    expect(suggestStorefrontAppearance({ businessVertical: 'general', name: 'Celulares Pepe' }).style).toBe('tech')
    expect(suggestStorefrontAppearance({ businessVertical: 'other', description: 'Somos un café de especialidad' })).toMatchObject({
      style: 'modern',
      reason: 'Tu negocio menciona «café».',
    })
    expect(suggestStorefrontAppearance({ businessVertical: 'general', name: 'Cafetería' }).style).toBe('classic')
  })

  it('peluquerías y barberías van a la plantilla de Servicios', () => {
    expect(suggestStorefrontAppearance({ businessVertical: 'general', name: 'Barbería Don Pepe' })).toMatchObject({ style: 'services', headerStyle: 'dark' })
    expect(suggestStorefrontAppearance({ businessVertical: 'other', description: 'Peluquería y uñas esculpidas' }).style).toBe('services')
  })

  it('sin pistas, sugiere la plantilla clásica', () => {
    expect(suggestStorefrontAppearance({ businessVertical: 'general', name: 'Comercial López' })).toMatchObject({ style: 'classic', brandColor: 'blue' })
  })
})

describe('mensajes de la vista previa', () => {
  const valido = { type: 'STOREFRONT_PREVIEW_UPDATE', style: 'sport', brandColor: 'red', headerStyle: 'dark', showTopBar: true }

  it('acepta un borrador completo', () => {
    expect(parseStorefrontPreviewDraft(valido)).toEqual({ style: 'sport', brandColor: 'red', headerStyle: 'dark', showTopBar: true })
  })

  it('rechaza cualquier valor fuera de lo permitido', () => {
    expect(parseStorefrontPreviewDraft({ ...valido, style: 'auto' })).toBeNull()
    expect(parseStorefrontPreviewDraft({ ...valido, brandColor: 'url(javascript:1)' })).toBeNull()
    expect(parseStorefrontPreviewDraft({ ...valido, headerStyle: 'neon' })).toBeNull()
    expect(parseStorefrontPreviewDraft({ ...valido, type: 'OTRO' })).toBeNull()
    expect(parseStorefrontPreviewDraft({ ...valido, brandColor: 'custom', customBrandColor: 'red;}' })).toMatchObject({ customBrandColor: undefined })
  })
})

describe('carta de la plantilla Servicios', () => {
  it('con turnos online, cada servicio se reserva directo y muestra duración', () => {
    const menu = buildServiceMenu(
      { currency: 'PYG', professionals: [], services: [{ id: 's1', name: 'Corte', duration: 45, price: 50000 }, { id: 's2', name: 'Color', duration: 90, price: null }] },
      [],
      '/salon-ana'
    )
    expect(menu[0]).toMatchObject({ name: 'Corte', duration: '45 min', bookingHref: '/salon-ana/turnos?servicio=s1' })
    expect(menu[1]).toMatchObject({ duration: '1 h 30 min', price: undefined })
  })

  it('sin turnos online, usa los servicios del sitio web activos y sin botón de reserva', () => {
    const menu = buildServiceMenu(null, [
      { id: 'a', title: 'Manicura', description: 'Esmaltado', icon: '', color: '', benefits: [], price: 'Desde 40.000', duration: '40 min' },
      { id: 'b', title: 'Oculto', description: '', icon: '', color: '', benefits: [], active: false },
    ], '/salon-ana')
    expect(menu).toEqual([{ id: 'a', name: 'Manicura', detail: 'Esmaltado', duration: '40 min', price: 'Desde 40.000' }])
  })
})
