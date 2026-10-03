import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getClientIp, rateLimiter } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { appointmentErrorMessage } from '@/lib/agenda/agenda-server'
import { pickSlotResource } from '@/lib/agenda/slots'
import { todayIn, utcToZoned } from '@/lib/agenda/time'
import { publicSlotsFor, resolvePublicAgenda } from '@/lib/agenda/public-agenda-server'
import { notifyAppointmentEvent, notifyOptionsFor } from '@/lib/agenda/appointment-events'

export const dynamic = 'force-dynamic'

/**
 * El cliente maneja su turno desde el enlace que recibió («Mi turno»):
 * ver horarios libres (GET), cancelar o cambiar el horario (POST). Solo antes
 * de que empiece y mientras siga pendiente o confirmado.
 */

type AppointmentRow = {
  id: string
  organization_id: string
  customer_name: string
  service_name: string
  service_product_id: string | null
  professional_id: string | null
  starts_at: string
  status: string
}

async function loadAppointment(token: string) {
  const admin = createAdminSupabase()
  const { data } = await admin
    .from('appointments')
    .select('id, organization_id, customer_name, service_name, service_product_id, professional_id, starts_at, status')
    .eq('public_token', token)
    .maybeSingle()
  return data as AppointmentRow | null
}

function isChangeable(appointment: AppointmentRow) {
  return (appointment.status === 'pending' || appointment.status === 'confirmed') && Date.parse(appointment.starts_at) > Date.now()
}

/** La agenda pública de la tienda del turno; null si ya no toma turnos online. */
async function agendaFor(appointment: AppointmentRow) {
  const admin = createAdminSupabase()
  const { data: organization } = await admin.from('organizations').select('slug').eq('id', appointment.organization_id).maybeSingle()
  const slug = (organization as { slug?: string } | null)?.slug
  return slug ? resolvePublicAgenda(slug) : null
}

