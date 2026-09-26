import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setSiteAnalyticsTenant, trackSitePageView } from '@/lib/site-analytics/client'
import { classifySitePage, normalizeSearchTerm, parseSiteAnalyticsRangeDays } from '@/lib/site-analytics/shared'
import { getCountryFromHeaders, getDeviceFromUserAgent, isBotUserAgent } from '@/lib/site-analytics/server'

describe('classifySitePage', () => {
  it('clasifica páginas de la tienda de una organización', () => {
    expect(classifySitePage('/mi-tienda/inicio')).toEqual({
      site: 'storefront',
      orgSlug: 'mi-tienda',
      path: '/mi-tienda/inicio',
      pageType: 'inicio',
      entityId: null,
    })
  })

  it('extrae el producto del detalle y descarta la query', () => {
    expect(classifySitePage('/mi-tienda/productos/abc-123?utm_source=ig')).toEqual({
      site: 'storefront',
      orgSlug: 'mi-tienda',
      path: '/mi-tienda/productos/abc-123',
      pageType: 'producto',
      entityId: 'abc-123',
    })
  })

  it('no mide las páginas de la cuenta del cliente', () => {
    expect(classifySitePage('/mi-tienda/mis-reparaciones/TCK-991')).toBeNull()
    expect(classifySitePage('/mi-tienda/perfil')).toBeNull()
    expect(classifySitePage('/mi-tienda/cliente/login')).toBeNull()
  })

  it('agrupa el seguimiento en su sección para no guardar ids de pedidos', () => {
    expect(classifySitePage('/mi-tienda/track/PED-991')?.path).toBe('/mi-tienda/track')
  })

  it('atribuye el perfil de empresa del marketplace a la organización', () => {
    expect(classifySitePage('/marketplace/empresas/mi-tienda')).toMatchObject({
      site: 'marketplace',
      orgSlug: 'mi-tienda',
      pageType: 'empresa',
    })
    expect(classifySitePage('/marketplace')).toMatchObject({ site: 'marketplace', orgSlug: null })
    expect(classifySitePage('/marketplace/buscar')).toMatchObject({ pageType: 'buscar', orgSlug: null })
  })

  it('ignora rutas que no son públicas', () => {
    expect(classifySitePage('/admin/visitas')).toBeNull()
    expect(classifySitePage('/dashboard/products')).toBeNull()
    expect(classifySitePage('/api/public/analytics/track')).toBeNull()
    expect(classifySitePage('/marketplace/otra-cosa')).toBeNull()
    expect(classifySitePage('/Mi_Tienda/inicio')).toBeNull()
  })
})

describe('normalizeSearchTerm', () => {
  it('normaliza mayúsculas y espacios', () => {
    expect(normalizeSearchTerm('  Samsung   A55 ')).toBe('samsung a55')
  })

  it('descarta términos muy cortos o con datos personales', () => {
    expect(normalizeSearchTerm('a')).toBeNull()
    expect(normalizeSearchTerm('cliente@correo.com')).toBeNull()
    expect(normalizeSearchTerm('0981-123-456')).toBeNull()
    expect(normalizeSearchTerm('4.567.890')).toBeNull()
    expect(normalizeSearchTerm('iphone 15 pro 256gb')).toBe('iphone 15 pro 256gb')
  })
})

describe('parseSiteAnalyticsRangeDays', () => {
  it('acepta solo los rangos soportados', () => {
    expect(parseSiteAnalyticsRangeDays('7')).toBe(7)
    expect(parseSiteAnalyticsRangeDays('1')).toBe(1)
    expect(parseSiteAnalyticsRangeDays('365')).toBe(30)
    expect(parseSiteAnalyticsRangeDays(null)).toBe(30)
  })
})

