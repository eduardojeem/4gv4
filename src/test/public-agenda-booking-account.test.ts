import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), notify: vi.fn(), lookup: vi.fn(), getUser: vi.fn(), link: vi.fn(),
  update: vi.fn(), updateEq: vi.fn(), warn: vi.fn(),
}))
vi.mock('@/lib/rate-limiter', () => ({ rateLimiter: { check: async () => true }, getClientIp: () => '1.1.1.1' }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: mocks.warn } }))
vi.mock('@/lib/agenda/appointment-events', () => ({ notifyAppointmentEvent: mocks.notify }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/customers/link-public-customer-account', () => ({ linkPublicCustomerAccount: mocks.link }))
vi.mock('@/lib/agenda/public-agenda-server', () => ({
  resolvePublicAgenda: async () => ({
    organization: { id: 'org' },
    config: { capabilities: { professionalBooking: true }, timeZone: 'UTC', settings: {} },
    admin: {
      rpc: mocks.rpc,
      from: (table: string) => {
        if (table === 'appointments') {
          const chain = { eq: (...args: unknown[]) => { mocks.updateEq(...args); return chain }, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) }
          return { update: (values: unknown) => { mocks.update(values); return chain } }
        }
        const q = { select: () => q, eq: () => q, maybeSingle: mocks.lookup }
        return q
      },
    },
  }),
  publicSlotsFor: vi.fn(),
}))

import { POST } from '@/app/api/public/agenda/[slug]/route'

const base = { quote_id: '11111111-1111-4111-8111-111111111111', idempotency_key: '22222222-2222-4222-8222-222222222222', name: 'Juan', phone: '0981000000' }
const call = (body: Record<string, unknown>) => POST(new Request('http://x/api/public/agenda/store', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ slug: 'store' }) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.lookup.mockResolvedValue({ data: { id: base.quote_id, service_name: 'Corte' }, error: null })
  mocks.rpc.mockResolvedValue({ data: { id: 'appointment-1', public_token: 'token', status: 'pending', starts_at: '2026-11-20T12:00:00Z', idempotent: false }, error: null })
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'juan@test.com', phone: '', user_metadata: { full_name: 'Juan Pérez', phone: '0991 111 222' } } } })
  mocks.link.mockResolvedValue({ customerId: 'customer-1', membershipRole: 'customer' })
})

describe('reservar para mí con la sesión iniciada', () => {
  it('deja el turno en la ficha de la cuenta (la sesión la lee el servidor)', async () => {
    expect((await call({ ...base, for_self: true })).status).toBe(201)
    expect(mocks.link).toHaveBeenCalledWith(expect.anything(), {
      organizationId: 'org', profileId: 'user-1', fullName: 'Juan Pérez', email: 'juan@test.com', phone: '0991 111 222',
    })
    expect(mocks.update).toHaveBeenCalledWith({ customer_id: 'customer-1' })
    expect(mocks.updateEq).toHaveBeenCalledWith('id', 'appointment-1')
    expect(mocks.updateEq).toHaveBeenCalledWith('organization_id', 'org')
  })

  it('nunca usa el teléfono del formulario para buscar la ficha: solo el de la cuenta', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'juan@test.com', phone: '', user_metadata: {} } } })
    await call({ ...base, phone: '0981 999 999', for_self: true })
    expect(mocks.link).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ phone: null, fullName: 'Juan' }))
  })

  it('para otra persona, o sin sesión, el turno sigue como siempre', async () => {
    await call(base)
    expect(mocks.getUser).not.toHaveBeenCalled()
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    expect((await call({ ...base, for_self: true })).status).toBe(201)
    expect(mocks.link).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('si falla la vinculación, la reserva ya hecha no se pierde', async () => {
    mocks.link.mockRejectedValue(new Error('boom'))
    const response = await call({ ...base, for_self: true })
    expect(response.status).toBe(201)
    expect((await response.json()).token).toBe('token')
    expect(mocks.warn).toHaveBeenCalled()
  })

  it('una reserva rechazada no vincula la cuenta', async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: null })
    expect((await call({ ...base, for_self: true })).status).toBe(409)
    expect(mocks.link).not.toHaveBeenCalled()
  })
})
