import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { getClientIp, rateLimiter } from '@/lib/rate-limiter'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import { appointmentErrorMessage, busyIntervals, loadAgendaConfig } from '@/lib/agenda/agenda-server'
import { availableSlots, pickSlotResource } from '@/lib/agenda/slots'
import { addDays, dayRangeUtc, todayIn, utcToZoned } from '@/lib/agenda/time'

export const dynamic = 'force-dynamic'

/**
 * Reserva online de turnos desde la tienda (/<slug>/turnos).
 *
 * Solo si la tienda es pública, tiene el módulo de servicios y activó la
 * reserva online. Los horarios se recalculan al reservar: lo que el cliente
 * vio hace un rato puede haberse ocupado, y el trigger de la base frena a dos
 * que reservan el mismo horario a la vez.
 */
async function resolveAgenda(slug: string) {
  const admin = createAdminSupabase() as unknown as SupabaseClient
  const organization = await resolvePublicStorefrontOrganizationBySlug(slug)
  if (!organization || !(await isOrganizationModuleEnabled(organization.id, 'services'))) return null
  const config = await loadAgendaConfig(admin, organization.id, { onlyActive: true })
  if (!config?.settings.online_booking) return null
  return { admin, organization, config }
}

async function slotsFor(agenda: NonNullable<Awaited<ReturnType<typeof resolveAgenda>>>, date: string, serviceId: string, professionalId: string | null) {
  const { admin, organization, config } = agenda
  const service = config.services.find((item) => item.product_id === serviceId && item.online)
  if (!service) return null
  const today = todayIn(config.timeZone)
  if (date < today || date > addDays(today, config.settings.max_days_ahead)) return { service, slots: [] }
  const professionalIds = professionalId
    ? config.professionals.filter((professional) => professional.id === professionalId).map((professional) => professional.id)
    : config.professionals.map((professional) => professional.id)
  if (professionalId && professionalIds.length === 0) return null
  const range = dayRangeUtc(date, config.timeZone)
  const busy = await busyIntervals(admin, organization.id, range.start, range.end)
  return {
    service,
    slots: availableSlots({
      date,
      timeZone: config.timeZone,
      openingHours: config.settings.opening_hours,
      slotMinutes: config.settings.slot_minutes,
      durationMinutes: service.duration_minutes,
      busy,
      professionalIds,
      now: Date.now(),
      minNoticeMinutes: config.settings.min_notice_minutes,
    }),
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const agenda = await resolveAgenda(slug)
  if (!agenda) return NextResponse.json({ error: 'Esta tienda no toma turnos online' }, { status: 404 })
  const { config, organization } = agenda
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const serviceId = searchParams.get('service')

  if (date && serviceId) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !z.string().uuid().safeParse(serviceId).success) {
      return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
    }
    const professional = searchParams.get('professional')
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
    message: config.settings.booking_message,
    openDays: Object.keys(config.settings.opening_hours).map(Number),
    services: config.services
      .filter((service) => service.online)
      .map((service) => ({ id: service.product_id, name: service.name, duration: service.duration_minutes, price: service.hide_price ? null : service.price })),
    professionals: config.professionals.map((professional) => ({ id: professional.id, name: professional.name, color: professional.color })),
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

  const parsed = bookingSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Revisá los datos' }, { status: 400 })
  const agenda = await resolveAgenda(slug)
  if (!agenda) return NextResponse.json({ error: 'Esta tienda no toma turnos online' }, { status: 404 })
  const { admin, organization, config } = agenda

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
    .select('public_token, status, starts_at')
    .single()
  if (error || !data) {
    if (!error?.message?.includes('APPOINTMENT_OVERLAP')) logger.error('No se pudo reservar el turno online', { error: error?.message })
    return NextResponse.json({ error: appointmentErrorMessage(error, 'No se pudo reservar. Probá de nuevo.') }, { status: 409 })
  }
  return NextResponse.json({ token: (data as { public_token: string }).public_token, status }, { status: 201 })
}
