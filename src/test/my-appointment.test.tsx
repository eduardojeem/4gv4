import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  appointment: null as Record<string, unknown> | null,
  updates: [] as Array<Record<string, unknown>>,
  events: [] as Array<Record<string, unknown>>,
  agenda: null as unknown,
  slots: [] as Array<{ startsAt: string; endsAt: string; professionalIds: Array<string | null> }>,
  refresh: vi.fn(),
}))

vi.mock('@/lib/rate-limiter', () => ({ rateLimiter: { check: async () => true }, getClientIp: () => '1.1.1.1' }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/agenda/public-agenda-server', () => ({
  resolvePublicAgenda: async () => state.agenda,
  publicSlotsFor: async () => ({ service: { product_id: 'corte', duration_minutes: 30 }, slots: state.slots }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {}
      let patch: Record<string, unknown> | null = null
      builder.select = () => builder
      builder.eq = () => builder
      builder.in = () => builder
      builder.gt = () => builder
      builder.update = (values: Record<string, unknown>) => { patch = values; state.updates.push(values); return builder }
      builder.insert = async (values: Record<string, unknown>) => { if (table === 'appointment_events') state.events.push(values); return { error: null } }
      builder.maybeSingle = async () => {
        if (table === 'organizations') return { data: { slug: 'don-pepe' }, error: null }
        if (patch) return { data: { starts_at: patch.starts_at ?? null, status: patch.status }, error: null }
        return { data: state.appointment, error: null }
      }
      builder.then = (resolve: (value: unknown) => void) => resolve({ data: patch ? [{ id: 'a1', organization_id: 'org', customer_name: 'Juan', service_name: 'Corte', starts_at: inAWeek }] : [], error: null })
      return builder
    },
  }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: state.refresh }) }))

import { GET, POST } from '@/app/api/public/appointment/[token]/route'
import { ManageAppointment } from '@/app/turno/[token]/ManageAppointment'
import { appointmentIcs } from '@/lib/agenda/ics'

const TOKEN = '11111111-2222-4333-8444-555555555555'
const params = { params: Promise.resolve({ token: TOKEN }) }
const inAWeek = new Date(Date.now() + 7 * 86_400_000).toISOString()

beforeEach(() => {
  state.updates = []
  state.events = []
  state.appointment = { id: 'a1', organization_id: 'org', customer_name: 'Juan', service_name: 'Corte', service_product_id: 'corte', professional_id: 'pepe', starts_at: inAWeek, status: 'confirmed' }
  state.agenda = { config: { timeZone: 'America/Asuncion', settings: { require_confirmation: true, max_days_ahead: 30, opening_hours: { 1: [['09:00', '18:00']] } } } }
  state.slots = []
})
afterEach(() => vi.unstubAllGlobals())

describe('archivo de calendario', () => {
  it('lleva el horario en UTC, escapa el texto y avisa una hora antes', () => {
    const ics = appointmentIcs({
      uid: TOKEN,
      startsAt: '2026-10-08T13:30:00.000Z',
      endsAt: '2026-10-08T14:00:00.000Z',
      title: 'Corte, barba; y más',
      location: 'Av. España 1234',
      now: new Date('2026-10-01T00:00:00.000Z'),
    })
    expect(ics).toContain('DTSTART:20261008T133000Z')
    expect(ics).toContain('DTEND:20261008T140000Z')
    expect(ics).toContain('SUMMARY:Corte\\, barba\\; y más')
    expect(ics).toContain('TRIGGER:-PT1H')
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR')
  })
})

describe('API de «Mi turno»', () => {
  it('sin cuerpo cancela, como el botón de antes', async () => {
    const response = await POST(new Request('http://x', { method: 'POST' }), params)
    expect(response.status).toBe(200)
    expect(state.updates[0]).toMatchObject({ status: 'cancelled' })
    // La tienda se entera.
    expect(state.events[0]).toMatchObject({ kind: 'cancelled', customer_name: 'Juan', service_name: 'Corte' })
  })

  it('al reprogramar recalcula: si el horario ya no está libre, no cambia nada', async () => {
    const response = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ action: 'reschedule', starts_at: '2026-10-12T13:00:00.000Z' }) }), params)
    expect(response.status).toBe(409)
    expect(state.updates).toHaveLength(0)
    expect(state.events).toHaveLength(0)
  })

  it('con el horario libre, mueve el turno, mantiene al profesional y vuelve a confirmación', async () => {
    state.slots = [{ startsAt: '2026-10-12T13:00:00.000Z', endsAt: '2026-10-12T13:30:00.000Z', professionalIds: ['pepe'] }]
    const response = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ action: 'reschedule', starts_at: '2026-10-12T13:00:00.000Z' }) }), params)
    expect(response.status).toBe(200)
    expect(state.updates[0]).toMatchObject({
      starts_at: '2026-10-12T13:00:00.000Z',
      ends_at: '2026-10-12T13:30:00.000Z',
      professional_id: 'pepe',
      status: 'pending',
      reminder_sent_at: null,
    })
    expect(state.events[0]).toMatchObject({ kind: 'rescheduled', starts_at: '2026-10-12T13:00:00.000Z', previous_starts_at: inAWeek })
  })

  it('un turno que ya pasó no se puede mover', async () => {
    state.appointment = { ...state.appointment!, starts_at: new Date(Date.now() - 3_600_000).toISOString() }
    const response = await GET(new Request('http://x'), params)
    expect(response.status).toBe(409)
  })

  it('si la tienda apagó las reservas online, se cambia por WhatsApp', async () => {
    state.agenda = null
    const response = await GET(new Request('http://x'), params)
    expect(response.status).toBe(409)
    expect((await response.json()).error).toMatch(/WhatsApp/)
  })
})

describe('«Cambiar horario» en la página', () => {
  it('elige día y hora y confirma el nuevo horario', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: true, json: async () => ({ ok: true }) }
      if (url.includes('?date=')) return { ok: true, json: async () => ({ slots: [{ startsAt: '2026-10-05T13:00:00.000Z', time: '10:00' }] }) }
      return { ok: true, json: async () => ({ today: '2026-10-05', maxDaysAhead: 30, openDays: [1] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ManageAppointment token={TOKEN} changeable calendar={null} />)

    fireEvent.click(screen.getByRole('button', { name: /Cambiar horario/ }))
    // 2026-10-05 es lunes: el único día con atención en las próximas dos semanas, más el siguiente lunes.
    fireEvent.click(await screen.findByRole('button', { name: /Lun\s*5/ }))
    fireEvent.click(await screen.findByRole('button', { name: '10:00' }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar nuevo horario/ }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Listo, cambiamos tu turno.'))
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ action: 'reschedule', starts_at: '2026-10-05T13:00:00.000Z' })
    expect(state.refresh).toHaveBeenCalled()
  })

  it('cancelar pide confirmación en la misma página', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ManageAppointment token={TOKEN} changeable calendar={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }))
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Sí, cancelar/ }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cancelamos tu turno.'))
  })

  it('un turno que ya no se puede cambiar no ofrece cambiar ni cancelar', () => {
    render(<ManageAppointment token={TOKEN} changeable={false} calendar={null} />)
    expect(screen.queryByRole('button', { name: /Cambiar horario/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar turno' })).not.toBeInTheDocument()
  })
})
