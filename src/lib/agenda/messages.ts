import { utcToZoned, WEEKDAY_LABELS } from '@/lib/agenda/time'

/** «jueves 15/10 a las 09:30» en la zona de la empresa. */
export function appointmentWhen(startsAt: string, timeZone: string) {
  const local = utcToZoned(startsAt, timeZone)
  const [, month, day] = local.date.split('-')
  return `${WEEKDAY_LABELS[local.weekday].toLowerCase()} ${day}/${month} a las ${local.time}`
}

export function buildAppointmentWhatsApp(kind: 'confirm' | 'reminder', params: {
  storeName: string
  customerName: string
  serviceName: string
  startsAt: string
  timeZone: string
  professionalName?: string | null
  url?: string | null
}) {
  const firstName = params.customerName.trim().split(/\s+/)[0] || params.customerName
  const when = appointmentWhen(params.startsAt, params.timeZone)
  const withWho = params.professionalName ? ` con ${params.professionalName}` : ''
  const lines = kind === 'confirm'
    ? [`Hola ${firstName}! Te confirmamos tu turno en ${params.storeName}:`, '', `📅 ${when}`, `✂️ ${params.serviceName}${withWho}`]
    : [`Hola ${firstName}! Te recordamos tu turno en ${params.storeName}:`, '', `📅 ${when}`, `✂️ ${params.serviceName}${withWho}`, '', '¿Venís? Respondé este mensaje para confirmar.']
  if (params.url) lines.push('', `Ver, cambiar o cancelar tu turno: ${params.url}`)
  return lines.join('\n')
}

export type AppointmentEventKind = 'booked' | 'rescheduled' | 'cancelled'

/** «Juan reservó Corte para el jueves 15/10 a las 09:30.» Se usa en la campanita y en el email. */
export function describeAppointmentEvent(
  event: { kind: AppointmentEventKind; customerName: string; serviceName: string; startsAt: string; previousStartsAt?: string | null },
  timeZone: string,
): string {
  const when = appointmentWhen(event.startsAt, timeZone)
  const who = event.customerName.trim() || 'Un cliente'
  if (event.kind === 'booked') return `${who} reservó ${event.serviceName} para el ${when}.`
  if (event.kind === 'cancelled') return `${who} canceló su turno de ${event.serviceName} del ${when}.`
  const before = event.previousStartsAt ? ` (era el ${appointmentWhen(event.previousStartsAt, timeZone)})` : ''
  return `${who} cambió su turno de ${event.serviceName} al ${when}${before}.`
}
