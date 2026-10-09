import { normalizeOpeningHours, overlaps, type BusyInterval, type OpeningHours } from '@/lib/agenda/slots'
import { minutesOf, timeOf, utcToZoned, weekdayOf, zonedToUtc } from '@/lib/agenda/time'
import { resolveServiceTerms, type ServiceTerms } from '@/lib/agenda/service-terms'

export type ProfessionalAvailability = {
  id: string | null
  openingHours: OpeningHours | null
  online: boolean
  terms: ServiceTerms
}
export type QuotedSlot = {
  professionalId: string | null
  startsAt: string
  endsAt: string
  occupiedUntil: string
  terms: ServiceTerms
}
export type AvailabilityInput = {
  date: string
  timeZone: string
  openingHours: OpeningHours
  slotMinutes: number
  now: number
  minNoticeMinutes: number
  professionals: ProfessionalAvailability[]
  /** A null resource here is an organization-wide block, unlike legacy slots. */
  busy: BusyInterval[]
}

/** Empty eligibility stays empty. A unique agenda must be explicitly supplied. */
export function quotedSlotsFor(input: AvailabilityInput): QuotedSlot[] {
  if (!Number.isInteger(input.slotMinutes) || input.slotMinutes < 5) throw new Error('INVALID_SLOT_MINUTES')
  const business = normalizeOpeningHours(input.openingHours)[weekdayOf(input.date)] ?? []
  const earliest = input.now + input.minNoticeMinutes * 60000
  const result = new Map<string, QuotedSlot>()
  for (const professional of input.professionals) {
    if (!professional.online) continue
    const terms = resolveServiceTerms(professional.terms, null)
    const hours = professional.openingHours == null ? business
      : normalizeOpeningHours(professional.openingHours)[weekdayOf(input.date)] ?? []
    for (const [businessStart, businessEnd] of business) {
      for (const [personalStart, personalEnd] of hours) {
        const from = Math.max(minutesOf(businessStart), minutesOf(personalStart))
        const to = Math.min(minutesOf(businessEnd), minutesOf(personalEnd))
        for (let minute = from; minute + terms.durationMinutes + terms.bufferMinutes <= to; minute += input.slotMinutes) {
          const localTime = timeOf(minute)
          const start = zonedToUtc(input.date, localTime, input.timeZone)
          const local = utcToZoned(start, input.timeZone)
          // Intl can normalize a nonexistent DST time into another local hour.
          if (local.date !== input.date || local.time !== localTime || start < earliest) continue
          const end = start + terms.durationMinutes * 60000
          const occupiedEnd = end + terms.bufferMinutes * 60000
          if (occupiedEnd > zonedToUtc(input.date, timeOf(to), input.timeZone)) continue
          if (input.busy.some(block => (block.professionalId == null || block.professionalId === professional.id)
            && overlaps(block, { start, end: occupiedEnd }))) continue
          result.set(`${start}:${professional.id}`, {
            professionalId: professional.id, startsAt: new Date(start).toISOString(),
            endsAt: new Date(end).toISOString(), occupiedUntil: new Date(occupiedEnd).toISOString(), terms,
          })
        }
      }
    }
  }
  // Stable input order represents the configured professional priority.
  return [...result.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}
