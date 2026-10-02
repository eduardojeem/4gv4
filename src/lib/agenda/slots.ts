import { minutesOf, weekdayOf, zonedToUtc } from '@/lib/agenda/time'

/** Día de la semana (0 = domingo) → tramos de atención [["08:00","12:00"], ...]. */
export type OpeningHours = Record<string, Array<[string, string]>>

export const DEFAULT_OPENING_HOURS: OpeningHours = {
  1: [['08:00', '18:00']],
  2: [['08:00', '18:00']],
  3: [['08:00', '18:00']],
  4: [['08:00', '18:00']],
  5: [['08:00', '18:00']],
  6: [['08:00', '12:00']],
}

export type BusyInterval = { start: number; end: number; professionalId: string | null }

export type Slot = { startsAt: string; endsAt: string; professionalIds: Array<string | null> }

/** Limpia lo que llega guardado o del formulario: tramos válidos y ordenados. */
export function normalizeOpeningHours(value: unknown): OpeningHours {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const result: OpeningHours = {}
  for (let day = 0; day < 7; day += 1) {
    const ranges = Array.isArray(source[day]) ? (source[day] as unknown[]) : []
    const valid = ranges
      .filter((range): range is [string, string] => Array.isArray(range) && range.length === 2 && range.every((t) => typeof t === 'string' && /^\d{2}:\d{2}$/.test(t)))
      .filter(([from, to]) => minutesOf(from) < minutesOf(to) && minutesOf(to) <= 24 * 60)
      .sort((a, b) => minutesOf(a[0]) - minutesOf(b[0]))
    if (valid.length) result[day] = valid.slice(0, 4)
  }
  return result
}

export function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end
}

/**
 * Horarios libres de un día. Un horario sirve si al menos uno de los
 * profesionales (o la agenda única, si no hay profesionales) está libre
 * durante todo el servicio, dentro del horario de atención.
 */
export function availableSlots(params: {
  date: string
  timeZone: string
  openingHours: OpeningHours
  slotMinutes: number
  durationMinutes: number
  busy: BusyInterval[]
  /** Vacío = agenda única. */
  professionalIds: string[]
  now: number
  minNoticeMinutes: number
}): Slot[] {
  const ranges = params.openingHours[weekdayOf(params.date)] ?? []
  const resources: Array<string | null> = params.professionalIds.length ? params.professionalIds : [null]
  const earliest = params.now + params.minNoticeMinutes * 60_000
  const step = Math.max(5, params.slotMinutes)
  const slots: Slot[] = []

  for (const [from, to] of ranges) {
    const close = minutesOf(to)
    for (let minute = minutesOf(from); minute + params.durationMinutes <= close; minute += step) {
      const start = zonedToUtc(params.date, `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`, params.timeZone)
      const end = start + params.durationMinutes * 60_000
      if (start < earliest) continue
      const free = resources.filter((resource) =>
        !params.busy.some((interval) => interval.professionalId === resource && overlaps(interval, { start, end })))
      if (free.length) slots.push({ startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), professionalIds: free })
    }
  }
  return slots
}

/**
 * ¿El horario pedido está libre? Devuelve con quién queda: el profesional
 * pedido, o el primero libre si el cliente no eligió (null = agenda única).
 */
export function pickSlotResource(
  startsAt: string,
  slots: Slot[],
  professionalId: string | null | undefined,
): { ok: true; professionalId: string | null } | { ok: false } {
  const match = slots.find((candidate) => candidate.startsAt === startsAt)
  if (!match) return { ok: false }
  if (professionalId) return match.professionalIds.includes(professionalId) ? { ok: true, professionalId } : { ok: false }
  return { ok: true, professionalId: match.professionalIds[0] ?? null }
}
