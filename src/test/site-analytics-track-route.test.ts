import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const insert = vi.fn()
const resolveOrg = vi.fn()
const db: {
  order: { total: number; created_at: string } | null
  userRole: { role: string; is_active: boolean } | null
  memberRole: string | null
} = { order: null, userRole: null, memberRole: null }
let sessionUserId: string | null = null

function tableQuery(table: string) {
  const result = () => {
    if (table === 'customer_orders') return { data: db.order }
    if (table === 'user_roles') return { data: db.userRole }
    return { data: db.memberRole ? { role: db.memberRole } : null }
  }
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => result(),
    insert,
  }
  return builder
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({ from: (table: string) => tableQuery(table) }),
}))

vi.mock('@/lib/saas/public-tenant', () => ({
  resolvePublicOrganizationBySlug: (slug: string) => resolveOrg(slug),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getClaims: async () => ({ data: sessionUserId ? { claims: { sub: sessionUserId } } : null }) },
  }),
}))

const { POST } = await import('@/app/api/public/analytics/track/route')

const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148'
const ORDER_ID = '4f0c2a51-9d3e-4b8a-a6f1-2c7e5d9b1a03'
let requestCounter = 0

function makeRequest(body: unknown, options: { userAgent?: string; sessionCookie?: boolean } = {}) {
  requestCounter += 1
  const headers: Record<string, string> = {
    'user-agent': options.userAgent ?? BROWSER_UA,
    'x-forwarded-for': `10.0.0.${requestCounter}`,
    'x-vercel-ip-country': 'PY',
  }
  if (options.sessionCookie) {
    headers.cookie = `sb-project-auth-token=token-${requestCounter}`
  }
  return new NextRequest('http://localhost/api/public/analytics/track', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers,
  })
}

const baseEvent = {
  type: 'page_view',
  visitorId: 'visitor-0001',
  sessionId: 'session-0001',
}

describe('POST /api/public/analytics/track', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://supabase.test')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    insert.mockReset().mockResolvedValue({ error: null })
    resolveOrg.mockReset().mockImplementation(async (slug: string) =>
      slug.startsWith('tienda') ? { id: `org-${slug}` } : null
    )
    db.order = null
    db.userRole = null
    db.memberRole = null
    sessionUserId = null
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
      value: null,
      search_term: null,
      results_count: null,
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
    expect((await POST(makeRequest({ ...baseEvent, path: '/tienda-uno/inicio' }, { userAgent: 'Googlebot/2.1' }))).status).toBe(204)
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

  describe('búsquedas', () => {
    it('guarda el término normalizado y la cantidad de resultados', async () => {
      await POST(makeRequest({
        ...baseEvent,
        type: 'search',
        path: '/tienda-uno/productos',
        searchTerm: '  iPhone   15 ',
        resultsCount: 0,
      }))

      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'search',
        search_term: 'iphone 15',
        results_count: 0,
      }))
    })

    it('descarta términos con datos personales o sin cantidad de resultados', async () => {
      await POST(makeRequest({ ...baseEvent, type: 'search', path: '/marketplace/buscar', searchTerm: 'juan@mail.com', resultsCount: 1 }))
      await POST(makeRequest({ ...baseEvent, type: 'search', path: '/marketplace/buscar', searchTerm: '0981 123 456', resultsCount: 1 }))
      await POST(makeRequest({ ...baseEvent, type: 'search', path: '/marketplace/buscar', searchTerm: 'funda' }))

      expect(insert).not.toHaveBeenCalled()
    })
  })

  describe('pedidos', () => {
    it('toma el monto del pedido registrado en la organización', async () => {
      db.order = { total: 350000, created_at: new Date().toISOString() }

      await POST(makeRequest({ ...baseEvent, type: 'order_placed', path: '/tienda-uno/carrito', entityId: ORDER_ID }))

      expect(insert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'order_placed',
        entity_id: ORDER_ID,
        value: 350000,
      }))
    })

    it('ignora pedidos inexistentes, viejos o sin id válido', async () => {
      await POST(makeRequest({ ...baseEvent, type: 'order_placed', path: '/tienda-uno/carrito', entityId: ORDER_ID }))
      db.order = { total: 100, created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() }
      await POST(makeRequest({ ...baseEvent, type: 'order_placed', path: '/tienda-uno/carrito', entityId: ORDER_ID }))
      await POST(makeRequest({ ...baseEvent, type: 'order_placed', path: '/tienda-uno/carrito', entityId: 'no-uuid' }))

      expect(insert).not.toHaveBeenCalled()
    })

    it('no falla si el pedido ya estaba registrado', async () => {
      db.order = { total: 1000, created_at: new Date().toISOString() }
      insert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } })

      const response = await POST(makeRequest({ ...baseEvent, type: 'order_placed', path: '/tienda-uno/carrito', entityId: ORDER_ID }))

      expect(response.status).toBe(204)
    })
  })

  describe('personal de la organización', () => {
    it('no cuenta visitas del personal de la tienda', async () => {
      sessionUserId = 'user-seller'
      db.memberRole = 'seller'

      await POST(makeRequest({ ...baseEvent, path: '/tienda-uno/inicio' }, { sessionCookie: true }))

      expect(insert).not.toHaveBeenCalled()
    })

    it('no cuenta visitas de super admins, ni en el marketplace', async () => {
      sessionUserId = 'user-super'
      db.userRole = { role: 'super_admin', is_active: true }

      await POST(makeRequest({ ...baseEvent, path: '/marketplace' }, { sessionCookie: true }))

      expect(insert).not.toHaveBeenCalled()
    })

    it('sí cuenta a los clientes con sesión iniciada', async () => {
      sessionUserId = 'user-customer'
      db.memberRole = 'customer'

      await POST(makeRequest({ ...baseEvent, path: '/tienda-uno/inicio' }, { sessionCookie: true }))

      expect(insert).toHaveBeenCalledTimes(1)
    })
  })
})
