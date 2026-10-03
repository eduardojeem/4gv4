import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { sendEmail } from '@/lib/email/resend'
import { describeAppointmentEvent, type AppointmentEventKind } from '@/lib/agenda/messages'
import { siteUrl } from '@/lib/site-url'

export type { AppointmentEventKind }

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface AppointmentEventInput {
  organizationId: string
  appointmentId: string
  kind: AppointmentEventKind
  customerName: string
  serviceName: string
  startsAt: string
  previousStartsAt?: string | null
}

const SUBJECTS: Record<AppointmentEventKind, string> = {
  booked: 'Nueva reserva online',
  rescheduled: 'Un cliente cambió su turno',
  cancelled: 'Un cliente canceló su turno',
}

/** Zona horaria y si la tienda quiere email. Sin la columna (migración pendiente), avisa. */
export async function notifyOptionsFor(admin: SupabaseClient, organizationId: string) {
  const [{ data: settings }, { data: agenda }] = await Promise.all([
    admin.from('organization_settings').select('timezone').eq('organization_id', organizationId).maybeSingle(),
    admin.from('agenda_settings').select('*').eq('organization_id', organizationId).maybeSingle(),
  ])
  return {
    timeZone: (settings as { timezone?: string | null } | null)?.timezone || 'America/Asuncion',
    notifyEmail: (agenda as { notify_email?: boolean } | null)?.notify_email !== false,
  }
}

/**
 * Registra lo que hizo el cliente y, si la tienda lo tiene activado, le avisa
 * por email. Nunca hace fallar la reserva ni el cambio: si algo falla, queda
 * en el log y el turno igual se guardó.
 */
export async function notifyAppointmentEvent(
  admin: SupabaseClient,
  event: AppointmentEventInput,
  options: { timeZone: string; notifyEmail: boolean },
) {
  const { error } = await admin.from('appointment_events').insert({
    organization_id: event.organizationId,
    appointment_id: event.appointmentId,
    kind: event.kind,
    customer_name: event.customerName.slice(0, 160),
    service_name: event.serviceName.slice(0, 200),
    starts_at: event.startsAt,
    previous_starts_at: event.previousStartsAt ?? null,
  })
  // Sin la migración la tabla no existe: el turno sigue funcionando igual.
  if (error && !/does not exist|schema cache/i.test(error.message)) {
    logger.error('No se pudo registrar la novedad del turno', { error: error.message, kind: event.kind })
  }

  if (!options.notifyEmail) return
  try {
    const { data } = await admin
      .from('website_settings')
      .select('value')
      .eq('organization_id', event.organizationId)
      .eq('key', 'company_info')
      .maybeSingle()
    const company = ((data as { value?: Record<string, unknown> } | null)?.value ?? {}) as Record<string, unknown>
    const to = typeof company.email === 'string' ? company.email.trim() : ''
    if (!to) return
    const text = describeAppointmentEvent(event, options.timeZone)
    const agendaUrl = siteUrl('/dashboard/agenda')
    await sendEmail({
      to,
      subject: `${SUBJECTS[event.kind]}: ${event.customerName}`,
      html: `<p>${escapeHtml(text)}</p><p><a href="${agendaUrl}">Ver la agenda</a></p>`,
      log: { organizationId: event.organizationId, customerName: event.customerName },
    })
  } catch (error) {
    logger.error('No se pudo avisar por email la novedad del turno', { error, kind: event.kind })
  }
}
