import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }))
vi.mock('../../mobile/src/lib/supabase', () => ({ supabase: { auth: { getSession: auth.getSession, signOut: auth.signOut } } }))
vi.mock('../../mobile/src/lib/marketplace', () => ({ SITE_URL: 'https://tienda.test' }))
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }))
// La app lee la imagen elegida con expo-file-system (fetch no abre rutas file:// codificadas).
vi.mock('expo-file-system', () => ({
  File: class {
    constructor(public uri: string) {}
    size = 3
    bytes = async () => new Uint8Array([1, 2, 3])
  },
}))

import { setPrivateCacheOrganization, setPrivateCacheUser } from '../../mobile/src/lib/private-cache-context'
import {
  saveCompanyInfo,
  saveWebsiteSettings,
  searchStoreProducts,
  setProductFeatured,
  uploadWebsiteImage,
  websiteErrorMessage,
} from '../../mobile/src/lib/website-admin'
import { ApiError } from '../../mobile/src/lib/api'
import {
  HOME_SECTIONS,
  buildCompanyPayload,
  companyIssues,
  emptySlide,
  heroIssues,
  isActivatingPublication,
  isDirty,
  isSafeLinkOrPath,
  isValidGoogleMapsUrl,
  isValidSocial,
  mergeSetting,
  moveItem,
  publicStoreUrl,
  publicationIssues,
  sectionEnabled,
  slideIssues,
  slugIssue,
  socialHandle,
  toPublicProduct,
  type CompanyInfo,
  type WebsiteSettings,
} from '../../mobile/src/lib/website-model'

const saved: CompanyInfo = {
  name: 'Mi Tienda', phone: '0981123456', email: 'hola@tienda.test', address: 'Asunción', slug: 'mi-tienda',
  hours: { weekdays: '8 a 18', saturday: '8 a 12', sunday: 'Cerrado' },
  brandColor: 'green', storefrontStyle: 'fashion', instagram: '@mitienda', storefrontPublic: true, marketplacePublic: true,
  ruc: '80000000-1', serviceSpecialties: ['barberia'],
}

describe('mezcla de cambios: undefined nunca borra lo guardado', () => {
  it('ignora undefined y conserva los campos que la app no toca', () => {
    const next = mergeSetting(saved, { name: undefined, slogan: 'Nuevo', hours: { saturday: '9 a 13' } })
    expect(next.name).toBe('Mi Tienda')
    expect(next.slogan).toBe('Nuevo')
    expect(next.hours).toEqual({ weekdays: '8 a 18', saturday: '9 a 13', sunday: 'Cerrado' })
    expect(next.ruc).toBe('80000000-1')
    expect(next.serviceSpecialties).toEqual(['barberia'])
  })

  it('una lista se reemplaza entera (el orden de los banners se guarda)', () => {
    expect(mergeSetting({ slides: [1, 2, 3] }, { slides: [3, 1] }).slides).toEqual([3, 1])
  })

  it('un null explícito sí se guarda (es una elección, no «sin cambios»)', () => {
    expect(mergeSetting({ a: 'x' } as Record<string, unknown>, { a: null }).a).toBeNull()
  })

  it('detecta cambios sin contar vacío y ausente como distintos', () => {
    expect(isDirty({ a: '' }, {})).toBe(false)
    expect(isDirty({ a: 'x' }, { a: 'y' })).toBe(true)
    expect(isDirty(saved, mergeSetting(saved, {}))).toBe(false)
  })
})

describe('empresa: payload completo para sync-company', () => {
  it('manda lo guardado más lo editado y no apaga la publicación', () => {
    const payload = buildCompanyPayload(saved, { slogan: 'Hola' })
    expect(payload).toMatchObject({ name: 'Mi Tienda', slogan: 'Hola', slug: 'mi-tienda', brandColor: 'green', storefrontStyle: 'fashion', instagram: '@mitienda', storefrontPublic: true, marketplacePublic: true, publicationConfirmed: false })
    expect(payload.ruc).toBe('80000000-1')
    expect('organization_id' in payload).toBe(false)
  })

  it('sin tienda publicada no puede quedar en el marketplace', () => {
    expect(buildCompanyPayload(saved, { storefrontPublic: false }).marketplacePublic).toBe(false)
  })

  it('pone los mismos valores por defecto que la web cuando faltan', () => {
    const payload = buildCompanyPayload({ name: 'X Y' }, {})
    expect(payload).toMatchObject({ brandColor: 'blue', headerStyle: 'glass', storefrontStyle: 'auto', showTopBar: true, hours: { weekdays: '', saturday: '', sunday: '' } })
  })

  it('reconoce cuándo se está publicando (pide confirmación)', () => {
    expect(isActivatingPublication({ storefrontPublic: false }, { storefrontPublic: true })).toBe(true)
    expect(isActivatingPublication({ storefrontPublic: true }, { storefrontPublic: true })).toBe(false)
    expect(isActivatingPublication({ storefrontPublic: true }, { storefrontPublic: false })).toBe(false)
  })

  it('exige lo mismo que el servidor para publicar', () => {
    expect(publicationIssues({ name: 'A', phone: '1' })).toHaveLength(2)
    expect(publicationIssues({ name: 'Tienda', phone: '0981123456' })).toEqual([])
    expect(publicationIssues({ name: 'Tienda', phone: '' , whatsapp: '' }, 'whatsapp').length).toBeGreaterThan(0)
  })
})

