import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixtures = vi.hoisted(() => ({ hidden: true, error: null as null | { message: string },
  org: '11111111-1111-4111-8111-111111111111', product: '33333333-3333-4333-8333-333333333333' }))
vi.mock('@/lib/rate-limiter', () => ({ rateLimiter: { check: async () => true }, getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/agenda/public-agenda-server', () => ({ resolvePublicAgenda: async () => ({
  organization: { id: fixtures.org }, config: { capabilities: { professionalBooking: true }, professionals: [] },
  admin: { rpc: async () => ({ data: fixtures.error ? null : { id: 'q1', organization_id: fixtures.org, price: 40000, hide_price: fixtures.hidden, expires_at: '2027-01-01', starts_at: 'start', ends_at: 'end', professional_id: null, duration_minutes: 45, revision: 123 }, error: fixtures.error }) },
}) }))
import { POST } from '@/app/api/public/agenda/[slug]/quote/route'
const call = (body: unknown) => POST(new Request('http://x/api/public/agenda/test/quote', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ slug: 'test' }) })
beforeEach(() => { fixtures.hidden = true; fixtures.error = null })
describe('public booking quotes', () => {
  it('returns an opaque quote without a hidden price or private revision', async () => {
    const response = await call({ service_id: fixtures.product, starts_at: '2027-01-01T12:00:00Z' })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.price).toBeNull(); expect(body.duration).toBe(45)
    expect(body).not.toHaveProperty('revision'); expect(body).not.toHaveProperty('organization_id')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('rejects an invalid identifier before trying to quote', async () => {
    expect((await call({ service_id: 'bad', starts_at: '2027-01-01T12:00:00Z' })).status).toBe(400)
  })
  it('returns a visible tariff and rejects changed availability without substitution', async () => {
    fixtures.hidden = false
    expect((await (await call({ service_id: fixtures.product, starts_at: '2027-01-01T12:00:00Z' })).json()).price).toBe(40000)
    fixtures.error = { message: 'APPOINTMENT_OVERLAP' }
    expect((await call({ service_id: fixtures.product, starts_at: '2027-01-01T12:00:00Z' })).status).toBe(409)
  })
})
