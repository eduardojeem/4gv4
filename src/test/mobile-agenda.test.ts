import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }))
vi.mock('../../mobile/src/lib/supabase', () => ({ supabase: { auth: { getSession: auth.getSession, signOut: auth.signOut } } }))
vi.mock('../../mobile/src/lib/marketplace', () => ({ SITE_URL: 'https://tienda.test', formatGs: (value: number) => `Gs. ${value}` }))
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }))
vi.mock('expo-file-system', () => ({ File: class {} }))

import { ApiError } from '../../mobile/src/lib/api'
import { setPrivateCacheOrganization, setPrivateCacheUser } from '../../mobile/src/lib/private-cache-context'
import {
  agendaErrorMessage,
  appointmentAction,
  appointmentPublicUrl,
  createAppointment,
  fetchAgenda,
  lookupCustomers,
  updateAppointment,
} from '../../mobile/src/lib/agenda'
import * as mobile from '../../mobile/src/lib/agenda-model'
import * as webTime from '@/lib/agenda/time'
import { buildAppointmentWhatsApp } from '@/lib/agenda/messages'
import { editorServiceTerms } from '@/lib/agenda/editor-terms'
import { appointmentInputSchema } from '@/lib/agenda/agenda-api'
import { whatsappNumber as webWhatsappNumber } from '@/lib/quotes/quote-math'

const appointment: mobile.Appointment = {
  id: '11111111-1111-4111-8111-111111111111', number: 42, professional_id: '33333333-3333-4333-8333-333333333333', customer_id: null, customer_name: 'Juan Pérez',
  customer_phone: '0981 123 456', service_product_id: '22222222-2222-4222-8222-222222222222', service_name: 'Corte', price: 50000,
  starts_at: '2026-10-22T12:30:00.000Z', ends_at: '2026-10-22T13:00:00.000Z', status: 'pending', source: 'dashboard',
  notes: null, cancel_reason: null, public_token: 'tok', sale_id: null, confirmed_at: null, reminder_sent_at: null, created_at: '2026-10-20T10:00:00Z',
}

const data = mobile.toAgendaData({
  available: true, date: '2026-10-19', days: 7, appointments: [appointment], pendingCount: 1,
  settings: { slot_minutes: 30, opening_hours: { 1: [['08:00', '12:00'], ['14:00', '18:00']], 4: [['08:00', '18:00']] } },
  professionals: [
    { id: '44444444-4444-4444-8444-444444444444', name: 'Ana', color: '#f00', phone: null, is_active: true, sort_order: 2, service_ids: [] },
    { id: '33333333-3333-4333-8333-333333333333', name: 'Beto', color: '#00f', phone: null, is_active: true, sort_order: 1, service_ids: ['22222222-2222-4222-8222-222222222222'] },
  ],
  services: [{ product_id: '22222222-2222-4222-8222-222222222222', name: 'Corte', price: '50000', hide_price: false, duration_minutes: 30, online: true, configured: true }],
  professionalRates: [{ professional_id: '44444444-4444-4444-8444-444444444444', product_id: '22222222-2222-4222-8222-222222222222', price: 70000, duration_minutes: 45, buffer_minutes: null }],
  capabilities: { professionalBooking: false }, timeZone: 'America/Asuncion', currency: 'PYG', storeName: 'Barbería Sur', storeSlug: 'sur', canConfigure: true,
})