describe('validaciones (espejo del servidor)', () => {
  it('enlaces: rutas de la tienda o http(s); nunca javascript: ni //', () => {
    for (const ok of ['', '/ofertas', 'https://tienda.test/x', 'http://a.b']) expect(isSafeLinkOrPath(ok)).toBe(true)
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.test', 'ftp://x', 'tienda.com']) expect(isSafeLinkOrPath(bad)).toBe(false)
  })

  it('redes: acepta usuario o enlace del perfil', () => {
    expect(socialHandle('https://www.instagram.com/mitienda/?hl=es', 'instagram')).toBe('mitienda')
    expect(socialHandle('@mitienda', 'tiktok')).toBe('mitienda')
    expect(isValidSocial('facebook.com/mi.tienda', 'facebook')).toBe(true)
    expect(isValidSocial('https://instagram.com/<script>', 'instagram')).toBe(false)
  })

  it('Google Maps: solo enlaces https de Google', () => {
    expect(isValidGoogleMapsUrl('https://maps.app.goo.gl/abc')).toBe(true)
    expect(isValidGoogleMapsUrl('https://www.google.com/maps/place/x')).toBe(true)
    expect(isValidGoogleMapsUrl('http://maps.app.goo.gl/abc')).toBe(false)
    expect(isValidGoogleMapsUrl('https://evil.test/maps')).toBe(false)
  })

  it('dirección pública', () => {
    expect(slugIssue('ok-123')).toBeNull()
    expect(slugIssue('ab')).not.toBeNull()
    expect(slugIssue('Mi Tienda')).not.toBeNull()
  })

  it('empresa: email, color HEX y redes inválidos', () => {
    const issues = companyIssues({ name: 'Tienda', email: 'mal', brandColor: 'custom', customBrandColor: 'azul', instagram: 'a b c' })
    expect(Object.keys(issues).sort()).toEqual(['customBrandColor', 'email', 'instagram'])
  })

  it('portada: textos mínimos solo si está prendida', () => {
    expect(Object.keys(heroIssues({ enabled: true, badge: 'a', title: 'corto', subtitle: 'x' }))).toEqual(['badge', 'title', 'subtitle'])
    expect(heroIssues({ enabled: false })).toEqual({})
  })

  it('banner: imagen, descripción y botón completo o vacío', () => {
    const slide = emptySlide()
    expect(Object.keys(slideIssues(slide)).sort()).toEqual(['imageAlt', 'imageUrl'])
    expect(slideIssues({ ...slide, imageUrl: 'https://cdn.test/a.webp', imageAlt: 'Ofertas', ctaText: 'Ver' })).toHaveProperty('ctaText')
    expect(slideIssues({ ...slide, imageUrl: 'https://cdn.test/a.webp', imageAlt: 'Ofertas', ctaHref: 'javascript:x' })).toHaveProperty('ctaHref')
    expect(slideIssues({ ...slide, imageUrl: 'https://cdn.test/a.webp', imageAlt: 'Ofertas', ctaText: 'Ver', ctaHref: '/ofertas' })).toEqual({})
  })
})

describe('listas, secciones y URL pública', () => {
  it('Subir / Bajar sin salirse de la lista', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
  })

  it('el interruptor de cada sección lee el campo real o el valor por defecto', () => {
    const settings = { company_info: { processSectionEnabled: false }, hero_content: { enabled: true }, brands_section: {} } as WebsiteSettings
    const byId = Object.fromEntries(HOME_SECTIONS.map((section) => [section.id, sectionEnabled(settings, section)]))
    expect(byId).toMatchObject({ hero: true, process: false, brands: false })
  })

  it('arma la URL pública con el slug de la organización', () => {
    expect(publicStoreUrl('https://tienda.test/', 'mi-tienda')).toBe('https://tienda.test/mi-tienda')
    expect(publicStoreUrl('https://tienda.test', '')).toBeNull()
  })
})

describe('S1: destacados sin datos privados', () => {
  it('solo conserva campos públicos aunque la API devuelva el costo al dueño', () => {
    const product = toPublicProduct({ id: 'p1', name: 'Zapatilla', sale_price: 200, purchase_price: 100, foreign_purchase_price: 5, margin: 50, cost: 1, has_offer: true, offer_price: 180, images: ['a.jpg'], stock_quantity: 3, is_active: true, featured: true })
    expect(product).toEqual({ id: 'p1', name: 'Zapatilla', salePrice: 200, offerPrice: 180, image: 'a.jpg', isActive: true, featured: true, stock: 3 })
    expect(JSON.stringify(product)).not.toMatch(/purchase|cost|margin/i)
  })
})