describe('detección de visitantes', () => {
  it('filtra bots y previsualizaciones de links', () => {
    expect(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
    expect(isBotUserAgent('WhatsApp/2.23.20.0')).toBe(true)
    expect(isBotUserAgent('')).toBe(true)
    expect(isBotUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36')).toBe(false)
  })

  it('detecta el tipo de dispositivo', () => {
    expect(getDeviceFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148')).toBe('mobile')
    expect(getDeviceFromUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S918B) Chrome/128.0 Mobile Safari/537.36')).toBe('mobile')
    expect(getDeviceFromUserAgent('Mozilla/5.0 (Linux; Android 13; SM-X700) Chrome/128.0 Safari/537.36')).toBe('tablet')
    expect(getDeviceFromUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('tablet')
    expect(getDeviceFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe('desktop')
  })

  it('lee el país de los headers del edge', () => {
    expect(getCountryFromHeaders(new Headers({ 'x-vercel-ip-country': 'py' }))).toBe('PY')
    expect(getCountryFromHeaders(new Headers({ 'cf-ipcountry': 'XX' }))).toBeNull()
    expect(getCountryFromHeaders(new Headers())).toBeNull()
  })
})

describe('contador en el navegador', () => {
  const beacon = vi.fn((_url: string, _body?: BodyInit | null) => true)

  async function sentBodies() {
    const readText = (blob: Blob) =>
      new Promise<string>((done) => {
        const reader = new FileReader()
        reader.onload = () => done(String(reader.result))
        reader.readAsText(blob)
      })
    return Promise.all(beacon.mock.calls.map(async ([, body]) => JSON.parse(await readText(body as Blob))))
  }

  beforeEach(() => {
    beacon.mockClear()
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true })
    Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true })
  })

  afterEach(() => {
    setSiteAnalyticsTenant(null)
  })

  it('respeta «No rastrear» del navegador', () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true })

    trackSitePageView('/mi-tienda/ofertas')

    expect(beacon).not.toHaveBeenCalled()
  })

  it('en una tienda con dominio propio agrega el slug a la ruta', async () => {
    setSiteAnalyticsTenant('mi-tienda')

    trackSitePageView('/productos')
    trackSitePageView('/')

    expect((await sentBodies()).map((body) => body.path)).toEqual(['/mi-tienda/productos', '/mi-tienda/inicio'])
  })

  it('no manda nada desde el panel ni la API', () => {
    trackSitePageView('/admin/visitas')
    trackSitePageView('/dashboard/pos')

    expect(beacon).not.toHaveBeenCalled()
  })
})

describe('un solo registro de visitas', () => {
  const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

  it('las dos plantillas de tienda y el marketplace montan el contador', () => {
    expect(leer('src/app/[organizationSlug]/layout.tsx')).toContain('<SiteAnalyticsTracker />')
    expect(leer('src/app/(public)/layout.tsx')).toContain('<SiteAnalyticsTracker tenantSlug={storefrontOrganization.slug} />')
    expect(leer('src/app/marketplace/layout.tsx')).toContain('<SiteAnalyticsTracker />')
  })

  it('el panel de Landing lee los contadores del registro nuevo', () => {
    const landing = leer('src/app/superadmin/web-content/landing/page.tsx')
    expect(landing).toContain("admin.rpc('get_storefront_daily_visits'")
    expect(landing).not.toContain("from('storefront_daily_visits')")
  })

  it('solo el servidor lee los eventos y los contadores', () => {
    for (const archivo of [
      'supabase/migrations/20260925120000_site_analytics.sql',
      'supabase/migrations/20260926100000_storefront_visits_from_site_analytics.sql',
    ]) {
      const sql = leer(archivo)
      expect(sql).not.toMatch(/create policy/i)
      expect(sql).not.toMatch(/ip_address|user_agent/i)
    }
    expect(leer('supabase/migrations/20260926100000_storefront_visits_from_site_analytics.sql'))
      .toContain('grant execute on function public.get_storefront_daily_visits(date, date, text) to service_role')
  })
})
