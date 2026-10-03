/**
 * Archivo de calendario (.ics) de un turno, para «Agregar a mi calendario».
 * Las horas van en UTC: cada teléfono las muestra en su zona.
 */
export function appointmentIcs(params: {
  uid: string
  startsAt: string
  endsAt: string
  title: string
  location?: string | null
  description?: string | null
  url?: string | null
  now?: Date
}): string {
  const stamp = (value: string | Date) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  // RFC 5545: se escapan barra invertida, punto y coma, coma y saltos de línea.
  const text = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MiTiendaPy//Turnos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${params.uid}@turnos`,
    `DTSTAMP:${stamp(params.now ?? new Date())}`,
    `DTSTART:${stamp(params.startsAt)}`,
    `DTEND:${stamp(params.endsAt)}`,
    `SUMMARY:${text(params.title)}`,
    ...(params.location ? [`LOCATION:${text(params.location)}`] : []),
    ...(params.description ? [`DESCRIPTION:${text(params.description)}`] : []),
    ...(params.url ? [`URL:${params.url}`] : []),
    // Aviso una hora antes.
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${text(params.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}
