import { describe, expect, it } from 'vitest'
import { appointmentPhoneMatches } from '@/lib/agenda/appointment-customer'
describe('appointment customer matching', () => {
 it('recognizes equivalent Paraguay mobile formats', () => {
  expect(appointmentPhoneMatches('0981 123 456', '+595 981123456')).toBe(true)
  expect(appointmentPhoneMatches('5950981123456', '0981123456')).toBe(true)
 })
 it('does not match a shared suffix or missing phones', () => {
  expect(appointmentPhoneMatches('+54 981123456', '0981123456')).toBe(false)
  expect(appointmentPhoneMatches('', '')).toBe(false)
 })
})
