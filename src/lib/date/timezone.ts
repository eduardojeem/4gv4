export const DEFAULT_TIME_ZONE = 'America/Asuncion'

/**
 * Returns the instant of "midnight today" for a given IANA time zone.
 *
 * Server routes must not use `date.setHours(0, 0, 0, 0)` to build day
 * boundaries: that resolves against the *server* time zone (UTC on most
 * hosts), which shifts the window by the UTC offset and makes "today"
 * metrics wrong — under-reporting late in the local day and including the
 * previous evening earlier on.
 *
 * Instead of computing an offset, this reads the current wall-clock time in
 * the target zone and subtracts the elapsed time since local midnight from
 * the current instant. That stays correct regardless of the host's zone.
 *
 * Falls back to the server-local day boundary if the zone is not recognized.
 */
export function startOfDayInTimeZone(timeZone: string | null | undefined, now: Date = new Date()): Date {
  const zone = timeZone?.trim() || DEFAULT_TIME_ZONE

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(now)

    const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
    const hours = read('hour')
    const minutes = read('minute')
    const seconds = read('second')

    if (![hours, minutes, seconds].every(Number.isFinite)) throw new Error('Invalid time parts')

    const msSinceLocalMidnight =
      ((hours * 60 + minutes) * 60 + seconds) * 1000 + now.getMilliseconds()

    return new Date(now.getTime() - msSinceLocalMidnight)
  } catch {
    const fallback = new Date(now.getTime())
    fallback.setHours(0, 0, 0, 0)
    return fallback
  }
}
