import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }))
vi.mock('../../mobile/src/lib/supabase', () => ({
  supabase: { auth: { getSession: auth.getSession, signOut: auth.signOut } },
}))
vi.mock('../../mobile/src/lib/marketplace', () => ({ SITE_URL: 'https://tienda.test' }))
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }))
vi.mock('expo-file-system', () => ({
  File: class {
    constructor(public uri: string) {}
    size = 4
    bytes = async () => new Uint8Array([1, 2, 3, 4])
  },
}))

import { setPrivateCacheOrganization, setPrivateCacheUser } from '../../mobile/src/lib/private-cache-context'
import {
  deleteWebsiteMedia,
  fetchStoreBrandsSummary,
  fetchTemplateAccess,
  fetchWebsiteMedia,
  resolveMapsShortLink,
  uploadBrandLogo,
  uploadWebsiteImage,
  uploadWebsiteMedia,
} from '../../mobile/src/lib/website-admin'
import {
  DEFAULT_CHECKOUT_SETTINGS,
  DEFAULT_OFFERS_SECTION,
  DEFAULT_TRUST_BAR,
  EMPTY_ANNOUNCEMENT,
  MAX_GALLERY_IMAGES,
  announcementIssues,
  announcementStatus,
  brandsSectionIssues,
  buildMobileTemplateCatalog,
  buildMobileWebsiteChecklist,
  fillCartTextsFromCompany,
  galleryIssues,
  generateMobileWebsiteSuggestion,
  getConfiguredProcessFlows,
  getServiceSpecialtySuggestions,
  normalizeAnnouncementList,
  normalizeCheckoutSettings,
  offersSectionIssues,
  processFlowIssues,
  resolveMobileCapabilities,
  resolveMobileSectionAvailability,
  resolveWebsiteFocus,
  reviewCartSetup,
  serviceIssues,
  suggestStorefrontAppearance,
  transferAccounts,
  trustBarIssues,
  type TemplateAccessData,
  type WebsiteSettings,
} from '../../mobile/src/lib/website-model'

