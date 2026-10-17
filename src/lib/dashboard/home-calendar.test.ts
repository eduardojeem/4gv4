import { describe, expect, it } from 'vitest'
import { homeCalendar } from './home-calendar'
describe('home dashboard business calendar', () => {
 it('keeps Asuncion midnight and the last seven calendar dates independent of browser timezone', () => {
  const result = homeCalendar('America/Asuncion', new Date('2026-10-16T01:30:00Z'))
  expect(result.today).toBe('2026-10-15')
  expect(result.startOfDay.toISOString()).toBe('2026-10-15T03:00:00.000Z')
  expect(result.endOfDay.toISOString()).toBe('2026-10-16T02:59:59.999Z')
  expect(result.last7Days).toEqual(['2026-10-09','2026-10-10','2026-10-11','2026-10-12','2026-10-13','2026-10-14','2026-10-15'])
 })
 it('uses the configured organization zone rather than a fixed UTC offset', () => {
  const result = homeCalendar('Asia/Tokyo', new Date('2026-10-16T01:30:00Z'))
  expect(result.today).toBe('2026-10-16')
  expect(result.startOfDay.toISOString()).toBe('2026-10-15T15:00:00.000Z')
 })
})