describe('paridad con la web: fechas en la zona del comercio', () => {
  const zones = ['America/Asuncion', 'America/Sao_Paulo', 'America/New_York', 'UTC']
  const cases: Array<[string, string]> = [['2026-10-22', '09:30'], ['2026-03-08', '02:30'], ['2026-11-01', '23:45'], ['2026-01-01', '00:00']]

  it.each(zones)('local → UTC y vuelta da lo mismo que la web (%s)', (zone) => {
    for (const [date, time] of cases) {
      expect(mobile.zonedToUtc(date, time, zone)).toBe(webTime.zonedToUtc(date, time, zone))
      const instant = webTime.zonedToUtc(date, time, zone)
      expect(mobile.utcToZoned(instant, zone)).toEqual(webTime.utcToZoned(instant, zone))
    }
  })

  it('días, semanas y nombres como la web', () => {
    expect(mobile.addDays('2026-12-31', 1)).toBe(webTime.addDays('2026-12-31', 1))
    expect(mobile.weekdayOf('2026-10-22')).toBe(webTime.weekdayOf('2026-10-22'))
    expect(mobile.weekStart('2026-10-22')).toBe('2026-10-19')
    expect(mobile.weekStart('2026-10-25')).toBe('2026-10-19')
    expect(mobile.dayLabel('2026-10-23', '2026-10-22')).toBe('Mañana')
    expect(mobile.dayLabel('2026-10-24', '2026-10-22')).toBe('sábado 24/10')
  })

  it('el turno de las 09:30 en Asunción se agrupa en su día, aunque el teléfono esté en otra zona', () => {
    expect(mobile.utcToZoned(appointment.starts_at, 'America/Asuncion')).toMatchObject({ date: '2026-10-22', time: '09:30' })
    expect(mobile.appointmentsOn([appointment], '2026-10-22', 'America/Asuncion')).toHaveLength(1)
    expect(mobile.appointmentsOn([appointment], '2026-10-22', 'America/Asuncion', '44444444-4444-4444-8444-444444444444')).toHaveLength(0)
  })
})

describe('paridad con la web: WhatsApp y tarifas', () => {
  it('el mensaje de confirmación y de recordatorio es el mismo', () => {
    const params = { storeName: 'Barbería Sur', customerName: 'Juan Pérez', serviceName: 'Corte', startsAt: appointment.starts_at, timeZone: 'America/Asuncion', professionalName: 'Beto', url: 'https://tienda.test/turno/tok' }
    expect(mobile.appointmentWhatsApp('confirm', params)).toBe(buildAppointmentWhatsApp('confirm', params))
    expect(mobile.appointmentWhatsApp('reminder', params)).toBe(buildAppointmentWhatsApp('reminder', params))
  })

  it.each(['0981 123 456', '+595 981 123456', '5950981123456', '123', null])('el número de WhatsApp de «%s» es el mismo', (phone) => {
    expect(mobile.whatsappNumber(phone)).toBe(webWhatsappNumber(phone))
  })

  it('arma el enlace de wa.me o avisa que falta el teléfono', () => {
    expect(mobile.whatsappUrl('0981 123 456', 'Hola')).toBe('https://wa.me/595981123456?text=Hola')
    expect(mobile.whatsappUrl('', 'Hola')).toBeNull()
  })

  it('precio y duración: tarifa del profesional o la del servicio, y lo acordado al editar', () => {
    const service = data.services[0]
    for (const [professional, original] of [['44444444-4444-4444-8444-444444444444', null], ['33333333-3333-4333-8333-333333333333', null], [null, null], ['33333333-3333-4333-8333-333333333333', appointment]] as const) {
      const web = editorServiceTerms(service, professional, data.professionalRates, original as never)
      expect(mobile.serviceTerms(service, professional, data.professionalRates, original)).toEqual(web)
    }
    expect(mobile.serviceTerms(service, '44444444-4444-4444-8444-444444444444', data.professionalRates, null)).toEqual({ price: 70000, durationMinutes: 45, bufferMinutes: 0 })
  })
})