describe('capacidades, disponibilidad y checklist móvil', () => {
  it('resuelve capacidades retail vs servicios vs reparaciones', () => {
    const retailCaps = resolveMobileCapabilities({
      templateAccess: {
        planCode: 'PRO',
        planName: 'Pro',
        allowed: ['auto', 'classic', 'fashion'],
        businessVertical: 'clothing',
        servicesAvailable: false,
        operatingModel: 'retail',
        effectiveModules: ['inventory', 'orders', 'ecommerce'],
        plans: [],
      },
    })
    const retailAvail = resolveMobileSectionAvailability(retailCaps)
    expect(retailCaps.hasCatalog).toBe(true)
    expect(retailCaps.hasServices).toBe(false)
    expect(retailAvail.checkout.available).toBe(true)
    expect(retailAvail.brands.available).toBe(true)
    expect(retailAvail.booking.available).toBe(false)
    expect(resolveWebsiteFocus(retailCaps)).toBe('retail')

    const barberCaps = resolveMobileCapabilities({
      templateAccess: {
        planCode: 'PRO',
        planName: 'Pro',
        allowed: ['auto', 'services', 'barber'],
        businessVertical: 'barbershop',
        servicesAvailable: true,
        operatingModel: 'service',
        effectiveModules: ['services'],
        serviceSpecialties: ['barbering'],
        plans: [],
      },
    })
    const barberAvail = resolveMobileSectionAvailability(barberCaps)
    expect(barberCaps.primaryAction.href).toBe('/servicios')
    expect(barberAvail.booking.available).toBe(true)
    expect(barberAvail.services.available).toBe(true)
    expect(barberAvail.gallery.available).toBe(true)
    expect(barberAvail.checkout.available).toBe(false)
    expect(resolveWebsiteFocus(barberCaps)).toBe('services')

    const repairCaps = resolveMobileCapabilities({
      templateAccess: {
        planCode: 'PRO',
        planName: 'Pro',
        allowed: ['auto', 'tech'],
        businessVertical: 'electronics',
        servicesAvailable: true,
        operatingModel: 'mixed',
        effectiveModules: ['inventory', 'repairs', 'services'],
        plans: [],
      },
    })
    expect(repairCaps.hasRepairs).toBe(true)
    expect(repairCaps.tracking.href).toBe('/mis-reparaciones')
    expect(resolveWebsiteFocus(repairCaps)).toBe('repairs')
  })

  it('arma el checklist guiado según lo que falta y marca 100% cuando está completo', () => {
    const caps = resolveMobileCapabilities({
      templateAccess: {
        planCode: 'PRO',
        planName: 'Pro',
        allowed: ['auto', 'classic', 'market'],
        businessVertical: 'food',
        servicesAvailable: false,
        operatingModel: 'retail',
        effectiveModules: ['inventory', 'orders'],
        plans: [],
      },
    })

    const incomplete: WebsiteSettings = {
      company_info: { name: 'A', storefrontStyle: 'auto', storefrontPublic: false },
      hero_content: { enabled: true, title: '', subtitle: '' },
      services: [],
      testimonials: [],
      process_steps: [],
      process_flows: [],
    }
    const check1 = buildMobileWebsiteChecklist(incomplete, caps)
    expect(check1.done).toBeLessThan(check1.total)
    expect(check1.next).not.toBeNull()

    const complete: WebsiteSettings = {
      company_info: {
        name: 'Sabores PY',
        logoUrl: 'https://cdn.test/logo.webp',
        whatsapp: '0981123456',
        storefrontStyle: 'market',
        storefrontPublic: true,
      },
      hero_content: {
        enabled: true,
        badge: 'Fresco',
        title: 'Lo de todos los días',
        subtitle: 'Pedidos online en el día',
      },
      checkout: DEFAULT_CHECKOUT_SETTINGS,
      trust_bar: DEFAULT_TRUST_BAR,
      promotional_carousel: {
        enabled: true,
        autoplay: true,
        intervalSeconds: 5,
        slides: [
          {
            id: 's1',
            title: 'Promo',
            message: 'Oferta',
            imageUrl: '/promo.jpg',
            imageAlt: 'Promo',
            active: true,
          },
        ],
      },
      offers_section: DEFAULT_OFFERS_SECTION,
      services: [],
      testimonials: [],
      process_steps: [],
      process_flows: [],
    }
    const check2 = buildMobileWebsiteChecklist(complete, caps)
    expect(check2.done).toBe(check2.total)
    expect(check2.next).toBeNull()
  })
})

