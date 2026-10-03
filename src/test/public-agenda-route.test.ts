import { describe, expect, it, vi } from 'vitest'

const SERVICE = '11111111-2222-4333-8444-555555555555'

const agenda = {
  organization: { name: 'Barbería Don Pepe' },
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
  })

  it('devuelve los horarios de un día', async () => {
    const body = await (await call(`?date=2026-10-05&service=${SERVICE}`)).json()
    expect(body.slots).toEqual([{ startsAt: '2026-10-05T13:00:00.000Z', time: '10:00' }])
  })

  it('devuelve el próximo turno libre', async () => {
    const body = await (await call('?next=1')).json()
    expect(body.next).toMatchObject({ serviceName: 'Corte', time: '10:00', professionalName: 'Pepe' })
  })

  it('una tienda sin reservas online responde 404', async () => {
    expect((await call('', 'otra')).status).toBe(404)
  })
})
