import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render } from '@testing-library/react'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn(async () => ({ error: null }))
const maybeSingle = vi.fn(async () => ({ data: { id: ORG } }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }),
  }),
}))
vi.mock('@/lib/rate-limiter', () => ({
  rateLimiter: { check: vi.fn(async () => true) },
  getClientIp: () => '1.2.3.4',
}))

let pathname = '/hca-celular/productos'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

const ORG = '3f2b1a44-1111-4222-8333-444455556666'
const NAVEGADOR = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36'

const pedido = (body: unknown, userAgent = NAVEGADOR) =>
  new NextRequest('http://localhost/api/public/storefront-visit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'user-agent': userAgent },
  })

describe('registro de visitas a una tienda', () => {
  beforeEach(() => {
    rpc.mockClear()
    maybeSingle.mockClear()
  })

  it('anota la página y si es una persona nueva', async () => {
    const { POST } = await import('@/app/api/public/storefront-visit/route')
    const res = await POST(pedido({ organizationId: ORG, page: 'producto', newVisitor: true }))
    expect(res.status).toBe(204)
    expect(rpc).toHaveBeenCalledWith('record_storefront_visit', { p_organization_id: ORG, p_page: 'producto', p_new_visitor: true })
  })

  it('ignora buscadores, páginas desconocidas e ids inválidos, sin romper nada', async () => {
    const { POST } = await import('@/app/api/public/storefront-visit/route')
    expect((await POST(pedido({ organizationId: ORG, page: 'inicio' }, 'Googlebot/2.1'))).status).toBe(204)
    expect((await POST(pedido({ organizationId: ORG, page: 'admin' }))).status).toBe(204)
    expect((await POST(pedido({ organizationId: 'x', page: 'inicio' }))).status).toBe(204)
    expect(rpc).not.toHaveBeenCalled()
  })

  /** El id viaja en la página: cualquiera podría mandar el de una tienda oculta. */
  it('no cuenta visitas de tiendas que no son públicas', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null })
    const { POST } = await import('@/app/api/public/storefront-visit/route')
    const otra = '9f2b1a44-1111-4222-8333-444455556666'
    await POST(pedido({ organizationId: otra, page: 'inicio' }))
    expect(rpc).not.toHaveBeenCalled()
  })

  it('la tabla guarda contadores, no datos de la persona, y solo el servidor escribe', () => {
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260916120000_storefront_daily_visits.sql'), 'utf8')
    expect(sql).toContain('enable row level security')
    expect(sql).not.toMatch(/create policy/i)
    expect(sql).not.toMatch(/ip_address|user_agent/i)
    expect(sql).toContain('grant execute on function public.record_storefront_visit(uuid, text, boolean) to service_role')
  })

  it('las dos plantillas de tienda montan el contador', () => {
    for (const ruta of ['src/app/[organizationSlug]/layout.tsx', 'src/app/(public)/layout.tsx']) {
      expect(readFileSync(resolve(process.cwd(), ruta), 'utf8')).toContain('<StorefrontVisitTracker')
    }
  })
})

describe('contador en el navegador', () => {
  const beacon = vi.fn(() => true)

  beforeEach(() => {
    window.localStorage.clear()
    beacon.mockClear()
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true })
    Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true })
  })
  afterEach(() => { pathname = '/hca-celular/productos' })

  it('la primera página del día cuenta a la persona; las siguientes, solo la página', async () => {
    const { StorefrontVisitTracker } = await import('@/components/public/StorefrontVisitTracker')
    const { rerender } = render(<StorefrontVisitTracker organizationId={ORG} />)
    pathname = '/hca-celular/productos/abc'
    rerender(<StorefrontVisitTracker organizationId={ORG} />)

    const cuerpos = beacon.mock.calls.map((call) => JSON.parse((call as unknown as [string, string])[1]))
    expect(cuerpos).toEqual([
      { organizationId: ORG, page: 'productos', newVisitor: true },
      { organizationId: ORG, page: 'producto', newVisitor: false },
    ])
  })

  it('respeta «No rastrear» y no cuenta el carrito', async () => {
    const { StorefrontVisitTracker } = await import('@/components/public/StorefrontVisitTracker')
    pathname = '/hca-celular/carrito'
    render(<StorefrontVisitTracker organizationId={ORG} />)
    expect(beacon).not.toHaveBeenCalled()

    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true })
    pathname = '/hca-celular/inicio'
    render(<StorefrontVisitTracker organizationId={ORG} />)
    expect(beacon).not.toHaveBeenCalled()
  })
})