describe('estados: las mismas transiciones que valida el servidor', () => {
  it('pendiente se confirma; confirmado no', () => {
    expect(mobile.canDo({ status: 'pending', sale_id: null }, 'confirm')).toBe(true)
    expect(mobile.canDo({ status: 'confirmed', sale_id: null }, 'confirm')).toBe(false)
  })

  it('solo se reabre lo cerrado y solo se edita lo activo', () => {
    expect(mobile.canDo({ status: 'cancelled', sale_id: null }, 'reopen')).toBe(true)
    expect(mobile.canDo({ status: 'confirmed', sale_id: null }, 'reopen')).toBe(false)
    expect(mobile.canDo({ status: 'completed', sale_id: null }, 'edit')).toBe(false)
  })

  it('un turno cobrado ya no se toca', () => {
    for (const action of ['confirm', 'complete', 'cancel', 'reopen', 'edit'] as const) {
      expect(mobile.canDo({ status: 'completed', sale_id: 'sale-1' }, action)).toBe(false)
    }
  })

  it('las acciones de la app existen en la ruta del servidor', () => {
    const route = readFileSync(join(__dirname, '../app/api/agenda/[id]/route.ts'), 'utf8')
    for (const action of ['confirm', 'complete', 'no_show', 'cancel', 'reopen', 'reminder_sent', 'update']) expect(route).toContain(`'${action}'`)
  })
})

describe('horarios para elegir', () => {
  it('genera horarios dentro de cada tramo sin pasarse del cierre', () => {
    const options = mobile.timeOptions('2026-10-19', data.settings.opening_hours, 30, 60)
    expect(options[0]).toBe('08:00')
    expect(options).toContain('11:00')
    expect(options).not.toContain('11:30')
    expect(options).toContain('14:00')
    expect(options.at(-1)).toBe('17:00')
  })

  it('un día cerrado no ofrece horarios', () => {
    expect(mobile.timeOptions('2026-10-25', data.settings.opening_hours, 30, 30)).toEqual([])
  })

  it('avisa si el turno queda fuera del horario', () => {
    expect(mobile.withinHours('2026-10-19', '12:30', 30, data.settings.opening_hours)).toBe(false)
    expect(mobile.withinHours('2026-10-19', '09:00', 30, data.settings.opening_hours)).toBe(true)
  })
})

describe('formulario: lo que manda la app lo acepta el esquema del servidor', () => {
  const filled = (): mobile.AppointmentForm => ({
    ...mobile.emptyForm(data, '2026-10-22', '09:30', '33333333-3333-4333-8333-333333333333'),
    customerName: ' Juan ', customerPhone: '0981123456', service: '22222222-2222-4222-8222-222222222222', serviceName: 'Corte', price: '50.000', duration: '30',
  })

  it('pide lo obligatorio con mensajes claros', () => {
    const issues = mobile.formIssues(mobile.emptyForm(data, '2026-10-22'), data)
    expect(issues).toEqual(expect.arrayContaining(['Poné el nombre del cliente.', 'Elegí o escribí el servicio.', 'Elegí quién atiende.']))
    expect(mobile.formIssues(filled(), data)).toEqual([])
  })

  it('el turno nuevo pasa la validación del servidor, con la hora en la zona del comercio', () => {
    const payload = mobile.appointmentPayload(filled(), data, 'create')
    const parsed = appointmentInputSchema.safeParse(payload)
    expect(parsed.success).toBe(true)
    expect(payload).toMatchObject({ customer_name: 'Juan', price: 50000, starts_at: '2026-10-22T12:30:00.000Z', status: 'confirmed', service_product_id: '22222222-2222-4222-8222-222222222222' })
    expect(JSON.stringify(payload)).not.toMatch(/organization/)
  })

  it('al editar no cambia el estado y con reservas por profesional manda las condiciones aceptadas', () => {
    const advanced = { ...data, capabilities: { professionalBooking: true } }
    const form = { ...mobile.formFromAppointment(appointment, data.timeZone), professionalId: '44444444-4444-4444-8444-444444444444' }
    expect(mobile.formIssues(form, advanced, appointment)).toContain('Aceptá la nueva tarifa y duración del servicio y profesional.')
    const payload = mobile.appointmentPayload({ ...form, acceptNewTerms: true }, advanced, 'edit')
    expect(payload).not.toHaveProperty('status')
    expect(payload).toMatchObject({ accept_new_terms: true, accepted_terms: { price: 50000, duration_minutes: 30 } })
    expect(appointmentInputSchema.safeParse(payload).success).toBe(true)
  })

  it('un servicio escrito a mano no manda id de producto', () => {
    const payload = mobile.appointmentPayload({ ...filled(), service: mobile.FREE_SERVICE, serviceName: 'Masaje' }, data, 'create')
    expect(payload.service_product_id).toBeNull()
  })
})

