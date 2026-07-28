import { describe, expect, it } from 'vitest'
import { parsePagoparNotificationAmount } from '@/lib/payments/pagopar'

describe('parsePagoparNotificationAmount', () => {
  it('accepts numeric amounts', () => {
    expect(parsePagoparNotificationAmount(150000)).toBe(150000)
  })

  it('normalizes Paraguayan thousands separators', () => {
    expect(parsePagoparNotificationAmount('150.000')).toBe(150000)
    expect(parsePagoparNotificationAmount('1.250.000')).toBe(1250000)
  })

  it('supports decimal strings without changing their value', () => {
    expect(parsePagoparNotificationAmount('150000.50')).toBe(150000.5)
    expect(parsePagoparNotificationAmount('150.000,50')).toBe(150000.5)
  })

  it('rejects invalid and negative amounts', () => {
    expect(parsePagoparNotificationAmount('invalid')).toBeNull()
    expect(parsePagoparNotificationAmount(-1)).toBeNull()
  })
})
