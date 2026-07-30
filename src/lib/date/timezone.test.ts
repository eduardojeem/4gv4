import { describe, expect, it } from 'vitest'
import { startOfDayInTimeZone } from './timezone'

// Paraguay is UTC-3 year round (no DST since 2024).
const PY = 'America/Asuncion'

describe('startOfDayInTimeZone', () => {
  it('resolves local midnight late in the day regardless of host zone', () => {
    // 22:00 in Asuncion on Jul 29 === 01:00 UTC on Jul 30.
    // A naive setHours(0,0,0,0) on a UTC host would return Jul 30 00:00Z
    // (= 21:00 local), dropping the whole local day of revenue.
    const now = new Date('2026-07-30T01:00:00Z')
    expect(startOfDayInTimeZone(PY, now).toISOString()).toBe('2026-07-29T03:00:00.000Z')
  })

  it('does not bleed into the previous local day earlier on', () => {
    // 10:00 in Asuncion on Jul 29 === 13:00 UTC the same day.
    const now = new Date('2026-07-29T13:00:00Z')
    expect(startOfDayInTimeZone(PY, now).toISOString()).toBe('2026-07-29T03:00:00.000Z')
  })

  it('is stable across instants within the same local day', () => {
    const morning = startOfDayInTimeZone(PY, new Date('2026-07-29T13:00:00Z'))
    const evening = startOfDayInTimeZone(PY, new Date('2026-07-30T01:00:00Z'))
    expect(morning.toISOString()).toBe(evening.toISOString())
  })

  it('honours a different zone', () => {
    // 2026-07-29T13:00Z is 09:00 in Bogota (UTC-5) → local midnight is 05:00Z.
    const now = new Date('2026-07-29T13:00:00Z')
    expect(startOfDayInTimeZone('America/Bogota', now).toISOString()).toBe('2026-07-29T05:00:00.000Z')
  })

  it('defaults to Asuncion when no zone is provided', () => {
    const now = new Date('2026-07-30T01:00:00Z')
    expect(startOfDayInTimeZone(null, now).toISOString()).toBe(
      startOfDayInTimeZone(PY, now).toISOString()
    )
    expect(startOfDayInTimeZone('  ', now).toISOString()).toBe(
      startOfDayInTimeZone(PY, now).toISOString()
    )
  })

  it('falls back without throwing on an invalid zone', () => {
    const now = new Date('2026-07-29T13:00:00Z')
    expect(() => startOfDayInTimeZone('Nope/Nope', now)).not.toThrow()
    expect(startOfDayInTimeZone('Nope/Nope', now)).toBeInstanceOf(Date)
  })
})