describe('catálogo de plantillas, apariencia sugerida y asistente', () => {
  it('clasifica plantillas por plan, modo catálogo y rubro', () => {
    const access: TemplateAccessData = {
      planCode: 'BASIC',
      planName: 'Básico',
      allowed: ['auto', 'classic', 'modern'],
      businessVertical: 'clothing',
      servicesAvailable: false,
      plans: [
        { code: 'BASIC', name: 'Básico', templates: ['auto', 'classic', 'modern'] },
        { code: 'PRO', name: 'Pro', templates: ['auto', 'classic', 'modern', 'fashion', 'sport'] },
      ],
    }

    const groups = buildMobileTemplateCatalog({
      businessVertical: 'clothing',
      context: { servicesAvailable: false, catalogAvailable: true, commerceMode: 'cart' },
      savedValue: 'classic',
      suggestedStyle: 'fashion',
      access,
    })
    const allOptions = groups.flatMap((g) => g.options)
    const fashionOpt = allOptions.find((o) => o.value === 'fashion')
    const classicOpt = allOptions.find((o) => o.value === 'classic')
    const catalogOpt = allOptions.find((o) => o.value === 'catalog-basic')
    const servicesOpt = allOptions.find((o) => o.value === 'services')

    expect(classicOpt?.status).toBe('available')
    expect(fashionOpt?.status).toBe('locked_plan')
    expect(fashionOpt?.upgradePlanName).toBe('Pro')
    expect(fashionOpt?.isSuggested).toBe(true)
    expect(catalogOpt?.status).toBe('unavailable')
    expect(servicesOpt?.status).toBe('unavailable')
  })

  it('sugiere diseño por rubro o modalidad catálogo', () => {
    expect(
      suggestStorefrontAppearance({ businessVertical: 'clothing', commerceMode: 'cart' }).style,
    ).toBe('fashion')
    expect(
      suggestStorefrontAppearance({ businessVertical: 'electronics', commerceMode: 'catalog' }).style,
    ).toBe('catalog-basic')
  })

  it('el asistente genera copy según tono, servicios y beneficios detectados', () => {
    const res = generateMobileWebsiteSuggestion({
      about: 'Vendemos celulares y notebooks en Asunción con envíos a domicilio y cuotas.',
      tone: 'cercano',
      variant: 0,
      name: 'Tecno Asunción',
      vertical: 'electronics',
      focus: 'retail',
      services: [],
      bookingAvailable: false,
      commerceMode: 'cart',
      pending: [{ section: 'hero' }, { section: 'checkout' }],
    })
    expect(res.hero.title.length).toBeGreaterThanOrEqual(10)
    expect(res.hero.subtitle).toContain('Asunción')
    expect(res.trustBar.some((b) => b.icon === 'truck' || b.icon === 'credit-card')).toBe(true)
    expect(res.tips).toHaveLength(2)
  })
})

