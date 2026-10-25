import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRepairTrackingUrl, buildStoreHomeUrl } from '@/lib/repairs/tracking-url'
import { getTenantSlugFromPath, isTenantPublicSection } from '@/lib/saas/tenant'

/**
 * El QR del comprobante apuntaba a `/mis-reparaciones/{ticket}`, una ruta sin
 * tienda que el proxy redirige a /marketplace perdiendo el ticket: escanearlo
 * no llevaba a la reparación. Ahora lleva a la página de la tienda.
 */
describe('URL del QR de seguimiento', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('abre la página de la tienda con el ticket y la firma', () => {
    expect(buildRepairTrackingUrl({
      siteUrl: 'https://www.mitiendapy.com',
      organizationSlug: 'precimax-celulares',
      ticketNumber: 'REP-000042',
      hash: 'a1b2c3d4e5f60718',
    })).toBe('https://www.mitiendapy.com/precimax-celulares/mis-reparaciones/REP-000042?verify=a1b2c3d4e5f60718')
  })

  it('el proxy la reconoce como ruta de la tienda y no como la legacy', () => {
    const url = new URL(buildRepairTrackingUrl({
      siteUrl: 'https://www.mitiendapy.com',
      organizationSlug: 'precimax-celulares',
      ticketNumber: 'REP-000042',
      hash: 'h',
    })!)
    const [, section, ticket] = url.pathname.split('/').filter(Boolean)

    expect(getTenantSlugFromPath(url.pathname)).toBe('precimax-celulares')
    expect(isTenantPublicSection(section)).toBe(true)
    expect(ticket).toBe('REP-000042')
    expect(url.pathname.startsWith('/mis-reparaciones')).toBe(false)
  })

  it('usa el dominio canónico (NEXT_PUBLIC_SITE_URL) y no el del navegador', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://staging.mitiendapy.com/')
    expect(buildRepairTrackingUrl({ organizationSlug: 'taller', ticketNumber: 'REP-1', hash: 'h' }))
      .toBe('https://staging.mitiendapy.com/taller/mis-reparaciones/REP-1?verify=h')
  })

  it('codifica el ticket y la firma', () => {
    expect(buildRepairTrackingUrl({
      siteUrl: 'https://x.test',
      organizationSlug: 'taller',
      ticketNumber: 'R 1/2',
      hash: 'a&b',
    })).toBe('https://x.test/taller/mis-reparaciones/R%201%2F2?verify=a%26b')
  })

  it('sin tienda, ticket o firma no hay URL (mejor sin QR que un QR roto)', () => {
    const base = { siteUrl: 'https://x.test', organizationSlug: 'taller', ticketNumber: 'REP-1', hash: 'h' }
    expect(buildRepairTrackingUrl({ ...base, organizationSlug: '' })).toBeNull()
    expect(buildRepairTrackingUrl({ ...base, organizationSlug: null })).toBeNull()
    expect(buildRepairTrackingUrl({ ...base, ticketNumber: '  ' })).toBeNull()
    expect(buildRepairTrackingUrl({ ...base, hash: undefined })).toBeNull()
  })
})

describe('URL de la tienda online del comprobante', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('es el inicio de la tienda en el dominio canónico, aunque se imprima en local', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.mitiendapy.com')
    expect(buildStoreHomeUrl({ organizationSlug: '4g-celulares' })).toBe('https://www.mitiendapy.com/4g-celulares/inicio')
    expect(getTenantSlugFromPath('/4g-celulares/inicio')).toBe('4g-celulares')
  })

  it('nunca imprime localhost en producción', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000')
    expect(buildStoreHomeUrl({ organizationSlug: 'taller' })).toBe('https://www.mitiendapy.com/taller/inicio')
  })

  it('sin tienda no hay URL', () => {
    expect(buildStoreHomeUrl({ organizationSlug: ' ' })).toBeNull()
  })
})

const ctx = { organizationId: 'org-1', organizationSlug: 'precimax-celulares', userId: 'u-1', role: 'admin', organizationRole: 'admin' }

vi.mock('@/app/api/repairs/_lib', () => ({
  resolveRepairModuleContext: vi.fn(async () => ctx),
  isNextResponse: vi.fn(() => false),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u-1' } }, error: null })) },
  })),
}))

describe('POST /api/repairs/sign', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('devuelve la firma y la URL de seguimiento de la tienda activa, que la página acepta', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.mitiendapy.com')
    const { POST } = await import('@/app/api/repairs/sign/route')
    const { verifyRepairHash } = await import('@/lib/repair-qr-hash')
    const date = '2026-10-15T12:00:00.000Z'

    const response = await POST(new Request('http://localhost/api/repairs/sign', {
      method: 'POST',
      body: JSON.stringify({ ticketNumber: 'REP-000042', customerName: 'Ana Pérez', date }),
    }) as never)
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.storeUrl).toBe('https://www.mitiendapy.com/precimax-celulares/inicio')
    expect(body.trackingUrl).toBe(
      `https://www.mitiendapy.com/precimax-celulares/mis-reparaciones/REP-000042?verify=${body.hash}`
    )
    // Lo mismo que valida la página pública con el ticket de la URL.
    const url = new URL(body.trackingUrl)
    const ticketId = decodeURIComponent(url.pathname.split('/').pop()!)
    expect(verifyRepairHash(ticketId, 'Ana Pérez', new Date(date), url.searchParams.get('verify')!)).toBe(true)
    expect(verifyRepairHash(ticketId, 'Otro Cliente', new Date(date), url.searchParams.get('verify')!)).toBe(false)
  })
})
