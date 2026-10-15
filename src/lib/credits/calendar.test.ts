// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { paymentCalendarStatus, creditCalendarDate, daysUntilCreditDue } from './calendar'
describe('organization credit calendar',()=>{
 it('allows payment throughout the due day',()=>{
  expect(paymentCalendarStatus('2026-10-12T01:30:00Z','2026-10-11','America/Asuncion')).toBe('on_time')
  expect(paymentCalendarStatus('2026-10-12T03:30:00Z','2026-10-11','America/Asuncion')).toBe('late')
 })
 it('uses organization timezone rather than browser date',()=>{
  expect(creditCalendarDate('2026-10-12T01:30:00Z','America/Asuncion')).toBe('2026-10-11')
  expect(creditCalendarDate('2026-10-12T01:30:00Z','Asia/Tokyo')).toBe('2026-10-12')
 })
 it('computes calendar day differences and rejects invalid dates',()=>{
  expect(daysUntilCreditDue('2026-10-11','America/Asuncion',new Date('2026-10-11T23:00:00Z'))).toBe(0)
  expect(daysUntilCreditDue(null,'America/Asuncion')).toBeNull()
  expect(paymentCalendarStatus('bad','bad','America/Asuncion')).toBeNull()
 })
})
