import { describe, expect, it } from 'vitest'
import { quotedSlotsFor, type AvailabilityInput } from '@/lib/agenda/availability'
import type { OpeningHours } from '@/lib/agenda/slots'

const run = (input: AvailabilityInput) => quotedSlotsFor(input)
const base = {
  date: '2026-10-15', timeZone: 'America/Asuncion',
  openingHours: { 4: [['08:00', '18:00']] } as OpeningHours,
  slotMinutes: 30, now: Date.parse('2026-10-14T12:00:00Z'), minNoticeMinutes: 0,
  professionals: [{ id: 'ana', openingHours: null, online: true, terms: { price: 40000, durationMinutes: 30, bufferMinutes: 5 } }],
  busy: [],
}
describe('professional availability', () => {
  it('never invents a unique agenda when there are no eligible professionals', () => {
    expect(run({ ...base, professionals: [] })).toEqual([])
    expect(run({ ...base, professionals: [{ ...base.professionals[0], online: false }] })).toEqual([])
  })
  it('intersects professional hours with the business and fits the buffer', () => {
    const slots = run({ ...base, professionals: [{ ...base.professionals[0], openingHours: { 4: [['09:00', '10:00'], ['14:00', '15:00']] } }] })
    expect(slots.map(s => s.startsAt)).toEqual(['2026-10-15T12:00:00.000Z', '2026-10-15T17:00:00.000Z'])
    expect(slots[0]).toMatchObject({ endsAt: '2026-10-15T12:30:00.000Z', occupiedUntil: '2026-10-15T12:35:00.000Z' })
  })
  it('distinguishes a closed professional schedule from inherited hours', () => {
    expect(run({ ...base, professionals: [{ ...base.professionals[0], openingHours: {} }] })).toEqual([])
    expect(run(base)[0].startsAt).toBe('2026-10-15T11:00:00.000Z')
  })
  it('blocks only the affected professional and respects the occupied interval', () => {
    const slots = run({ ...base, openingHours: { 4: [['09:00', '10:30']] },
      professionals: [...base.professionals, { ...base.professionals[0], id: 'luis' }],
      busy: [{ start: Date.parse('2026-10-15T12:00:00Z'), end: Date.parse('2026-10-15T12:35:00Z'), professionalId: 'ana' }],
    })
    expect(slots.filter(s => s.professionalId === 'ana').map(s => s.startsAt)).toEqual([])
    expect(slots.filter(s => s.professionalId === 'luis').map(s => s.startsAt)).toEqual(['2026-10-15T12:00:00.000Z', '2026-10-15T12:30:00.000Z'])
  })
  it('deduplicates overlapping business ranges', () => {
    const slots = run({ ...base, openingHours: { 4: [['09:00', '10:00'], ['09:00', '10:00']] } })
    expect(slots.map(s => s.startsAt)).toEqual(['2026-10-15T12:00:00.000Z'])
  })
  it('does not offer nonexistent local times during the DST jump', () => {
    const slots = run({ ...base, date: '2026-03-29', timeZone: 'Europe/Madrid', openingHours: { 0: [['02:00', '03:00']] } })
    expect(slots).toEqual([])
  })
})
