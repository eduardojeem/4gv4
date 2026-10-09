import { DEFAULT_TIME_ZONE } from '@/lib/date/timezone'

/**
 * «Abierto ahora» a partir de los horarios que carga el dueño en texto libre
 * («09:00 a 20:00», «9 - 13 y 15 a 20», «Cerrado»). Si el texto no se entiende
 * no se inventa un estado: se devuelve `unknown` y el sitio muestra el horario.
 */
export interface OpeningHoursText {
  weekdays?: string | null
  saturday?: string | null
  sunday?: string | null
}

export type OpenStatus =
  | { state: 'open'; closesAt: string }
  | { state: 'closed'; opensAt: string | null }
  | { state: 'unknown' }

const RANGE = /(\d{1,2})(?:[:.h](\d{2}))?\s*(?:hs?\.?)?\s*(?:a|-|–|hasta)\s*(\d{1,2})(?:[:.h](\d{2}))?/gi

function toMinutes(hours: string, minutes?: string) {
  const h = Number(hours)
  const m = minutes ? Number(minutes) : 0
  if (h > 24 || m > 59) return null
  return h * 60 + m
}

const clock = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** Los tramos de un día; `null` si el texto no dice nada entendible. */
export function parseDayRanges(text: string | null | undefined): Array<[number, number]> | null {
  const value = text?.trim()
  if (!value) return null
  if (/cerrado|no abrimos|sin atenci/i.test(value) && !/\d/.test(value)) return []
  const ranges: Array<[number, number]> = []
  for (const match of value.matchAll(RANGE)) {
    const start = toMinutes(match[1], match[2])
    let end = toMinutes(match[3], match[4])
    if (start === null || end === null) continue
    if (end <= start) end += 24 * 60 // cierra pasada la medianoche
    ranges.push([start, end])
  }
  return ranges.length > 0 ? ranges : null
}

function localNow(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { weekday, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

export function openStatus(hours: OpeningHoursText | null | undefined, now: Date = new Date(), timeZone: string = DEFAULT_TIME_ZONE): OpenStatus {
  if (!hours) return { state: 'unknown' }
  const { weekday, minutes } = localNow(now, timeZone)
  const textFor = (day: number) => (day === 0 ? hours.sunday : day === 6 ? hours.saturday : hours.weekdays)
  const today = parseDayRanges(textFor(weekday))
  if (today === null) return { state: 'unknown' }

  // Un tramo de ayer que cruza la medianoche («20 a 02») sigue abierto hoy.
  const yesterday = parseDayRanges(textFor((weekday + 6) % 7)) ?? []
  const lateNight = yesterday.find(([, end]) => end > 24 * 60 && minutes < end - 24 * 60)
  if (lateNight) return { state: 'open', closesAt: clock(lateNight[1]) }

  const current = today.find(([start, end]) => minutes >= start && minutes < end)
  if (current) return { state: 'open', closesAt: clock(current[1]) }
  const next = today.find(([start]) => start > minutes)
  return { state: 'closed', opensAt: next ? clock(next[0]) : null }
}

export function openStatusLabel(status: OpenStatus) {
  if (status.state === 'open') return `Abierto ahora · cierra ${status.closesAt}`
  if (status.state === 'closed') return status.opensAt ? `Cerrado · abre a las ${status.opensAt}` : 'Cerrado por hoy'
  return null
}
