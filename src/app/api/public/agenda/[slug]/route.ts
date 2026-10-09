import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { getClientIp, rateLimiter } from '@/lib/rate-limiter'
import { appointmentErrorMessage, professionalsForService } from '@/lib/agenda/agenda-server'
import { notifyAppointmentEvent } from '@/lib/agenda/appointment-events'
import { pickSlotResource } from '@/lib/agenda/slots'
import { addDays, todayIn, utcToZoned } from '@/lib/agenda/time'
import { publicSlotsFor, resolvePublicAgenda, type PublicAgenda } from '@/lib/agenda/public-agenda-server'
import { bookingWriteError, quoteReservationSchema, reserveQuote } from '@/lib/agenda/booking-writes'
import { resolveServiceTerms } from '@/lib/agenda/service-terms'

export const dynamic = 'force-dynamic'

/**
 * Reserva online de turnos desde la tienda (/<slug>/turnos).
 *
 * Los horarios se recalculan al reservar: lo que el cliente vio hace un rato
 * puede haberse ocupado, y el trigger de la base frena a dos que reservan el
 * mismo horario a la vez.
 */
const resolveAgenda = resolvePublicAgenda
const slotsFor = (agenda: PublicAgenda, date: string, serviceId: string, professionalId: string | null) =>
  publicSlotsFor(agenda, date, serviceId, professionalId)

/** Cuántos días se miran para «próximo turno libre»: más allá ya no es «próximo». */
const NEXT_SLOT_DAYS = 7

/**
 * El primer horario libre del servicio más corto (el que entra antes), para
 * mostrarlo en la portada. Null si no hay nada en la próxima semana.
 */
async function nextFreeSlot(agenda: PublicAgenda) {
  const { config } = agenda
  const service = config.services
    .filter((item) => item.online)
    .sort((a, b) => a.duration_minutes - b.duration_minutes)[0]
  if (!service) return null
  const today = todayIn(config.timeZone)
  const lastDay = Math.min(NEXT_SLOT_DAYS, config.settings.max_days_ahead)
  for (let offset = 0; offset <= lastDay; offset += 1) {
    const date = addDays(today, offset)
    const result = await slotsFor(agenda, date, service.product_id, null)
    const slot = result?.slots[0]
    if (!slot) continue
    const professional = config.professionals.find((item) => item.id === slot.professionalIds[0])
    return {
      date,
      time: utcToZoned(slot.startsAt, config.timeZone).time,
      isToday: offset === 0,
      isTomorrow: offset === 1,
      serviceId: service.product_id,
      serviceName: service.name,
      professionalName: professional?.name ?? null,
    }
  }
  return null
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const agenda = await resolveAgenda(slug)
  if (!agenda) return NextResponse.json({ error: 'Esta tienda no toma turnos online' }, { status: 404 })
  const { config, organization } = agenda
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const serviceId = searchParams.get('service')

  if (searchParams.get('next') === '1') return NextResponse.json({ next: await nextFreeSlot(agenda) })

  if (date && serviceId) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !z.string().uuid().safeParse(serviceId).success) {
      return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
    }
    const professional = searchParams.get('professional')
    if (professional && !z.string().uuid().safeParse(professional).success) return NextResponse.json({ error: 'Profesional inválido' }, { status: 400 })
    const result = await slotsFor(agenda, date, serviceId, professional && z.string().uuid().safeParse(professional).success ? professional : null)
    if (!result) return NextResponse.json({ error: 'Servicio o profesional no disponible' }, { status: 404 })
    return NextResponse.json({
      slots: result.slots.map((slot) => ({ startsAt: slot.startsAt, time: utcToZoned(slot.startsAt, config.timeZone).time })),
    })
  }

  return NextResponse.json({
    storeName: organization.name,
    timeZone: config.timeZone,
    currency: config.currency,
    today: todayIn(config.timeZone),
    maxDaysAhead: config.settings.max_days_ahead,
    requireConfirmation: config.settings.require_confirmation,
    professionalBookingAvailable: config.capabilities?.professionalBooking === true,
    professionalSelection: config.capabilities?.professionalBooking ? config.settings.professional_selection : 'optional',
    message: config.settings.booking_message,
    openDays: Object.keys(config.settings.opening_hours).map(Number),
    services: config.services
      .filter((service) => service.online)
      .map((service) => ({
        id: service.product_id,
        name: service.name,
        duration: service.duration_minutes,
        price: service.hide_price ? null : service.price,
        ...(config.capabilities?.professionalBooking ? {professionalTerms:professionalsForService(config.professionals.filter(p=>p.online_visible!==false),service.product_id).map(professional=>{
          const rate=config.professionalRates.find(row=>row.professional_id===professional.id&&row.product_id===service.product_id)
          const terms=resolveServiceTerms({price:service.price,durationMinutes:service.duration_minutes,bufferMinutes:service.buffer_minutes??0},rate?{price:rate.price,durationMinutes:rate.duration_minutes,bufferMinutes:rate.buffer_minutes}:null)
          return {professionalId:professional.id,price:service.hide_price?null:terms.price,duration:terms.durationMinutes}
        })}:{}),
        // Quién lo hace: la reserva solo ofrece a esos profesionales.
        professionalIds: professionalsForService(config.professionals.filter(p => p.online_visible !== false), service.product_id).map((professional) => professional.id),
      })),
    professionals: config.professionals.filter(p => p.online_visible !== false).map((professional) => ({
      id: professional.id,
      name: professional.name,
      color: professional.color,
      photoUrl: professional.photo_url || null,
      specialty: professional.specialty || null,
    })),
  })
}

