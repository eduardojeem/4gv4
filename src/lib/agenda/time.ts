/**
 * Fechas de la agenda en la zona horaria de la empresa.
 *
 * Los turnos se guardan en UTC; el horario de atención y lo que ve el cliente
 * están en hora local («de 08:00 a 18:00»). Estas funciones convierten entre
 * las dos con Intl, sin librerías, así un turno de las 09:00 en Asunción es
 * 09:00 aunque el servidor o el navegador estén en otra zona.
 */

export const DEFAULT_TIMEZONE = 'America/Asuncion'

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number }

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function zonedParts(instant: number, timeZone: string): Parts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  })
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday] ?? 0,
  }
}

/** Minutos que la zona está adelantada (o atrasada, negativo) respecto de UTC en ese instante. */
function offsetMinutes(instant: number, timeZone: string) {
  const p = zonedParts(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60_000)
}

/** «2026-10-15» + «09:30» en la zona → instante UTC (ms). */
export function zonedToUtc(date: string, time: string, timeZone = DEFAULT_TIMEZONE): number {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const first = guess - offsetMinutes(guess, timeZone) * 60_000
  // Segunda pasada por si el cambio de horario cae entre la suposición y el resultado.
  return guess - offsetMinutes(first, timeZone) * 60_000
}

export function utcToZoned(instant: number | string, timeZone = DEFAULT_TIMEZONE) {
  const p = zonedParts(typeof instant === 'string' ? Date.parse(instant) : instant, timeZone)
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
    weekday: p.weekday,
    minutes: p.hour * 60 + p.minute,
  }
}

/** Hoy en la zona de la empresa. */
export function todayIn(timeZone = DEFAULT_TIMEZONE, now = Date.now()) {
  return utcToZoned(now, timeZone).date
}

/** Suma días a una fecha «YYYY-MM-DD» (en calendario, sin zonas). */
export function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return next.toISOString().slice(0, 10)
}

export function weekdayOf(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Inicio y fin (exclusivo) de un día local, en UTC. */
export function dayRangeUtc(date: string, timeZone = DEFAULT_TIMEZONE) {
  return { start: zonedToUtc(date, '00:00', timeZone), end: zonedToUtc(addDays(date, 1), '00:00', timeZone) }
}

export function minutesOf(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

export function timeOf(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export const WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