describe('checkout, ofertas, beneficios, marcas, galería, procesos, servicios y avisos', () => {
  it('checkout: detecta errores bloqueantes, advertencias y autocompleta textos', () => {
    const empty = normalizeCheckoutSettings({
      commerceMode: 'cart',
      payment: {
        cash: { enabled: false },
        card: { enabled: false },
        transfer: { enabled: true, transferOptions: [] },
        digital_wallet: { enabled: true, walletAlias: '', qrImageUrl: '' },
      },
      delivery: { enabled: true, defaultCost: 0, freeThreshold: 100000, estimatedTime: '' },
      pickup: { enabled: false, estimatedTime: '' },
      minOrderAmount: 150000,
    })

    const issues = reviewCartSetup(empty, {
      company: { address: '' },
      deliveryModuleEnabled: true,
    })
    const ids = issues.map((i) => i.id)
    expect(ids).toContain('transfer-no-account')
    expect(ids).toContain('wallet-empty')
    expect(ids).toContain('delivery-time')
    expect(ids).toContain('delivery-no-cost')
    expect(ids).toContain('free-below-min')

    const legacyAccounts = transferAccounts({
      enabled: true,
      bankName: 'Itaú',
      bankAlias: '1234567',
      bankCbu: '000111',
    })
    expect(legacyAccounts[0]).toMatchObject({ bankName: 'Itaú', alias: '1234567' })

    const filled = fillCartTextsFromCompany(empty, {
      name: 'Café Centro',
      address: 'Palma 420',
      hours: { weekdays: '8 a 18' },
      whatsapp: '0981555000',
    })
    expect(filled.pickup.instructions).toContain('Palma 420')
    expect(filled.delivery.instructions).toContain('0981555000')
    expect(filled.confirmationMessage).toContain('Café Centro')
  })

  it('ofertas, trust bar y marcas validan longitudes y enlaces seguros', () => {
    expect(offersSectionIssues(DEFAULT_OFFERS_SECTION)).toEqual({})
    expect(offersSectionIssues({ eyebrow: 'a', title: 'b', subtitle: 'c' })).toHaveProperty('title')

    expect(trustBarIssues(DEFAULT_TRUST_BAR)).toEqual({})
    expect(
      trustBarIssues({
        enabled: true,
        items: [{ icon: 'check', title: '   ' }],
      }),
    ).toHaveProperty('item_0')

    expect(
      brandsSectionIssues({
        enabled: true,
        title: 'Marcas',
        items: [{ id: '1', name: 'Samsung', active: true, href: 'javascript:alert(1)' }],
      }),
    ).toHaveProperty('item_0_href')
  })

  it('galería, procesos y servicios aplican reglas de validación y presets', () => {
    const tooManyPhotos = Array.from({ length: MAX_GALLERY_IMAGES + 1 }, (_, i) => ({
      id: `p-${i}`,
      url: `https://cdn.test/${i}.jpg`,
    }))
    expect(galleryIssues({ enabled: true, images: tooManyPhotos })).toHaveProperty('images')

    const hydratedFlows = getConfiguredProcessFlows(undefined, [
      { id: 's1', number: 1, title: 'Paso 1', description: 'Descripción válida del paso' },
    ])
    expect(hydratedFlows).toHaveLength(1)
    expect(processFlowIssues(hydratedFlows)).toEqual({})
    expect(
      processFlowIssues([
        {
          id: 'f1',
          title: 'X',
          steps: [{ id: 'st1', number: 1, title: 'A', description: 'abc' }],
        },
      ]),
    ).toHaveProperty('flow_0_title')

    expect(
      serviceIssues({
        title: 'Corte',
        description: 'Corte clásico a tijera y máquina',
        benefits: ['Lavado'],
        ctaUrl: '//evil.test',
      }),
    ).toHaveProperty('ctaUrl')
    expect(getServiceSpecialtySuggestions(['barbering', 'nails'])).toHaveLength(4)
  })

  it('avisos emergentes: normaliza legacy, estado en fechas y validaciones', () => {
    const single = {
      ...EMPTY_ANNOUNCEMENT,
      id: '',
      enabled: true,
      title: 'Promo Flash',
      message: 'Descuentos todo el finde',
      startsAt: '2026-01-01',
      endsAt: '2026-12-31',
    }
    const list = normalizeAnnouncementList(single)
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('aviso-1')

    expect(announcementStatus(list[0], new Date('2026-06-15T12:00:00Z'))).toBe('activo')
    expect(announcementStatus(list[0], new Date('2025-12-01T12:00:00Z'))).toBe('programado')
    expect(announcementStatus(list[0], new Date('2027-01-15T12:00:00Z'))).toBe('vencido')

    expect(
      announcementIssues({
        ...list[0],
        ctaLabel: 'Ver',
        ctaHref: '',
        startsAt: '2026-12-10',
        endsAt: '2026-12-01',
      }),
    ).toMatchObject({
      ctaHref: expect.any(String),
      endsAt: expect.any(String),
    })
  })
})