describe('APIs de la app: mismas rutas que la web, organización resuelta por el servidor', () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  beforeEach(() => {
    calls.length = 0
    setPrivateCacheUser(null); setPrivateCacheUser('user-1'); setPrivateCacheOrganization('org-1')
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'token-1', user: { id: 'user-1' } } } })
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      if (url.includes('/api/products?')) return new Response(JSON.stringify({ data: { products: [{ id: 'p1', name: 'A', sale_price: 10, purchase_price: 4, featured: false }] } }))
      if (url.includes('/logo') || url.includes('/promotion-image')) return new Response(JSON.stringify({ success: true, url: 'https://cdn.test/x.webp' }))
      return new Response(JSON.stringify({ success: true, data: { name: 'Mi Tienda' } }))
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  const headers = (init: RequestInit) => init.headers as Record<string, string>

  it('guarda claves completas por PUT /api/admin/website/settings, sin organization_id', async () => {
    await saveWebsiteSettings({ hero_content: { enabled: true, title: 'Título largo de prueba' }, trust_bar: undefined })
    expect(calls[0].url).toMatch(/\/api\/admin\/website\/settings$/)
    expect(calls[0].init.method).toBe('PUT')
    const body = JSON.parse(String(calls[0].init.body))
    expect(Object.keys(body.values)).toEqual(['hero_content'])
    expect(JSON.stringify(body)).not.toMatch(/organization/)
    expect(headers(calls[0].init).Authorization).toBe('Bearer token-1')
    expect(headers(calls[0].init)['x-organization-id']).toBe('org-1')
  })

  it('no hace pedidos cuando no hay nada que guardar', async () => {
    expect(await saveWebsiteSettings({ hero_content: undefined })).toEqual({})
    expect(calls).toHaveLength(0)
  })

  it('la empresa va completa por sync-company', async () => {
    await saveCompanyInfo(saved, { slogan: 'Hola' })
    expect(calls[0].url).toMatch(/\/api\/admin\/website\/sync-company$/)
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ name: 'Mi Tienda', slug: 'mi-tienda', slogan: 'Hola', ruc: '80000000-1' })
  })

  it('sube imágenes por el servidor, en multipart y sin forzar JSON', async () => {
    const append = vi.spyOn(FormData.prototype, 'append')
    const url = await uploadWebsiteImage('banner', { uri: 'file:///foto.jpg', mimeType: 'image/jpeg' }, 'slide-1')
    // La parte del archivo es la que entiende el fetch de Expo: nombre, tipo y bytes(), no { uri }.
    const part = append.mock.calls.find(([key]) => key === 'file')?.[1] as unknown as { name: string; type: string; uri?: string; bytes: () => Promise<Uint8Array> }
    expect(part).toMatchObject({ name: 'imagen.jpg', type: 'image/jpeg' })
    expect(part.uri).toBeUndefined()
    expect([...(await part.bytes())]).toEqual([1, 2, 3])
    append.mockRestore()
    expect(url).toBe('https://cdn.test/x.webp')
    expect(calls[0].url).toMatch(/\/api\/admin\/website\/promotion-image$/)
    expect(calls[0].init.body).toBeInstanceOf(FormData)
    expect(headers(calls[0].init)['Content-Type']).toBeUndefined()
    const form = calls[0].init.body as FormData
    expect(form.get('slideId')).toBe('slide-1')
    expect([...form.keys()]).not.toContain('organization_id')
    await uploadWebsiteImage('logo', { uri: 'file:///logo.png', mimeType: 'image/png' })
    expect(calls[1].url).toMatch(/\/api\/admin\/website\/logo$/)
  })

  it('busca productos del comercio activo y descarta el costo', async () => {
    const products = await searchStoreProducts('zapa', true)
    expect(calls[0].url).toContain('query=zapa')
    expect(calls[0].url).toContain('featured=true')
    expect(JSON.stringify(products)).not.toMatch(/purchase/)
  })

  it('destacar actualiza solo el campo featured del producto', async () => {
    await setProductFeatured('p1', true)
    expect(calls[0].url).toMatch(/\/api\/products\/p1$/)
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ featured: true })
  })
})

describe('mensajes para la persona', () => {
  it('no muestra errores técnicos', () => {
    expect(websiteErrorMessage(new ApiError('x', 0), 'fallback')).toMatch(/Sin conexión/)
    expect(websiteErrorMessage(new ApiError('Forbidden', 403), 'fallback')).toMatch(/dueño o un administrador/)
    expect(websiteErrorMessage(new ApiError('La ruta publica ya esta en uso por otra organizacion', 409), 'fallback')).toMatch(/ya esta en uso/)
    expect(websiteErrorMessage(new ApiError('Failed to update setting', 400), 'fallback')).toBe('fallback')
    expect(websiteErrorMessage(new ApiError('duplicate key value violates unique constraint "x_key"', 409), 'fallback')).toBe('fallback')
    expect(websiteErrorMessage(new Error('boom'), 'fallback')).toBe('fallback')
    expect(websiteErrorMessage(new ApiError('Error al subir imagen: Bucket not found', 500), 'Revisá tu conexión')).toMatch(/problema en el servidor/)
  })
})
