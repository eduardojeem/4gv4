import { openingHoursSchema } from './booking-config'
import { WEEKDAY_LABELS } from './time'
export function agendaSettingsProblem(settings: { opening_hours: unknown }, services: { name: string; duration_minutes: number; buffer_minutes?: number }[]): string | null {
 const parsed = openingHoursSchema.safeParse(settings.opening_hours)
 if (!parsed.success) return 'Revisá los horarios: completá cada tramo con un inicio anterior al cierre.'
 for (const [day, ranges] of Object.entries(parsed.data)) {
  const sorted = [...ranges].sort((a,b) => a[0].localeCompare(b[0]))
  if (sorted.some((range,index) => index > 0 && range[0] < sorted[index-1][1])) return 'Los tramos del ' + WEEKDAY_LABELS[Number(day)].toLowerCase() + ' se superponen.'
 }
 for (const service of services) {
  if (!Number.isInteger(service.duration_minutes) || service.duration_minutes < 5 || service.duration_minutes > 600) return service.name + ': la duración debe ser un entero entre 5 y 600 minutos.'
  const buffer = service.buffer_minutes ?? 0
  if (!Number.isInteger(buffer) || buffer < 0 || buffer > 120) return service.name + ': la preparación debe ser de 0 a 120 minutos.'
 }
 return null
}