const bookingSchema = z.object({
  service_id: z.string().uuid(),
  professional_id: z.string().uuid().nullable().optional(),
  starts_at: z.string().datetime({ offset: true }),
  name: z.string().trim().min(2, 'Poné tu nombre').max(120),
  phone: z.string().trim().min(6, 'Poné un teléfono o WhatsApp').max(40),
  notes: z.string().trim().max(500).nullable().optional(),
  // Campo trampa: las personas no lo ven ni lo llenan; los bots sí.
  website: z.string().max(0).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const allowed = await rateLimiter.check(`agenda-booking:${slug}:${getClientIp(request)}`, 5, 10 * 60_000)
  if (!allowed) return NextResponse.json({ error: 'Hiciste muchas reservas seguidas. Probá en unos minutos.' }, { status: 429 })

  const raw = await request.json().catch(() => null)
  const agenda = await resolveAgenda(slug)
  if (!agenda) return NextResponse.json({ error: 'Esta tienda no toma turnos online' }, { status: 404 })
  const { admin, organization, config } = agenda
  if (config.capabilities?.professionalBooking) {
    const verified = quoteReservationSchema.safeParse(raw)
    if (!verified.success) return NextResponse.json({ error: 'Revisá los datos y solicitá una cotización vigente.' }, { status: 400 })
    const { data, error } = await reserveQuote(admin, organization.id, verified.data)
    if (error || !data) {
      const failure = bookingWriteError(error)
      return NextResponse.json({ error: failure.error, code: failure.code }, { status: failure.status })
    }
    if (!data.idempotent) {
      // A notification failure must not turn a committed booking into a failure.
      const quote = await admin.from('agenda_booking_quotes').select('service_name').eq('id', verified.data.quote_id).eq('organization_id', organization.id).maybeSingle()
      try {
        await notifyAppointmentEvent(admin, { organizationId: organization.id, appointmentId: data.id,
          kind: 'booked', customerName: verified.data.name, serviceName: quote.data?.service_name ?? 'Servicio', startsAt: data.starts_at,
        }, { timeZone: config.timeZone, notifyEmail: config.settings.notify_email !== false })
      } catch { logger.error('No se pudo emitir el aviso de una reserva confirmada') }
    }
    return NextResponse.json({ token: data.public_token, status: data.status }, { status: data.idempotent ? 200 : 201, headers: { 'Cache-Control': 'no-store' } })
  }
  const parsed = bookingSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Revisá los datos' }, { status: 400 })

  const startsAt = new Date(parsed.data.starts_at).toISOString()
  const date = utcToZoned(startsAt, config.timeZone).date
  const result = await slotsFor(agenda, date, parsed.data.service_id, parsed.data.professional_id ?? null)
  const pick = result ? pickSlotResource(startsAt, result.slots, parsed.data.professional_id) : { ok: false as const }
  if (!result || !pick.ok) return NextResponse.json({ error: 'Ese horario ya no está disponible. Elegí otro.' }, { status: 409 })

  // Si el teléfono ya es de un cliente de la tienda, el turno queda en su historial.
  const digits = parsed.data.phone.replace(/\D/g, '')
  const { data: customer } = digits.length >= 6
    ? await admin.from('customers').select('id').eq('organization_id', organization.id).eq('phone_digits', digits).limit(1).maybeSingle()
    : { data: null }

  const status = config.settings.require_confirmation ? 'pending' : 'confirmed'
  const { data, error } = await admin
    .from('appointments')
    .insert({
      organization_id: organization.id,
      professional_id: pick.professionalId,
      customer_id: (customer as { id: string } | null)?.id ?? null,
      customer_name: parsed.data.name,
      customer_phone: parsed.data.phone,
      service_product_id: result.service.product_id,
      service_name: result.service.name,
      price: result.service.price,
      starts_at: startsAt,
      ends_at: new Date(Date.parse(startsAt) + result.service.duration_minutes * 60_000).toISOString(),
      status,
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
      source: 'online',
      notes: parsed.data.notes || null,
    })
    .select('id, public_token, status, starts_at')
    .single()
  if (error || !data) {
    if (!error?.message?.includes('APPOINTMENT_OVERLAP')) logger.error('No se pudo reservar el turno online', { error: error?.message })
    return NextResponse.json({ error: appointmentErrorMessage(error, 'No se pudo reservar. Probá de nuevo.') }, { status: 409 })
  }
  // La tienda se entera: campanita de la Agenda y, si lo pidió, email.
  await notifyAppointmentEvent(admin, {
    organizationId: organization.id,
    appointmentId: (data as { id: string }).id,
    kind: 'booked',
    customerName: parsed.data.name,
    serviceName: result.service.name,
    startsAt,
  }, { timeZone: config.timeZone, notifyEmail: config.settings.notify_email !== false })
  return NextResponse.json({ token: (data as { public_token: string }).public_token, status }, { status: 201 })
}
