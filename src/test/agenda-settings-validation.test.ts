import { describe, expect, it } from 'vitest'
import { agendaSettingsProblem } from '@/lib/agenda/settings-validation'
describe('agenda settings validation', () => {
 const settings = { opening_hours: { 1: [['09:00','12:00']] } }
 it('rejects overlapping shifts', () => {
  expect(agendaSettingsProblem({ opening_hours: { 1: [['09:00','13:00'], ['12:00','18:00']] } }, [])).toContain('superponen')
 })
 it('accepts adjacent shifts', () => {
  expect(agendaSettingsProblem({ opening_hours: { 1: [['09:00','12:00'], ['12:00','18:00']] } }, [])).toBeNull()
 })
 it('rejects invalid service durations and preparation margins', () => {
  expect(agendaSettingsProblem(settings, [{ name:'Corte', duration_minutes:601, buffer_minutes:0 }])).toContain('Corte')
  expect(agendaSettingsProblem(settings, [{ name:'Corte', duration_minutes:30, buffer_minutes:-1 }])).toContain('Corte')
 })
})
