import { describe, expect, it } from 'vitest'
import { openStatus, openStatusLabel, parseDayRanges } from './opening-hours'

// 2026-10-08 es jueves. En Asunción (UTC-3): 13:00 local = 16:00 UTC.
const at = (iso: string) => new Date(iso)
const hours = { weekdays: '09:00 a 20:00', saturday: '09:00 a 13:00', sunday: 'Cerrado' }

describe('horario de atención', () => {
  it('entiende los formatos que escriben los dueños', () => {
    expect(parseDayRanges('09:00 a 20:00')).toEqual([[540, 1200]])
    expect(parseDayRanges('9 - 13 y 15 a 20')).toEqual([[540, 780], [900, 1200]])
    expect(parseDayRanges('Cerrado')).toEqual([])
    expect(parseDayRanges('Consultar')).toBeNull()
  })

  it('dice si está abierto y a qué hora cierra', () => {
    expect(openStatusLabel(openStatus(hours, at('2026-10-08T16:00:00Z')))).toBe('Abierto ahora · cierra 20:00')
  })

  it('antes de abrir avisa la hora de apertura y después, que cerró por hoy', () => {
    expect(openStatusLabel(openStatus(hours, at('2026-10-08T10:30:00Z')))).toBe('Cerrado · abre a las 09:00')
    expect(openStatusLabel(openStatus(hours, at('2026-10-09T00:30:00Z')))).toBe('Cerrado por hoy')
  })

  it('el domingo cerrado y los textos sin horario no inventan un estado', () => {
    expect(openStatus(hours, at('2026-10-11T15:00:00Z'))).toEqual({ state: 'closed', opensAt: null })
    expect(openStatus({ weekdays: 'Consultar' }, at('2026-10-08T16:00:00Z'))).toEqual({ state: 'unknown' })
  })

  it('un horario que cruza la medianoche sigue abierto de madrugada', () => {
    expect(openStatus({ weekdays: '20:00 a 02:00' }, at('2026-10-09T03:30:00Z'))).toEqual({ state: 'open', closesAt: '02:00' })
  })
})