describe('nuevos endpoints Studio en website-admin', () => {
  const calls: Array<{ url: string; init: RequestInit }> = []

  beforeEach(() => {
    calls.length = 0
    setPrivateCacheUser(null)
    setPrivateCacheUser('user-studio')
    setPrivateCacheOrganization('org-studio')
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'tok-studio', user: { id: 'user-studio' } } },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init })
        if (url.includes('/storefront-templates')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { planCode: 'PRO', planName: 'Pro', allowed: ['auto', 'classic'], businessVertical: 'general', servicesAvailable: false, plans: [] },
            }),
          )
        }
        if (url.includes('/api/admin/website/media')) {
          if (init.method === 'POST') {
            return new Response(
              JSON.stringify({
                success: true,
                item: { id: 'm1', url: 'https://cdn.test/m1.webp', path: 'p/m1.webp', name: 'm1.webp' },
                count: 5,
                limit: 20,
              }),
            )
          }
          if (init.method === 'DELETE') {
            return new Response(JSON.stringify({ success: true, count: 4, limit: 20 }))
          }
          return new Response(
            JSON.stringify({
              success: true,
              items: [{ id: 'm1', url: 'https://cdn.test/m1.webp', path: 'p/m1.webp', name: 'm1.webp' }],
              count: 1,
              limit: 20,
            }),
          )
        }
        if (url.includes('/brand-logo') || url.includes('/promotion-image')) {
          return new Response(JSON.stringify({ success: true, url: 'https://cdn.test/uploaded.webp' }))
        }
        if (url.includes('/maps-link')) {
          return new Response(
            JSON.stringify({ url: 'https://maps.google.com/@-25.28,-57.63,15z', resolved: true, coordinates: { lat: -25.28, lng: -57.63 } }),
          )
        }
        if (url.includes('/api/brands')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: [{ id: 'b1', name: 'Samsung', logo_url: 'https://cdn.test/samsung.png', stats: { product_count: 5 } }],
            }),
          )
        }
        if (url.includes('/api/products')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                products: [
                  { id: 'p1', brand: 'Samsung', purchase_price: 999 },
                  { id: 'p2', brand: 'Apple', purchase_price: 1500 },
                  { id: 'p3', brand: 'Apple', purchase_price: 1800 },
                ],
              },
            }),
          )
        }
        return new Response(JSON.stringify({ success: true }))
      }),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('consulta storefront-templates y media library con headers de organización', async () => {
    const access = await fetchTemplateAccess()
    expect(access?.planCode).toBe('PRO')
    expect((calls[0].init.headers as Record<string, string>)['x-organization-id']).toBe('org-studio')

    const quota = await fetchWebsiteMedia()
    expect(quota).toEqual({
      items: [{ id: 'm1', url: 'https://cdn.test/m1.webp', path: 'p/m1.webp', name: 'm1.webp' }],
      count: 1,
      limit: 20,
    })

    const uploaded = await uploadWebsiteMedia({ uri: 'file:///a.jpg', mimeType: 'image/jpeg' }, 'gallery', 'foto-taller')
    expect(uploaded.count).toBe(5)
    expect((calls[2].init.body as FormData).get('section')).toBe('gallery')

    const deleted = await deleteWebsiteMedia({ id: 'm1' })
    expect(deleted.count).toBe(4)
  })

  it('sube aviso, galería y logo de marca a las rutas exactas sin organization_id', async () => {
    await uploadWebsiteImage('aviso', { uri: 'file:///aviso.png', mimeType: 'image/png' })
    expect((calls[0].init.body as FormData).get('slideId')).toBe('aviso')

    await uploadWebsiteImage('gallery', { uri: 'file:///gal.jpg' }, '1')
    expect((calls[1].init.body as FormData).get('slideId')).toBe('galeria-1')

    await uploadBrandLogo({ uri: 'file:///brand.png', mimeType: 'image/png' }, 'nike')
    expect(calls[2].url).toMatch(/\/api\/admin\/website\/brand-logo$/)
    expect((calls[2].init.body as FormData).get('brandId')).toBe('nike')
    expect([...(calls[2].init.body as FormData).keys()]).not.toContain('organization_id')
  })

  it('resuelve maps short link y resume marcas del catálogo sin filtrar precios de costo', async () => {
    const maps = await resolveMapsShortLink('https://maps.app.goo.gl/xyz')
    expect(maps.resolved).toBe(true)
    expect(maps.coordinates).toEqual({ lat: -25.28, lng: -57.63 })

    const brands = await fetchStoreBrandsSummary()
    expect(brands).toEqual([
      { id: 'apple', name: 'Apple', productCount: 2, isFromBrandsTable: false },
      { id: 'b1', name: 'Samsung', logoUrl: 'https://cdn.test/samsung.png', productCount: 5, isFromBrandsTable: true },
    ])
    expect(JSON.stringify(brands)).not.toMatch(/purchase_price/)
  })
})
