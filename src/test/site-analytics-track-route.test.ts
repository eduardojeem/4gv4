import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const insert = vi.fn()
const resolveOrg = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({ from: () => ({ insert }) }),
}))

vi.mock('@/lib/saas/public-tenant', () => ({
  resolvePublicOrganizationBySlug: (slug: string) => resolveOrg(slug),
}))

const { POST } = await import('@/app/api/public/analytics/track/route')

const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148'
let ipCounter = 0

function makeRequest(body: unknown, userAgent = BROWSER_UA) {
  ipCounter += 1
  return new NextRequest('http://localhost/api/public/analytics/track', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      'user-agent': userAgent,
      'x-forwarded-for': `10.0.0.${ipCounter}`,
      'x-vercel-ip-country': 'PY',
    },
  })
}

const baseEvent = {
  type: 'page_view',
  visitorId: 'visitor-0001',
  sessionId: 'session-0001',
}

describe('POST /api/public/analytics/track', () => {
  beforeEach(() => {
    insert.mockReset().mockResolvedValue({ error: null })
    resolveOrg.mockReset().mockImplementation(async (slug: string) =>
      slug.startsWith('tienda') ? { id: `org-${slug}` } : null
    )
  })

  it('guarda la visita atribuida a la organización derivada de la ruta', async () => {
    const response = await POST(makeRequest({
      ...baseEvent,
      path: '/tienda-uno/productos/prod-1',
      referrerHost: 'Google.com',
      utmSource: ' Instagram ',
    }))

    expect(response.status).toBe(204)
    expect(insert).toHaveBeenCalledWith({
      organization_id: 'org-tienda-uno',
      site: 'storefront',
      event_type: 'page_view',
      path: '/tienda-uno/productos/prod-1',
      page_type: 'producto',
      entity_id: 'prod-1',
      visitor_id: 'visitor-0001',
      session_id: 'session-0001',
      referrer_host: 'google.com',
      utm_source: 'instagram',
      device: 'mobile',
      country: 'PY',
    })
  })

  it('usa el entityId del cliente solo para interacciones', async () => {
    await POST(makeRequest({ ...baseEvent, type: 'add_to_cart', path: '/tienda-uno/ofertas', entityId: 'prod-9' }))

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'add_to_cart',
      page_type: null,
      entity_id: 'prod-9',
    }))
  })

  it('registra el marketplace general sin organización', async () => {
    await POST(makeRequest({ ...baseEvent, path: '/marketplace' }))

    expect(resolveOrg).not.toHaveBeenCalled()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ organization_id: null, site: 'marketplace' }))
  })

  it('descarta bots, rutas no públicas y tiendas inexistentes', async () => {
    expect((await POST(makeRequest({ ...baseEvent, path: '/tienda-uno/inicio' }, 'Googlebot/2.1'))).status).toBe(204)
    expect((await POST(makeRequest({ ...baseEvent, path: '/admin/visitas' }))).status).toBe(204)
    expect((await POST(makeRequest({ ...baseEvent, path: '/desconocida/inicio' }))).status).toBe(204)

    expect(insert).not.toHaveBeenCalled()
  })

  it('rechaza payloads inválidos', async () => {
    expect((await POST(makeRequest('no-json'))).status).toBe(400)
    expect((await POST(makeRequest({ ...baseEvent, type: 'hack', path: '/tienda-uno/inicio' }))).status).toBe(400)
    expect((await POST(makeRequest({ ...baseEvent, visitorId: 'x', path: '/tienda-uno/inicio' }))).status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })
})
