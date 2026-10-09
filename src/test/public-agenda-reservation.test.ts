import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), notify: vi.fn(), lookup: vi.fn() }))
vi.mock('@/lib/rate-limiter', () => ({ rateLimiter: { check: async () => true }, getClientIp: () => '1.1.1.1' }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/agenda/appointment-events', () => ({ notifyAppointmentEvent: mocks.notify }))
vi.mock('@/lib/agenda/public-agenda-server', () => ({ resolvePublicAgenda: async () => ({
  organization: { id: 'org' }, config: { capabilities: { professionalBooking: true }, timeZone: 'UTC', settings: {} },
  admin: { rpc: mocks.rpc, from: () => { const q = { select: () => q, eq: () => q, maybeSingle: mocks.lookup }; return q } },
}), publicSlotsFor: vi.fn() }))
import { POST } from '@/app/api/public/agenda/[slug]/route'
const body = { quote_id: '11111111-1111-4111-8111-111111111111', idempotency_key: '22222222-2222-4222-8222-222222222222', name: 'Cliente', phone: '0981000000' }
const call = () => POST(new Request('http://x/api/public/agenda/store', { method:'POST', body:JSON.stringify(body) }), { params:Promise.resolve({slug:'store'}) })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.lookup.mockResolvedValue({data:{id:body.quote_id,service_name:'Corte'},error:null})
  mocks.rpc.mockResolvedValue({data:{id:'appointment',public_token:'token',status:'pending',starts_at:'2026-10-10T09:00:00Z',idempotent:false},error:null})
})
describe('verified public reservations', () => {
  it('reserves only server quote terms and emits one booking event', async () => {
    expect((await call()).status).toBe(201)
    expect(mocks.rpc).toHaveBeenCalledWith('reserve_agenda_quote',expect.objectContaining({ p_quote_id:body.quote_id,p_customer:{name:'Cliente',phone:'0981000000',notes:null} }))
    expect(mocks.notify).toHaveBeenCalledTimes(1)
  })
  it('does not duplicate the booking notification on retry', async () => {
    mocks.rpc.mockResolvedValueOnce({data:{id:'appointment',public_token:'token',status:'pending',idempotent:true},error:null})
    expect((await call()).status).toBe(200)
    expect(mocks.notify).not.toHaveBeenCalled()
  })
  it('rejects an unavailable or foreign quote before executing the RPC', async () => {
    mocks.lookup.mockResolvedValue({data:null,error:null})
    expect((await call()).status).toBe(409)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
