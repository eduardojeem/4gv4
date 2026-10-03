import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const state = vi.hoisted(() => ({ emails: [] as Array<{ to: string; subject: string; html: string }> }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: async (params: { to: string; subject: string; html: string }) => { state.emails.push(params); return { ok: true } } }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

import { notifyAppointmentEvent } from '@/lib/agenda/appointment-events'
import { describeAppointmentEvent } from '@/lib/agenda/messages'
import { AppointmentEventsBell } from '@/components/dashboard/agenda/AppointmentEventsBell'

const TZ = 'America/Asuncion'
// 15/10/2026 09:30 en Asunción (UTC-3).
const STARTS = '2026-10-15T12:30:00.000Z'

function fakeAdmin(options: { companyEmail?: string; insertError?: string } = {}) {
  const inserted: unknown[] = []
  const client = {
    from: (table: string) => ({
      insert: async (values: unknown) => {
        inserted.push(values)
        return { error: options.insertError ? { message: options.insertError } : null }
      },
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'website_settings' ? { value: { email: options.companyEmail ?? '' } } : null }) }) }),
      }),
    }),
  } as unknown as SupabaseClient
  return { client, inserted }
}

const event = { organizationId: 'org', appointmentId: 'a1', kind: 'booked' as const, customerName: 'Juan <b>', serviceName: 'Corte', startsAt: STARTS }

afterEach(() => {
  state.emails = []
  vi.unstubAllGlobals()
})

describe('cómo se cuenta cada novedad', () => {
  it('reserva, cambio y cancelación, con el día en la hora de la tienda', () => {
    expect(describeAppointmentEvent({ ...event, customerName: 'Juan' }, TZ)).toBe('Juan reservó Corte para el jueves 15/10 a las 09:30.')
    expect(describeAppointmentEvent({ ...event, customerName: 'Juan', kind: 'cancelled' }, TZ)).toBe('Juan canceló su turno de Corte del jueves 15/10 a las 09:30.')
    expect(describeAppointmentEvent({ ...event, customerName: 'Juan', kind: 'rescheduled', previousStartsAt: '2026-10-14T12:30:00.000Z' }, TZ))
      .toBe('Juan cambió su turno de Corte al jueves 15/10 a las 09:30 (era el miércoles 14/10 a las 09:30).')
  })
})

describe('el aviso a la tienda', () => {
  it('queda registrado y llega por email al contacto, sin HTML del cliente', async () => {
    const { client, inserted } = fakeAdmin({ companyEmail: 'hola@donpepe.com' })
    await notifyAppointmentEvent(client, event, { timeZone: TZ, notifyEmail: true })
    expect(inserted[0]).toMatchObject({ organization_id: 'org', kind: 'booked', customer_name: 'Juan <b>' })
    expect(state.emails[0]).toMatchObject({ to: 'hola@donpepe.com', subject: 'Nueva reserva online: Juan <b>' })
    expect(state.emails[0].html).toContain('Juan &lt;b&gt;')
  })

  it('con el email apagado o sin email de contacto, solo queda en la campanita', async () => {
    await notifyAppointmentEvent(fakeAdmin({ companyEmail: 'hola@donpepe.com' }).client, event, { timeZone: TZ, notifyEmail: false })
    await notifyAppointmentEvent(fakeAdmin().client, event, { timeZone: TZ, notifyEmail: true })
    expect(state.emails).toHaveLength(0)
  })

  it('sin la migración no rompe la reserva', async () => {
    const { client } = fakeAdmin({ insertError: 'relation "appointment_events" does not exist' })
    await expect(notifyAppointmentEvent(client, event, { timeZone: TZ, notifyEmail: false })).resolves.toBeUndefined()
  })
})

describe('la campanita de la Agenda', () => {
  it('muestra cuántas faltan ver, las lista y las marca como vistas', async () => {
    let unseen = 1
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') { unseen = 0; return { ok: true, json: async () => ({ ok: true }) } }
      return {
        ok: true,
        json: async () => ({
          available: true,
          unseen,
          events: [{ id: 'e1', kind: 'cancelled', customer_name: 'Ana', service_name: 'Color', starts_at: STARTS, previous_starts_at: null, seen_at: unseen ? null : 'x', created_at: new Date().toISOString() }],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><AppointmentEventsBell timeZone={TZ} /></SWRConfig>)

    const bell = await screen.findByRole('button', { name: 'Novedades de clientes: 1 sin ver' })
    fireEvent.click(bell)
    expect(await screen.findByText('Ana canceló su turno de Color del jueves 15/10 a las 09:30.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como vistas' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/agenda/events', { method: 'PATCH' }))
    expect(await screen.findByRole('button', { name: 'Novedades de clientes' })).toBeInTheDocument()
  })

  it('sin la migración no aparece', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ available: false, unseen: 0, events: [] }) })))
    const { container } = render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><AppointmentEventsBell timeZone={TZ} /></SWRConfig>)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