describe('APIs de la app: las mismas rutas que la web', () => {
  const calls: Array<{ url: string; init: RequestInit }> = []
  beforeEach(() => {
    calls.length = 0
    setPrivateCacheUser(null); setPrivateCacheUser('user-1'); setPrivateCacheOrganization('org-1')
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'token-1', user: { id: 'user-1' } } } })
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      if (url.includes('/lookup')) return new Response(JSON.stringify({ results: [{ id: 'c1', name: 'Juan', phone: null, whatsapp: '0981' }] }))
      if (url.includes('/api/agenda?')) return new Response(JSON.stringify({ available: true, appointments: [], timeZone: 'America/Asuncion' }))
      return new Response(JSON.stringify({ appointment }))
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('pide la semana a /api/agenda con la sesión y el comercio activo', async () => {
    await fetchAgenda('2026-10-19', 7)
    expect(calls[0].url).toMatch(/\/api\/agenda\?date=2026-10-19&days=7$/)
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-1')
    expect(headers['x-organization-id']).toBe('org-1')
  })

  it('crea con POST y edita con la acción «update», como la web', async () => {
    const payload = mobile.appointmentPayload({ ...mobile.emptyForm(data, '2026-10-22', '09:30', '33333333-3333-4333-8333-333333333333'), customerName: 'Juan', serviceName: 'Corte', service: '22222222-2222-4222-8222-222222222222' }, data, 'create')
    await createAppointment(payload)
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].url).toMatch(/\/api\/agenda$/)
    await updateAppointment(appointment.id, payload)
    expect(calls[1].url).toMatch(new RegExp(`/api/agenda/${appointment.id}$`))
    expect(JSON.parse(String(calls[1].init.body))).toMatchObject({ action: 'update', appointment: { customer_name: 'Juan' } })
  })

  it('las acciones de estado viajan como en la web', async () => {
    await appointmentAction(appointment.id, 'cancel', { reason: 'No puede' })
    expect(calls[0].init.method).toBe('PATCH')
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ action: 'cancel', reason: 'No puede' })
  })

  it('no busca clientes con menos de 2 letras', async () => {
    expect(await lookupCustomers('J')).toEqual([])
    expect(calls).toHaveLength(0)
    expect(await lookupCustomers('Ju')).toHaveLength(1)
    expect(calls[0].url).toMatch(/\/api\/agenda\/lookup\?q=Ju$/)
  })

  it('el enlace público del turno es el de la web', () => {
    expect(appointmentPublicUrl('tok')).toBe('https://tienda.test/turno/tok')
  })

  it('errores en palabras de la persona; el 409 del servidor se muestra tal cual', () => {
    expect(agendaErrorMessage(new ApiError('Ese horario ya está ocupado para ese profesional. Elegí otro.', 409), 'x')).toMatch(/ocupado/)
    expect(agendaErrorMessage(new ApiError('Forbidden', 403), 'x')).toMatch(/plan no incluyen la agenda/)
    expect(agendaErrorMessage(new ApiError('x', 0), 'x')).toMatch(/Sin conexión/)
  })
})

describe('la app abre la agenda propia, sin service_role', () => {
  const mobileSrc = join(__dirname, '../../mobile/src')
  const read = (file: string) => readFileSync(join(mobileSrc, file), 'utf8')

  it('la sección agenda tiene pantalla en la app', () => {
    expect(read('lib/panel.tsx')).toMatch(/NATIVE_SECTIONS = new Set\(\[[^\]]*'agenda'/)
  })

  it('las pantallas no usan service_role ni mandan el comercio', () => {
    for (const file of ['app/panel/agenda/index.tsx', 'app/panel/agenda/form.tsx', 'lib/agenda.ts']) {
      expect(read(file)).not.toMatch(/service_role|SERVICE_ROLE|organization_id/)
    }
  })
})