/** Horarios libres de un día para mover el turno (con el mismo profesional, si eligió uno). */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!z.string().uuid().safeParse(token).success) return NextResponse.json({ error: 'Enlace inválido' }, { status: 400 })
  const appointment = await loadAppointment(token)
  if (!appointment) return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 })
  if (!isChangeable(appointment) || !appointment.service_product_id) {
    return NextResponse.json({ error: 'Este turno ya no se puede cambiar desde acá.' }, { status: 409 })
  }
  const agenda = await agendaFor(appointment)
  if (!agenda) return NextResponse.json({ error: 'La tienda no está tomando cambios online. Escribile por WhatsApp.' }, { status: 409 })

  const date = new URL(request.url).searchParams.get('date')
  const { config } = agenda
  if (!date) {
    return NextResponse.json({
      today: todayIn(config.timeZone),
      maxDaysAhead: config.settings.max_days_ahead,
      openDays: Object.keys(config.settings.opening_hours).map(Number),
    })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 })
  const result = await publicSlotsFor(agenda, date, appointment.service_product_id, appointment.professional_id, appointment.id)
  if (!result) return NextResponse.json({ error: 'El servicio ya no se reserva online.' }, { status: 409 })
  return NextResponse.json({
    slots: result.slots
      // El horario que ya tiene no se ofrece como cambio.
      .filter((slot) => Date.parse(slot.startsAt) !== Date.parse(appointment.starts_at))
      .map((slot) => ({ startsAt: slot.startsAt, time: utcToZoned(slot.startsAt, config.timeZone).time })),
  })
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('cancel') }),
  z.object({ action: z.literal('reschedule'), starts_at: z.string().datetime({ offset: true }) }),
])

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!z.string().uuid().safeParse(token).success) return NextResponse.json({ error: 'Enlace inválido' }, { status: 400 })
  if (!(await rateLimiter.check(`appointment-change:${getClientIp(request)}`, 10, 10 * 60_000))) {
    return NextResponse.json({ error: 'Probá en unos minutos' }, { status: 429 })
  }

  // Sin cuerpo = cancelar (así funcionaba el botón original).
  const raw = await request.json().catch(() => null)
  const parsed = actionSchema.safeParse(raw ?? { action: 'cancel' })
  if (!parsed.success) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

  const admin = createAdminSupabase()
  if (parsed.data.action === 'cancel') {
    const { data, error } = await admin
      .from('appointments')
      .update({ status: 'cancelled', cancel_reason: 'Cancelado por el cliente' })
      .eq('public_token', token)
      .in('status', ['pending', 'confirmed'])
      .gt('starts_at', new Date().toISOString())
      .select('id, organization_id, customer_name, service_name, starts_at')
    if (error) return NextResponse.json({ error: 'No se pudo cancelar' }, { status: 500 })
    if (!data?.length) return NextResponse.json({ error: 'Este turno ya no se puede cancelar desde acá. Escribile a la tienda.' }, { status: 409 })
    const cancelled = data[0] as { id: string; organization_id: string; customer_name: string; service_name: string; starts_at: string }
    await notifyAppointmentEvent(admin, {
      organizationId: cancelled.organization_id,
      appointmentId: cancelled.id,
      kind: 'cancelled',
      customerName: cancelled.customer_name,
      serviceName: cancelled.service_name,
      startsAt: cancelled.starts_at,
    }, await notifyOptionsFor(admin, cancelled.organization_id))
    return NextResponse.json({ ok: true })
  }

  const appointment = await loadAppointment(token)
  if (!appointment || !isChangeable(appointment) || !appointment.service_product_id) {
    return NextResponse.json({ error: 'Este turno ya no se puede cambiar desde acá. Escribile a la tienda.' }, { status: 409 })
  }
  const agenda = await agendaFor(appointment)
  if (!agenda) return NextResponse.json({ error: 'La tienda no está tomando cambios online. Escribile por WhatsApp.' }, { status: 409 })

  // Se recalcula: lo que vio hace un rato puede haberse ocupado.
  const startsAt = new Date(parsed.data.starts_at).toISOString()
  const date = utcToZoned(startsAt, agenda.config.timeZone).date
  const result = await publicSlotsFor(agenda, date, appointment.service_product_id, appointment.professional_id, appointment.id)
  const pick = result ? pickSlotResource(startsAt, result.slots, appointment.professional_id) : { ok: false as const }
  if (!result || !pick.ok) return NextResponse.json({ error: 'Ese horario ya no está disponible. Elegí otro.' }, { status: 409 })

  // Un cambio vuelve a pasar por la confirmación de la tienda si así lo pide.
  const status = agenda.config.settings.require_confirmation ? 'pending' : 'confirmed'
  const { data, error } = await admin
    .from('appointments')
    .update({
      starts_at: startsAt,
      ends_at: new Date(Date.parse(startsAt) + result.service.duration_minutes * 60_000).toISOString(),
      professional_id: pick.professionalId,
      status,
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
      reminder_sent_at: null,
    })
    .eq('id', appointment.id)
    .in('status', ['pending', 'confirmed'])
    .select('starts_at, status')
    .maybeSingle()
  if (error || !data) {
    if (!error?.message?.includes('APPOINTMENT_OVERLAP')) logger.error('No se pudo reprogramar el turno', { error: error?.message })
    return NextResponse.json({ error: appointmentErrorMessage(error, 'No se pudo cambiar el turno. Probá de nuevo.') }, { status: 409 })
  }
  await notifyAppointmentEvent(admin, {
    organizationId: appointment.organization_id,
    appointmentId: appointment.id,
    kind: 'rescheduled',
    customerName: appointment.customer_name,
    serviceName: appointment.service_name,
    startsAt,
    previousStartsAt: appointment.starts_at,
  }, { timeZone: agenda.config.timeZone, notifyEmail: agenda.config.settings.notify_email !== false })
  return NextResponse.json({ ok: true, startsAt: (data as { starts_at: string }).starts_at, status })
}
