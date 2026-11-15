import { beforeEach, describe, expect, it, vi } from 'vitest'

const SERVICE = '11111111-2222-4333-8444-555555555555'
const closuresResult = { data: [] as Array<{ starts_at: string; ends_at: string; public_message: string }>, error: null as { message: string } | null }
const closuresQuery = {
  select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(), limit: vi.fn(async () => closuresResult),
}
const promotionsResult = { data: [] as Array<Record<string, unknown>>, error: null as { message: string } | null }
const promotionsQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn(async () => promotionsResult) }
beforeEach(() => { vi.clearAllMocks(); closuresResult.data = []; closuresResult.error = null; promotionsResult.data = []; promotionsResult.error = null })

const agenda = {
  admin: { from: vi.fn((table: string) => (table === 'promotions' ? promotionsQuery : closuresQuery)) },
  organization: { id: 'org-don-pepe', name: 'Barbería Don Pepe' },
  config: {
    timeZone: 'America/Asuncion',
    currency: 'PYG',
    settings: { max_days_ahead: 30, require_confirmation: true, booking_message: null, opening_hours: { 1: [['09:00', '18:00']] } },
    services: [{ product_id: SERVICE, name: 'Corte', duration_minutes: 30, price: 50000, hide_price: false, online: true }],
    professionals: [
      { id: 'ana', name: 'Ana', color: '#7c3aed', photo_url: 'https://cdn/ana.webp', specialty: 'Colorista', service_ids: ['otro'] },
      { id: 'pepe', name: 'Pepe', color: '#0f766e', photo_url: null, specialty: null, service_ids: [] },
    ],
  },
}

vi.mock('@/lib/rate-limiter', () => ({ rateLimiter: { check: async () => true }, getClientIp: () => '1.1.1.1' }))
vi.mock('@/lib/agenda/public-agenda-server', () => ({
  resolvePublicAgenda: async (slug: string) => (slug === 'don-pepe' ? agenda : null),
  publicSlotsFor: async () => ({
    service: agenda.config.services[0],
    slots: [{ startsAt: '2026-10-05T13:00:00.000Z', endsAt: '2026-10-05T13:30:00.000Z', professionalIds: ['pepe'] }],
  }),
}))

import { GET } from '@/app/api/public/agenda/[slug]/route'

const call = (query = '', slug = 'don-pepe') => GET(new Request(`http://x/api/public/agenda/${slug}${query}`), { params: Promise.resolve({ slug }) })

describe('GET de la reserva online', () => {
  it('lista servicios con quién los hace y el equipo con foto y especialidad', async () => {
    const response = await call()
    expect(response.status).toBe(200)
    const body = await response.json()
    // Ana tiene servicios asignados y no incluye el corte; Pepe no tiene asignados: hace todo.
    expect(body.services).toEqual([expect.objectContaining({ id: SERVICE, name: 'Corte', professionalIds: ['pepe'] })])
    expect(body.professionals[0]).toMatchObject({ name: 'Ana', photoUrl: 'https://cdn/ana.webp', specialty: 'Colorista' })
    expect(body.closures).toEqual([])
  })

  it('incluye los avisos públicos de cierre de la misma organización', async () => {
    closuresResult.data = [{ starts_at: '2026-10-14T12:00:00Z', ends_at: '2026-10-14T15:00:00Z', public_message: 'Cerrado por capacitación' }]
    const body = await (await call()).json()
    expect(body.closures).toEqual([{ startsAt: '2026-10-14T12:00:00Z', endsAt: '2026-10-14T15:00:00Z', message: 'Cerrado por capacitación' }])
    expect(agenda.admin.from).toHaveBeenCalledWith('agenda_time_off')
    expect(closuresQuery.eq).toHaveBeenCalledWith('organization_id', 'org-don-pepe')
    expect(closuresQuery.is).toHaveBeenCalledWith('professional_id', null)
  })

  it('mantiene el catálogo disponible si falla la consulta opcional de avisos', async () => {
    closuresResult.error = { message: 'column public_message does not exist' }
    const response = await call()
    expect(response.status).toBe(200)
    expect((await response.json()).closures).toEqual([])
  })

  it('agrega a cada servicio las promos vigentes que lo nombran, sin usos ni límites', async () => {
    promotionsResult.data = [
      { id: 'p1', code: 'CORTE20', name: 'Corte 20%', description: null, type: 'percentage', value: 20, min_purchase: 0, max_discount: null, applicable_products: [SERVICE], applicable_categories: [], start_date: null, end_date: null, is_active: true, usage_count: 3, usage_limit: 100, public_mode: 'coupon' },
      { id: 'p2', code: 'REPA', name: 'Reparaciones', description: null, type: 'percentage', value: 15, min_purchase: 0, max_discount: null, applicable_products: [], applicable_categories: ['service'], start_date: null, end_date: null, is_active: true, usage_count: 0, usage_limit: null, public_mode: 'coupon' },
    ]
    const body = await (await call()).json()
    expect(promotionsQuery.eq).toHaveBeenCalledWith('organization_id', 'org-don-pepe')
    expect(promotionsQuery.in).toHaveBeenCalledWith('public_mode', ['coupon', 'automatic'])
    expect(body.services[0].promotions).toEqual([expect.objectContaining({ id: 'p1', code: 'CORTE20', value: 20 })])
    expect(body.services[0].promotions[0]).not.toHaveProperty('usage_count')
  })

  it('si fallan las promos, la reserva sigue con los servicios sin promos', async () => {
    promotionsResult.error = { message: 'boom' }
    const response = await call()
    expect(response.status).toBe(200)
    expect((await response.json()).services[0].promotions).toEqual([])
  })

  it('devuelve los horarios de un día', async () => {
    const body = await (await call(`?date=2026-10-05&service=${SERVICE}`)).json()
    expect(body.slots).toEqual([{ startsAt: '2026-10-05T13:00:00.000Z', time: '10:00', professionalIds: ['pepe'] }])
  })

  it('devuelve el próximo turno libre', async () => {
    const body = await (await call('?next=1')).json()
    expect(body.next).toMatchObject({ serviceName: 'Corte', time: '10:00', professionalName: 'Pepe' })
  })

  it('una tienda sin reservas online responde 404', async () => {
    expect((await call('', 'otra')).status).toBe(404)
  })
})
