import { describe, expect, it } from 'vitest'
import { addDays, dayRangeUtc, utcToZoned, weekdayOf, zonedToUtc } from '@/lib/agenda/time'
import { availableSlots, normalizeOpeningHours, pickSlotResource, type BusyInterval } from '@/lib/agenda/slots'

const TZ = 'America/Asuncion'

describe('horas de la agenda', () => {
  it('convierte la hora local de Asunción (UTC-3) a UTC y vuelve', () => {
    const instant = zonedToUtc('2026-10-15', '09:30', TZ)
    expect(new Date(instant).toISOString()).toBe('2026-10-15T12:30:00.000Z')
    expect(utcToZoned(instant, TZ)).toMatchObject({ date: '2026-10-15', time: '09:30', weekday: 4 })
  })

  it('respeta otras zonas, con horario de verano', () => {
    expect(new Date(zonedToUtc('2026-07-01', '10:00', 'Europe/Madrid')).toISOString()).toBe('2026-07-01T08:00:00.000Z')
    expect(new Date(zonedToUtc('2026-01-15', '10:00', 'Europe/Madrid')).toISOString()).toBe('2026-01-15T09:00:00.000Z')
  })

  it('días y semanas', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(weekdayOf('2026-10-18')).toBe(0)
    const range = dayRangeUtc('2026-10-15', TZ)
    expect(range.end - range.start).toBe(24 * 3_600_000)
  })

  it('limpia horarios inválidos', () => {
    expect(normalizeOpeningHours({ 1: [['18:00', '08:00'], ['08:00', '12:00']], 2: 'x', 9: [['08:00', '09:00']] })).toEqual({ 1: [['08:00', '12:00']] })
  })
})

describe('horarios libres', () => {
  const base = {
    date: '2026-10-15', // jueves
    timeZone: TZ,
    openingHours: { 4: [['08:00', '10:00'], ['14:00', '15:00']] } as Record<string, Array<[string, string]>>,
    slotMinutes: 30,
    durationMinutes: 60,
    now: Date.parse('2026-10-14T12:00:00Z'),
    minNoticeMinutes: 60,
  }
  const at = (time: string) => zonedToUtc('2026-10-15', time, TZ)

  it('ofrece los inicios donde entra el servicio entero', () => {
    const slots = availableSlots({ ...base, busy: [], professionalIds: [] })
    expect(slots.map((slot) => utcToZoned(slot.startsAt, TZ).time)).toEqual(['08:00', '08:30', '09:00', '14:00'])
  })

  it('con agenda única, un turno ocupa el horario', () => {
    const busy: BusyInterval[] = [{ start: at('08:30'), end: at('09:00'), professionalId: null }]
    const slots = availableSlots({ ...base, busy, professionalIds: [] })
    expect(slots.map((slot) => utcToZoned(slot.startsAt, TZ).time)).toEqual(['09:00', '14:00'])
  })

  it('con dos profesionales, el horario sigue libre si uno puede', () => {
    const busy: BusyInterval[] = [{ start: at('08:00'), end: at('09:00'), professionalId: 'ana' }]
    const slots = availableSlots({ ...base, busy, professionalIds: ['ana', 'luis'] })
    const first = slots.find((slot) => utcToZoned(slot.startsAt, TZ).time === '08:00')!
    expect(first.professionalIds).toEqual(['luis'])
    expect(pickSlotResource(first.startsAt, slots, 'ana')).toEqual({ ok: false })
    expect(pickSlotResource(first.startsAt, slots, undefined)).toEqual({ ok: true, professionalId: 'luis' })
  })

  it('no ofrece horarios dentro de la anticipación mínima', () => {
    const slots = availableSlots({ ...base, now: at('07:30'), busy: [], professionalIds: [] })
    expect(slots.map((slot) => utcToZoned(slot.startsAt, TZ).time)).toEqual(['08:30', '09:00', '14:00'])
  })

  it('un día cerrado no tiene horarios', () => {
    expect(availableSlots({ ...base, date: '2026-10-18', busy: [], professionalIds: [] })).toEqual([])
  })

  it('agenda única: el horario libre se asigna sin profesional', () => {
    const slots = availableSlots({ ...base, busy: [], professionalIds: [] })
    expect(pickSlotResource(slots[0].startsAt, slots, null)).toEqual({ ok: true, professionalId: null })
    expect(pickSlotResource('2026-10-15T20:00:00.000Z', slots, null)).toEqual({ ok: false })
  })
})
